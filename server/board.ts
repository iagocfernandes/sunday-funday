import { applyCommand, createGame, nextAutoCommand, type PlayerSeed } from '../src/game/engine.js';
import { CARD_REVEAL_MS } from '../src/data/cards.js';
import { DEFAULT_CONFIG, DEFAULT_COLORS, DEFAULT_SYMBOLS, PORTRAITS } from '../src/data/config.js';
import type { Command, DomainEvent, GameState } from '../src/game/types';
import { selectHostAudioCue } from '../src/presentation/hostAudioCues.js';
import type { BoardPresentation, BoardView, PublicGame, RemoteEvent, RemotePlayer } from '../src/remote/types';

/** Parte privada da sala no modo tabuleiro. O motor é o mesmo do jogo local. */
export interface BoardState {
  matchId: string;
  game: GameState;
  paused: boolean;
  itemDeadline: number | null;
  pausedItemMs: number | null;
  /** Pausa audiovisual independente da pausa manual. Ausente em salas antigas. */
  presentation?: BoardPresentation | null;
  /** Prazo de item congelado enquanto a apresentação está ativa; nunca é público. */
  presentationItemMs?: number | null;
  /** Próximo passo automático permitido (relógio do servidor). */
  nextAutoAt: number | null;
  events: RemoteEvent[];
  eventSeq: number;
  /** Conta turnos iniciados: identifica a vez para o botão do celular. */
  turn: number;
}

/** Comandos que o anfitrião pode enviar da TV. Passos automáticos ficam só com o servidor. */
const HOST_COMMANDS = new Set<Command['type']>([
  'discardPower', 'rob', 'skipIagugu', 'setDuelBet', 'resolveDuel', 'continueHarvest', 'chooseDice', 'stealItem', 'startRound', 'requestItemChoice', 'cancelItemChoice', 'useItem', 'itemWindowExpired', 'rollDice',
  'choosePath', 'buyItem', 'skipShop', 'buyGolden', 'skipPedestal', 'submitCardCode', 'confirmCard',
  'cancelCard', 'chooseTarget', 'cancelTarget', 'resolveDefense', 'startMinigame', 'setTeams',
  'submitResults', 'nextRound', 'manualAdjust', 'dismissNotice',
]);
/** Máximo de passos automáticos por requisição: reconexão não dispara sequência ilimitada. */
export const MAX_STEPS_PER_REQUEST = 12;
/** Atraso máximo recuperado de uma vez após ausência de leituras. */
const MAX_CATCH_UP_MS = 3000;
/** Margem para polling, rede e carregamento do arquivo antes de iniciar o áudio. */
export const PRESENTATION_GRACE_MS = 3000;

const str = (v: unknown, max = 80) => typeof v === 'string' && v.length > 0 && v.length <= max;
const idList = (v: unknown) => Array.isArray(v) && v.length <= 10 && v.every(x => str(x));

/** Validação em runtime do payload: o motor recebe apenas formas conhecidas. */
export function validGameCommand(command: unknown): command is Command {
  if (!command || typeof command !== 'object') return false;
  const c = command as Record<string, unknown>;
  if (typeof c.type !== 'string' || !HOST_COMMANDS.has(c.type as Command['type'])) return false;
  switch (c.type) {
    case 'rob': return str(c.targetId) && ['common','golden'].includes(c.currency as string);
    case 'setDuelBet': return Number.isInteger(c.amount) && (c.amount as number)>=0;
    case 'resolveDuel': return c.winnerId===null || str(c.winnerId);
    case 'discardPower': case 'useItem': return str(c.uid);
    case 'choosePath': return str(c.nodeId);
    case 'buyItem': return str(c.itemId, 24) && (c.discardUid === undefined || str(c.discardUid));
    case 'chooseDice': return Number.isInteger(c.value);
    case 'stealItem': return str(c.targetId);
    case 'submitCardCode': return str(c.code, 24);
    case 'chooseTarget': return str(c.targetId);
    case 'resolveDefense': return ['block', 'reverse', 'none'].includes(c.choice as string) && (c.uid === undefined || str(c.uid));
    case 'setTeams': return Array.isArray(c.teams) && c.teams.length <= 10 && c.teams.every(idList);
    case 'submitResults':
      return str(c.resultId) && (c.format === 'individual' || c.format === 'teams')
        && (c.ranking === undefined || (Array.isArray(c.ranking) && c.ranking.length <= 10 && c.ranking.every(idList)))
        && (c.winningTeam === undefined || Number.isInteger(c.winningTeam));
    case 'manualAdjust':
      return str(c.playerId) && Number.isFinite(c.common) && Number.isFinite(c.golden)
        && (c.common as number) >= 0 && (c.golden as number) >= 0 && (c.common as number) < 100000 && (c.golden as number) < 1000
        && typeof c.reason === 'string' && c.reason.trim().length > 0 && c.reason.length <= 120;
    default: return true;
  }
}

