import { MINIGAMES } from '../data/config.js';
import type { GameState, MinigameDef } from './types.js';

export const MODERN_MINIGAME_RULES_VERSION = 2 as const;

export type ModernMinigamePreview =
  | {
      ok: true;
      awards: Record<string, number>;
      goldenAwards: Record<string, number>;
      detail: string;
      winnerIds: string[];
    }
  | { ok: false; error: string };

export function usesModernMinigameRules(state: GameState): boolean {
  return state.config.minigameRulesVersion === MODERN_MINIGAME_RULES_VERSION;
}

export function minigameRuleForState(state: GameState): MinigameDef | null {
  if (!usesModernMinigameRules(state)) return null;
  const id = state.minigame?.minigameId ?? state.config.minigameOrder[state.round - 1];
  const def = MINIGAMES.find((game) => game.id === id);
  return def?.resultMode ? def : null;
}

function playerNames(state: GameState, ids: string[]): string {
  return ids.map((id) => state.players[id].name).join(', ');
}

/**
 * Valida a seleção moderna e calcula a prévia usada pelo motor e pela interface.
 * Não altera estado; a aplicação atômica acontece apenas em submitResults.
 */
export function previewModernMinigameResult(
  state: GameState,
  rawWinnerIds: readonly string[],
): ModernMinigamePreview {
  const def = minigameRuleForState(state);
  if (!def) return { ok: false, error: 'Esta partida usa as regras antigas de premiação.' };
  if (!state.minigame) return { ok: false, error: 'Sem prova ativa.' };
  if (!Array.isArray(rawWinnerIds)) return { ok: false, error: 'Seleção de vencedores inválida.' };

  const winnerIds = [...rawWinnerIds];
  if (winnerIds.some((id) => typeof id !== 'string' || !state.players[id])) {
    return { ok: false, error: 'A seleção cita um jogador inexistente.' };
  }
  if (new Set(winnerIds).size !== winnerIds.length) {
    return { ok: false, error: 'Jogador repetido entre os vencedores.' };
  }

  const excludedIds = state.minigame.excludedPlayerIds ?? [];
  if (excludedIds.some((id) => !state.players[id]) || new Set(excludedIds).size !== excludedIds.length) {
    return { ok: false, error: 'A lista de excluídos da prova é inválida.' };
  }
  const excluded = new Set(excludedIds);
  if (winnerIds.some((id) => excluded.has(id))) {
    return { ok: false, error: 'Quem ficou de fora desta prova não pode vencer.' };
  }

  const participants = state.order.filter((id) => !excluded.has(id));
  switch (def.resultMode) {
    case 'duo': {
      const allowedSolo = participants.length % 2 === 1;
      const validCount = winnerIds.length === 2 || (allowedSolo && winnerIds.length === 1);
      if (!validCount) {
        return {
          ok: false,
          error: allowedSolo
            ? 'Selecione uma dupla vencedora ou um vencedor solo.'
            : 'Selecione exatamente dois vencedores.',
        };
      }
      break;
    }
    case 'group':
      if (winnerIds.length < 1 || winnerIds.length >= participants.length) {
        return { ok: false, error: 'Selecione um grupo vencedor que não inclua todos os participantes.' };
      }
      break;
    case 'single':
      if (winnerIds.length !== 1) return { ok: false, error: 'Selecione exatamente um vencedor.' };
      break;
  }

  const winners = new Set(winnerIds);
  const awards: Record<string, number> = {};
  const goldenAwards: Record<string, number> = {};
  for (const id of state.order) {
    awards[id] = excluded.has(id)
      ? (def.excludedCoins ?? def.otherCoins ?? 0)
      : winners.has(id) ? (def.winnerCoins ?? 0) : (def.otherCoins ?? 0);
    goldenAwards[id] = winners.has(id) ? (def.winnerGolden ?? 0) : 0;
  }

  const winnerLabel = winnerIds.length === 1 ? 'Vencedor' : 'Vencedores';
  const excludedDetail = excludedIds.length
    ? ` | Fora da rodada: ${playerNames(state, excludedIds)} (+${def.excludedCoins ?? 0} moedas)`
    : '';
  return {
    ok: true,
    awards,
    goldenAwards,
    detail: `${winnerLabel}: ${playerNames(state, winnerIds)}${excludedDetail}.`,
    winnerIds,
  };
}
