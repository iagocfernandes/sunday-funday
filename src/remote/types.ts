import type { Command, DomainEvent, GameState } from '../game/types';

export interface RemotePlayer { id: string; name: string; portrait?: string; }
export interface RemoteRoll { id: string; turn: number; round: number; playerId: string; playerName: string; value: number; at: number; byHost: boolean; }
/** 'dice' = teste de três rodadas aprovado; 'board' = tabuleiro real com o motor no servidor. */
export type RoomMode = 'dice' | 'board';
/** Estado do motor sem semente/cursor do sorteio: nunca sai do servidor. */
export type PublicGame = Omit<GameState, 'rngSeed' | 'rngCursor' | 'cardDecks'>;
export interface RemoteEvent { seq: number; matchId: string; event: DomainEvent; byHost: boolean; }
export interface BoardPresentation {
  id: string;
  clip: string;
  durationMs: number;
  expiresAt: number;
  playerIds: string[];
}
export interface BoardView {
  /** Identidade da partida: muda a cada início, invalidando ações antigas. */
  matchId: string;
  game: PublicGame;
  paused: boolean;
  /** Prazo absoluto (relógio do servidor) da janela de item, se aberta e não pausada. */
  itemDeadline: number | null;
  /** Tempo restante preservado durante a pausa. */
  pausedItemMs: number | null;
  /** Áudio curto que pausa a progressão; ausente em snapshots de servidores antigos. */
  presentation?: BoardPresentation | null;
  events: RemoteEvent[];
}
export interface RoomView {
  code: string; revision: number; mode: RoomMode; phase: 'lobby' | 'playing' | 'finished';
  players: RemotePlayer[]; activePlayerId: string | null; turn: number; round: number;
  rounds: number; diceMax: number; lastRoll: RemoteRoll | null; rolls: RemoteRoll[];
  advanceAt: number | null; expiresAt: number;
  board: BoardView | null;
}
export interface RoomReply { room: RoomView; playerId: string | null; role: 'host' | 'player'; serverNow: number; }
export type RemoteCommand =
  | { type: 'join'; name: string; portrait?: string }
  | { type: 'start' }
  | { type: 'roll'; turn: number; matchId?: string }
  | { type: 'restart' }
  | { type: 'pause'; matchId: string }
  | { type: 'resume'; matchId: string }
  | { type: 'finishPresentation'; matchId: string; presentationId: string }
  /** Decisões do responsável ou do anfitrião, atreladas à partida e à revisão do motor. */
  | { type: 'game'; matchId: string; revision: number; command: Command };