export function startBoard(players: RemotePlayer[], seed: number, matchId: string, previousSeq: number, at: number): BoardState {
  const seeds: PlayerSeed[] = players.map((p, i) => ({
    id: p.id, name: p.name,
    color: DEFAULT_COLORS[i % DEFAULT_COLORS.length],
    symbol: DEFAULT_SYMBOLS[i % DEFAULT_SYMBOLS.length],
    portrait: p.portrait ?? PORTRAITS[i % PORTRAITS.length],
  }));
  // Mesmas regras, configuração e mapa do jogo local. IDs do motor = IDs da sala.
  const game = createGame(seeds, {}, { seed, shuffleOrder: true });
  const board: BoardState = {
    matchId, game, paused: false, itemDeadline: null, pausedItemMs: null,
    presentation: null, presentationItemMs: null,
    nextAutoAt: null, events: [], eventSeq: previousSeq, turn: 0,
  };
  openPresentation(board, selectHostAudioCue(null, game, []), at);
  return board;
}

function openPresentation(
  board: BoardState,
  cue: ReturnType<typeof selectHostAudioCue>,
  at: number,
) {
  if (!cue || board.presentation || !Number.isFinite(cue.durationMs) || cue.durationMs <= 0) return;
  if (board.game.phase === 'itemWindow' && board.itemDeadline !== null) {
    board.presentationItemMs = Math.max(0, board.itemDeadline - at);
    board.itemDeadline = null;
  }
  board.presentation = {
    id: `${board.matchId}-${board.game.revision}-${board.eventSeq}`,
    clip: cue.clip,
    durationMs: cue.durationMs,
    expiresAt: at + cue.durationMs + PRESENTATION_GRACE_MS,
    playerIds: [...cue.playerIds],
  };
}

/** Conclusão exata: uma resposta atrasada nunca encerra a apresentação seguinte. */
export function finishBoardPresentation(board: BoardState, presentationId: string, at: number): boolean {
  if (!board.presentation || board.presentation.id !== presentationId) return false;
  board.presentation = null;
  const itemMs = board.presentationItemMs;
  board.presentationItemMs = null;
  if (itemMs !== null && itemMs !== undefined && board.game.phase === 'itemWindow') {
    if (board.paused) board.pausedItemMs = itemMs;
    else board.itemDeadline = at + itemMs;
  }
  // A apresentação já ocupou o intervalo visual. Libera só o passo seguinte,
  // sem recuperar em sequência os prazos que venceram durante o áudio.
  if (nextBoardCommand(board.game)) board.nextAutoAt = at;
  return true;
}

function expirePresentation(board: BoardState, now: number): boolean {
  const presentation = board.presentation;
  return Boolean(presentation && presentation.expiresAt <= now
    && finishBoardPresentation(board, presentation.id, now));
}

function nextBoardCommand(game: GameState): Command | null {
  if(game.pending) return nextAutoCommand(game);
  if (game.map.stops) {
    if (game.phase === 'roundReady') return { type: 'startRound' };
    if (game.phase === 'roundEnd') return { type: 'nextRound' };
    if (game.phase === 'minigameIntro') return { type: 'startMinigame' };
  }
  return nextAutoCommand(game);
}

/** Quanto esperar antes do próximo passo automático, para a TV mostrar cada momento. */
function delayAfter(game: GameState, events: DomainEvent[]): number {
  if(game.pending?.kind==='cardPreview') return CARD_REVEAL_MS;
  if(game.pending?.kind==='harvest') return 3000;
  if (events.some(e => e.type === 'diceRolled')) return 1800;
  if (events.some(e => e.type === 'goldenBananaPurchased' || e.type === 'cardResolved')) return 2200;
  switch (game.phase) {
    case 'roundReady': case 'roundEnd': case 'minigameIntro': return 5000;
    case 'turnStart': return 1600;
    case 'moving': return 550;
    case 'resolvingSpace': return 800;
    case 'turnEnd': return 1800;
    default: return 600;
  }
}

/**
 * Executa um comando no motor e agenda o que vem depois. Retorna o motivo da
 * recusa, sem alterar nada, quando o motor rejeita.
 */
