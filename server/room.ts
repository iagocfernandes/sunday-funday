import { validPortrait } from './portrait.js';
import { createHash, randomInt, randomUUID } from 'node:crypto';
import type { RemoteCommand, RoomMode, RoomReply, RoomView } from '../src/remote/types';
import { activeId, advanceBoard, applyToBoard, boardView, finishBoardPresentation, pauseBoard, resumeBoard, startBoard, validGameCommand, type BoardState } from './board.js';

export class RoomError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export interface StoredRoom extends Omit<RoomView, 'mode' | 'board'> {
  /** Ausente em salas antigas: continuam sendo o teste de dados. */
  mode?: RoomMode;
  board?: BoardState | null;
  hostHash: string;
  credentials: Record<string, string>;
  accepted: { id: string; actor: string }[];
}
export interface RoomStore {
  get(code: string): Promise<StoredRoom | null>;
  create(room: StoredRoom): Promise<boolean>;
  compareAndSet(before: StoredRoom, after: StoredRoom): Promise<boolean>;
}
export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
export function validCode(code: unknown): asserts code is string {
  if (typeof code !== 'string' || !/^[A-HJ-NP-Z2-9]{6}$/.test(code)) throw new RoomError(400, 'Informe o código de seis caracteres da sala.');
}
export function validToken(token: unknown): asserts token is string {
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) throw new RoomError(401, 'Entre novamente na sala neste aparelho.');
}
export function identify(room: StoredRoom, token: string) {
  validToken(token);
  const hash = hashToken(token);
  if (room.hostHash === hash) return { role: 'host' as const, playerId: null };
  const playerId = Object.keys(room.credentials).find(id => room.credentials[id] === hash);
  if (!playerId) throw new RoomError(403, 'Este aparelho não está conectado à sala.');
  return { role: 'player' as const, playerId };
}
/** Lista explícita do que sai do servidor. Credenciais, recibos e RNG nunca entram. */
export function publicView(room: StoredRoom): RoomView {
  return {
    code: room.code, revision: room.revision, mode: room.mode ?? 'dice', phase: room.phase,
    players: room.players.map(p => ({ id: p.id, name: p.name })), activePlayerId: room.activePlayerId,
    turn: room.turn, round: room.round, rounds: room.rounds, diceMax: room.diceMax,
    lastRoll: room.lastRoll, rolls: room.rolls, advanceAt: room.advanceAt, expiresAt: room.expiresAt,
    board: room.board ? boardView(room.board) : null,
  };
}
export function reply(room: StoredRoom, token: string, now = Date.now()): RoomReply {
  return { room: publicView(room), ...identify(room, token), serverNow: now };
}
/** Espelha no nível da sala o que o motor decidiu (vez, rodada, término). */
function syncBoard(room: StoredRoom) {
  const board = room.board;
  if (!board) return;
  room.activePlayerId = activeId(board.game);
  room.round = board.game.round; room.rounds = board.game.config.rounds; room.turn = board.turn;
  if (board.game.phase === 'finished') room.phase = 'finished';
}
export function settle(room: StoredRoom, now: number): StoredRoom {
  if (room.mode === 'board') {
    // A apresentação final ainda precisa concluir ou expirar depois que o
    // motor marcou a sala como finished.
    if ((room.phase !== 'playing' && room.phase !== 'finished') || !room.board) return room;
    const next = structuredClone(room);
    if (!advanceBoard(next.board!, now)) return room;
    syncBoard(next); next.revision += 1;
    return next;
  }
  if (room.phase !== 'playing' || room.advanceAt === null || room.advanceAt > now) return room;
  const next = structuredClone(room);
  next.advanceAt = null;
  const current = next.players.findIndex(p => p.id === next.activePlayerId);
  if (current === next.players.length - 1 && next.round === next.rounds) {
    next.phase = 'finished'; next.activePlayerId = null;
  } else {
    next.turn += 1;
    if (current === next.players.length - 1) next.round += 1;
    next.activePlayerId = next.players[(current + 1) % next.players.length].id;
  }
  next.revision += 1;
  return next;
}
export class RoomService {
  constructor(private store: RoomStore, private now = () => Date.now(), private dice = () => randomInt(1, 11), private seed = () => randomInt(0, 0xffffffff)) {}
  async create(code: string, token: string, mode: unknown = 'dice'): Promise<RoomReply> {
    validCode(code); validToken(token);
    if (mode !== 'dice' && mode !== 'board') throw new RoomError(400, 'Modo de sala inválido.');
    const room: StoredRoom = {
      code, revision: 0, mode, board: null, phase: 'lobby', players: [], activePlayerId: null,
      turn: 0, round: 1, rounds: 3, diceMax: 10, lastRoll: null, rolls: [], advanceAt: null,
      expiresAt: this.now() + 12 * 60 * 60 * 1000,
      hostHash: hashToken(token), credentials: {}, accepted: [],
    };
    if (await this.store.create(room)) return reply(room, token, this.now());
    const existing = await this.store.get(code);
    if (existing?.hostHash === room.hostHash) return reply(existing, token, this.now());
    throw new RoomError(409, 'Código já utilizado. Crie outra sala.');
  }
  async read(code: string, token: string): Promise<RoomReply> {
    validCode(code); validToken(token);
    for (let retry = 0; retry < 12; retry++) {
      const room = await this.store.get(code);
      if (!room || room.expiresAt <= this.now()) throw new RoomError(404, 'Sala não encontrada ou expirada.');
      identify(room, token);
      const next = settle(room, this.now());
      if (next === room || await this.store.compareAndSet(room, next)) return reply(next, token, this.now());
    }
    throw new RoomError(409, 'A sala está atualizando. Tente novamente.');
  }
  async command(code: string, token: string, id: string, command: RemoteCommand): Promise<RoomReply> {
    validCode(code); validToken(token);
    if (typeof id !== 'string' || !/^[a-zA-Z0-9-]{12,80}$/.test(id)) throw new RoomError(400, 'Identificador de ação inválido.');
    if (!command || typeof command !== 'object' || !['join', 'start', 'roll', 'restart', 'pause', 'resume', 'finishPresentation', 'game'].includes(command.type)) throw new RoomError(400, 'Ação inválida.');
    const actor = hashToken(token);
    for (let retry = 0; retry < 12; retry++) {
      const previous = await this.store.get(code);
      if (!previous || previous.expiresAt <= this.now()) throw new RoomError(404, 'Sala não encontrada ou expirada.');
      // Repetição do mesmo ID devolve o estado atual, sem reaplicar.
      if (previous.accepted.some(a => a.id === id && a.actor === actor)) return reply(previous, token, this.now());
      const next = structuredClone(settle(previous, this.now()));
      if (command.type === 'join') {
        if (next.hostHash === actor) throw new RoomError(400, 'Use outro aparelho ou aba de jogador para entrar.');
        const existing = Object.keys(next.credentials).find(pid => next.credentials[pid] === actor);
        if (existing) return reply(next, token, this.now());
        if (next.phase !== 'lobby') throw new RoomError(409, 'O teste já começou. Peça ao anfitrião para abrir um novo teste.');
        if (next.players.length >= 10) throw new RoomError(409, 'Esta sala já tem dez jogadores.');
        if (typeof command.name !== 'string') throw new RoomError(400, 'Informe seu nome.');
        const name = command.name.trim().replace(/\s+/g, ' ');
        if (!name || name.length > 24 || /[\x00-\x1f\x7f]/.test(name)) throw new RoomError(400, 'Use um nome de 1 a 24 caracteres.');
        if (next.players.some(p => p.name.toLocaleLowerCase('pt-BR') === name.toLocaleLowerCase('pt-BR'))) throw new RoomError(409, 'Esse nome já entrou. Use outro nome ou o aparelho original.');
        if(command.portrait!==undefined&&!validPortrait(command.portrait))throw new RoomError(400,'Foto inválida. Escolha novamente.');
        const pid = randomUUID(); next.players.push({ id: pid, name, ...(command.portrait?{portrait:command.portrait}:{}) }); next.credentials[pid] = actor;
      } else {
        const identity = identify(next, token);
        if (command.type === 'start') {
          if (identity.role !== 'host') throw new RoomError(403, 'Somente o anfitrião pode iniciar.');
          if (next.phase !== 'lobby') throw new RoomError(409, 'O teste já foi iniciado.');
          if (next.players.length < 2) throw new RoomError(409, 'Conecte pelo menos dois jogadores.');
          next.phase = 'playing'; next.turn += 1; next.activePlayerId = next.players[0].id;
          if (next.mode === 'board') {
            // Participantes congelados; nova identidade de partida invalida ações antigas.
            next.board = startBoard(next.players, this.seed(), randomUUID(), next.board?.eventSeq ?? 0, this.now());
            syncBoard(next);
          }
        } else if (command.type === 'restart') {
          if (identity.role !== 'host') throw new RoomError(403, 'Somente o anfitrião pode reiniciar.');
          next.phase = 'lobby'; next.round = 1; next.activePlayerId = null; next.lastRoll = null; next.rolls = []; next.advanceAt = null;
          // Monotonic turn prevents an old click being accepted in a restarted test.
          next.turn += 1;
          next.board = null;
        } else if (next.mode === 'board') {
          this.boardCommand(next, identity, id, command);
        } else {
          if (command.type !== 'roll') throw new RoomError(400, 'Ação inválida para esta sala.');
          if (next.phase !== 'playing' || next.advanceAt !== null) throw new RoomError(409, 'Aguarde a próxima vez. Este dado já foi registrado.');
          if (!Number.isInteger(command.turn) || command.turn !== next.turn) throw new RoomError(409, 'Essa vez já passou. A tela será atualizada.');
          if (identity.role !== 'host' && identity.playerId !== next.activePlayerId) throw new RoomError(403, 'Aguarde: agora é a vez de outro jogador.');
          const player = next.players.find(p => p.id === next.activePlayerId)!;
          const value = this.dice();
          if (!Number.isInteger(value) || value < 1 || value > 10) throw new Error('Invalid server dice');
          next.lastRoll = { id, turn: next.turn, round: next.round, playerId: player.id, playerName: player.name, value, at: this.now(), byHost: identity.role === 'host' };
          next.rolls.push(next.lastRoll); next.advanceAt = this.now() + 2500;
        }
      }
      next.revision += 1;
      next.accepted = [...next.accepted, { id, actor }].slice(-150);
      if (await this.store.compareAndSet(previous, next)) return reply(next, token, this.now());
    }
    throw new RoomError(409, 'Outra ação está sendo registrada. Tente novamente.');
  }
  /** Autorização por identidade + contexto (partida, vez, revisão) antes de tocar no motor. */
  private boardCommand(room: StoredRoom, identity: ReturnType<typeof identify>, id: string, command: RemoteCommand) {
    const board = room.board;
    if (!board) throw new RoomError(409, 'A partida não está em andamento.');
    if (command.type === 'join' || command.type === 'start' || command.type === 'restart') throw new RoomError(400, 'Ação inválida.');
    if (command.matchId !== board.matchId) throw new RoomError(409, 'Essa ação é de uma partida anterior. A tela será atualizada.');
    const now = this.now();
    if (command.type === 'finishPresentation') {
      if (identity.role !== 'host') throw new RoomError(403, 'Somente o anfitrião pode concluir a apresentação.');
      if (typeof command.presentationId !== 'string' || command.presentationId.length < 1 || command.presentationId.length > 160) {
        throw new RoomError(400, 'Identificador de apresentação inválido.');
      }
      finishBoardPresentation(board, command.presentationId, now);
      syncBoard(room); return;
    }
    if (room.phase !== 'playing') throw new RoomError(409, 'A partida não está em andamento.');
    if (command.type === 'pause' || command.type === 'resume') {
      if (identity.role !== 'host') throw new RoomError(403, 'Somente o anfitrião pode pausar.');
      if (command.type === 'pause' && !board.paused) pauseBoard(board, now);
      if (command.type === 'resume' && board.paused) resumeBoard(board, now);
      syncBoard(room); return;
    }
    if (board.paused) throw new RoomError(409, 'Jogo pausado pelo anfitrião.');
    if (board.presentation) throw new RoomError(409, 'Aguarde a apresentação terminar na TV.');
    if (command.type === 'roll') {
      if (!Number.isInteger(command.turn) || command.turn !== board.turn) throw new RoomError(409, 'Essa vez já passou. A tela será atualizada.');
      if (identity.role !== 'host' && identity.playerId !== activeId(board.game)) throw new RoomError(403, 'Aguarde: agora é a vez de outro jogador.');
      if (board.game.phase !== 'readyToRoll' || board.game.pending) throw new RoomError(409, board.game.phase === 'itemWindow' ? 'Aguarde a janela de item na TV.' : 'O dado não está liberado agora.');
      const refused = applyToBoard(board, { type: 'rollDice' }, now, identity.role === 'host');
      if (refused) throw new RoomError(409, refused);
      if (identity.role === 'host') {
        const g = board.game;
        g.history.push({ id: `host-${id}`, round: g.round, playerId: activeId(g) ?? undefined, text: `Anfitrião rolou o dado por ${g.players[activeId(g)!].name}.`, kind: 'manual' });
      }
      syncBoard(room); return;
    }
    if (identity.role !== 'host') {
      const pending = board.game.pending;
      const owner = pending?.kind === 'defense' ? pending.targetId : pending?.playerId;
      const allowed: Record<string, string[]> = {
        discardPower:['discardPower'], iagugu: ['rob','skipIagugu'], duelBet:['setDuelBet'], duelResult:[],
        path: ['choosePath'], shop: ['buyItem', 'skipShop'], pedestal: ['buyGolden', 'skipPedestal'],
        harvest: ['continueHarvest'], itemChoice: ['useItem', 'cancelItemChoice'],
        chooseDice: ['chooseDice'], stealItem: ['stealItem'],
        cardCode: ['submitCardCode'], cardPreview: ['confirmCard', ...(board.game.config.cardMode === 'physical' ? ['cancelCard'] : [])],
        target: ['chooseTarget', 'cancelTarget'], defense: ['resolveDefense'],
      };
      const itemWindow = board.game.phase === 'itemWindow' && identity.playerId === activeId(board.game)
        && ['requestItemChoice', 'itemWindowExpired'].includes(command.command?.type);
      if (!itemWindow && (!pending || owner !== identity.playerId || !allowed[pending.kind]?.includes(command.command?.type))) {
        throw new RoomError(403, 'Esta decisão não pertence a este jogador.');
      }
    }
    if (!Number.isInteger(command.revision) || command.revision !== board.game.revision) throw new RoomError(409, 'A partida mudou. Confira a tela e tente novamente.');
    if (!validGameCommand(command.command)) throw new RoomError(400, 'Ação de jogo inválida.');
    const refused = applyToBoard(board, command.command, now, identity.role === 'host');
    if (refused) throw new RoomError(409, refused);
    syncBoard(room);
  }
}
