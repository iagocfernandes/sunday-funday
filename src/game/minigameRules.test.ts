import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, defaultMinigameOrder, MINIGAMES } from '../data/config';
import { applyCommand, createGame, ranking, type PlayerSeed } from './engine';
import { previewModernMinigameResult } from './minigameRules';
import type { Command, GameConfig, GameState } from './types';

function seeds(count: number): PlayerSeed[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `p${index}`,
    name: `P${index}`,
    color: '#fff',
    symbol: '●',
    portrait: 'x.png',
  }));
}

function run(state: GameState, command: Command): GameState {
  const result = applyCommand(state, {
    commandId: `modern-${state.revision}`,
    expectedRevision: state.revision,
    command,
  });
  if (result.rejected) throw new Error(result.rejected);
  return result.state;
}

function tryRun(state: GameState, command: Command) {
  return applyCommand(state, {
    commandId: `modern-${state.revision}`,
    expectedRevision: state.revision,
    command,
  });
}

function atIntro(count: number, minigameId: string, seed = 9876): GameState {
  const state = createGame(
    seeds(count),
    { rounds: 1, minigameOrder: [minigameId] },
    { seed, shuffleOrder: false },
  );
  state.phase = 'turnEnd';
  state.activeIndex = state.order.length - 1;
  return run(state, { type: 'endTurn' });
}

function atResults(count: number, minigameId: string, seed = 9876): GameState {
  return run(atIntro(count, minigameId, seed), { type: 'startMinigame' });
}

function submit(state: GameState, winnerIds: string[]): GameState {
  return run(state, {
    type: 'submitResults',
    resultId: `result-${state.round}`,
    format: 'individual',
    winnerIds,
  });
}

describe('regras modernas de minigames', () => {
  it('cria partidas com 10 rodadas na ordem fixa aprovada', () => {
    expect(DEFAULT_CONFIG.rounds).toBe(10);
    expect(DEFAULT_CONFIG.minigameRulesVersion).toBe(2);
    expect(defaultMinigameOrder(10)).toEqual([
      'beerpong', 'jamboree', 'times-up', 'switch-tennis', 'coup',
      'jamboree', 'beerpong', 'times-up', 'switch-tennis', 'party-finale',
    ]);
  });

  it('aceita vencedor solo de dupla com 7 e exige dois vencedores com 8', () => {
    const odd = atResults(7, 'beerpong');
    expect(previewModernMinigameResult(odd, ['p0']).ok).toBe(true);
    const oddApplied = submit(odd, ['p0']);
    expect(oddApplied.players.p0.common).toBe(20);
    expect(oddApplied.players.p1.common).toBe(10);

    const even = atResults(8, 'switch-tennis');
    expect(previewModernMinigameResult(even, ['p0'])).toMatchObject({ ok: false });
    expect(previewModernMinigameResult(even, ['p0', 'p1']).ok).toBe(true);
  });

  it("aceita qualquer subconjunto próprio no Time's Up e recusa vencedores duplicados ou desconhecidos", () => {
    const state = atResults(7, 'times-up');
    expect(previewModernMinigameResult(state, ['p0', 'p2', 'p6']).ok).toBe(true);
    expect(previewModernMinigameResult(state, state.order)).toMatchObject({ ok: false });
    expect(previewModernMinigameResult(state, ['p0', 'p0'])).toMatchObject({ ok: false });
    expect(previewModernMinigameResult(state, ['fantasma'])).toMatchObject({ ok: false });
  });

  it('Coup com 7 premia um único participante com 20 moedas', () => {
    let state = atResults(7, 'coup');
    expect(state.minigame?.excludedPlayerIds).toBeUndefined();
    state = submit(state, ['p3']);
    expect(state.players.p3.common).toBe(30);
    expect(state.order.filter((id) => id !== 'p3').every((id) => state.players[id].common === 10)).toBe(true);
  });

  it('Coup com 8 persiste um excluído, impede sua vitória e aplica recompensa uma vez', () => {
    let state = atResults(8, 'coup');
    const excluded = state.minigame?.excludedPlayerIds ?? [];
    expect(excluded).toHaveLength(1);
    const excludedId = excluded[0];
    const winnerId = state.order.find((id) => id !== excludedId)!;
    expect(tryRun(state, {
      type: 'submitResults', resultId: 'invalid', format: 'individual', winnerIds: [excludedId],
    }).rejected).toContain('não pode vencer');

    state = submit(state, [winnerId]);
    expect(state.players[winnerId].common).toBe(30);
    expect(state.players[excludedId].common).toBe(20);
    const balances = Object.fromEntries(state.order.map((id) => [id, state.players[id].common]));
    const again = tryRun(state, {
      type: 'submitResults', resultId: 'duplicate', format: 'individual', winnerIds: [winnerId],
    });
    expect(again.rejected).toBeTruthy();
    expect(Object.fromEntries(state.order.map((id) => [id, state.players[id].common]))).toEqual(balances);
  });

  it('Coup com 10 sorteia e persiste três excluídos únicos pelo RNG da partida', () => {
    const first = atIntro(10, 'coup', 4444);
    const second = atIntro(10, 'coup', 4444);
    const excluded = first.minigame?.excludedPlayerIds ?? [];
    expect(excluded).toHaveLength(3);
    expect(new Set(excluded).size).toBe(3);
    expect(excluded).toEqual(second.minigame?.excludedPlayerIds);
    expect(first.rngCursor).toBe(3);
  });

  it('a final concede uma dourada antes da classificação final e nenhuma moeda', () => {
    const finale = MINIGAMES.find((game) => game.id === 'party-finale');
    expect(finale).toMatchObject({ name: 'Coup — final individual', winnerGolden: 1, winnerCoins: 0, otherCoins: 0 });
    let state = atResults(7, 'party-finale');
    state.players.p0.common = 100;
    const beforeCoins = Object.fromEntries(state.order.map((id) => [id, state.players[id].common]));
    state = submit(state, ['p1']);
    expect(state.players.p1.golden).toBe(1);
    expect(Object.fromEntries(state.order.map((id) => [id, state.players[id].common]))).toEqual(beforeCoins);
    expect(state.results[0].goldenAwards?.p1).toBe(1);
    expect(ranking(state)[0].id).toBe('p1');
  });

  it('partida legada sem opt-in mantém equipes e tabela de recompensas antigas', () => {
    const legacyConfig: Partial<GameConfig> = {
      rounds: 1,
      minigameOrder: ['beerpong'],
      minigameRulesVersion: undefined,
    };
    let state = createGame(seeds(8), legacyConfig, { seed: 1, shuffleOrder: false });
    state.phase = 'turnEnd';
    state.activeIndex = 7;
    state = run(state, { type: 'endTurn' });
    expect(state.minigame?.teams.flat()).toHaveLength(8);
    state = run(state, { type: 'startMinigame' });
    state = run(state, { type: 'submitResults', resultId: 'legacy', format: 'teams', winningTeam: 0 });
    expect(state.players.p0.common).toBe(10 + state.config.rewards.teams.winner);
    expect(state.results[0].goldenAwards).toBeUndefined();
  });
});