export function applyToBoard(
  board: BoardState,
  command: Command,
  at: number,
  byHost: boolean,
  presentationAt = at,
): string | null {
  const before = board.game;
  const result = applyCommand(before, { commandId: `srv-${before.revision}-${command.type}`, expectedRevision: before.revision, command });
  if (result.rejected) return result.rejected;
  board.game = result.state;
  for (const event of result.events) {
    board.eventSeq += 1;
    board.events.push({ seq: board.eventSeq, matchId: board.matchId, event, byHost });
    if (event.type === 'turnStarted') board.turn += 1;
  }
  if (board.events.length > 60) board.events.splice(0, board.events.length - 60);
  const cue = selectHostAudioCue(before, board.game, result.events);
  if (board.game.phase === 'itemWindow') {
    if (before.phase !== 'itemWindow') {
      // Uma apresentação recuperada começa no relógio observado, então a
      // janela de item posterior também recebe seu prazo integral.
      board.itemDeadline = (cue ? presentationAt : at) + board.game.config.itemWindowMs;
    }
  } else board.itemDeadline = null;
  board.nextAutoAt = nextBoardCommand(board.game) ? at + delayAfter(board.game, result.events) : null;
  openPresentation(board, cue, presentationAt);
  return null;
}

/**
 * Avanço por prazos verificados: chamado em cada leitura/comando, sob CAS.
 * Para no dado (espera o celular), em decisões humanas e na pausa.
 */
export function advanceBoard(board: BoardState, now: number): boolean {
  let changed = expirePresentation(board, now);
  if (board.paused || board.presentation) return changed;
  if(board.game.map.stops && board.game.config.cardMode==='digital' && board.game.catalogVersion!==2){
    board.game.catalogVersion=2;board.game.cardDecks={};board.game.config.shopItems=[...DEFAULT_CONFIG.shopItems];
    if(board.game.pending?.kind==='shop')board.game.pending.items=[...DEFAULT_CONFIG.shopItems];
    board.game.revision++;changed=true;
  }
  for (let i = 0; i < MAX_STEPS_PER_REQUEST; i++) {
    const game = board.game;
    if (game.phase === 'itemWindow') {
      if (board.itemDeadline === null) { board.itemDeadline = now + game.config.itemWindowMs; return true; }
      if (board.itemDeadline > now) break;
      if (applyToBoard(board, { type: 'itemWindowExpired' }, Math.max(board.itemDeadline, now - MAX_CATCH_UP_MS), false, now)) break;
      changed = true;
      if (board.presentation) break;
      continue;
    }
    const command = nextBoardCommand(game);
    // No modo remoto o dado nunca é automático: o jogador rola no celular.
    if (!command || command.type === 'rollDice') break;
    if (board.nextAutoAt === null) { board.nextAutoAt = now + delayAfter(game, []); changed = true; break; }
    if (board.nextAutoAt > now) break;
    if (applyToBoard(board, command, Math.max(board.nextAutoAt, now - MAX_CATCH_UP_MS), false, now)) break;
    if(board.game.pending?.kind==='cardPreview')board.nextAutoAt=now+CARD_REVEAL_MS;
    changed = true;
    if (board.presentation) break;
  }
  return changed;
}

export function pauseBoard(board: BoardState, now: number) {
  board.paused = true;
  if (!board.presentation) {
    board.pausedItemMs = board.itemDeadline === null ? null : Math.max(0, board.itemDeadline - now);
    board.itemDeadline = null;
  }
}
export function resumeBoard(board: BoardState, now: number) {
  board.paused = false;
  // A janela retoma com o tempo que restava: a pausa não consome prazo.
  if (board.game.phase === 'itemWindow' && !board.presentation) {
    board.itemDeadline = now + (board.pausedItemMs ?? board.game.config.itemWindowMs);
  }
  board.pausedItemMs = null;
  if (nextBoardCommand(board.game)) board.nextAutoAt = now + delayAfter(board.game, []);
}

export const activeId = (game: GameState) => game.order[game.activeIndex] ?? null;

/** Projeção explícita: somente campos públicos. Semente e cursor do sorteio ficam no servidor. */
export function boardView(board: BoardState): BoardView {
  const { rngSeed: _seed, rngCursor: _cursor, cardDecks: _decks, ...rest } = board.game;
  const game: PublicGame = { ...rest, history: rest.history.slice(-40) };
  return {
    matchId: board.matchId, game, paused: board.paused,
    itemDeadline: board.itemDeadline, pausedItemMs: board.pausedItemMs,
    presentation: board.presentation ?? null,
    events: board.events.slice(-30),
  };
}
