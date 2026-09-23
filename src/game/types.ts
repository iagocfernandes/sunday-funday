/** Tipos do domínio. O motor é puro: não conhece React, DOM nem timers. */

export const SCHEMA_VERSION = 3;

export type NodeKind =
  | 'start'
  | 'plus'
  | 'minus'
  | 'luck'
  | 'unluck'
  | 'shop'
  | 'pedestal'
  | 'thief'
  | 'blank';

export interface BoardNode {
  id: string;
  kind: NodeKind;
  /** Coordenadas normalizadas 0..1 (adaptam a qualquer tamanho de tela). */
  x: number;
  y: number;
  /** Conexões de saída (sentido do movimento). Mais de uma = bifurcação. */
  next: string[];
  label?: string;
}

export interface BoardMap {
  id: string;
  nodes: Record<string, BoardNode>;
  startNodeId: string;
  /** Locais possíveis do pedestal da banana dourada. */
  pedestalSpots: string[];
}

export type ItemId = 'dadoDuplo' | 'escudo' | 'casca' | 'reverse';

export interface ItemDef {
  id: ItemId;
  name: string;
  price: number;
  description: string;
  /** Item ativo utilizável abre a janela de 5 s. Defensivo não abre. */
  usage: 'active' | 'defensive';
  icon: string;
}

export type CardCategory = 'luck' | 'unluck';

export type CardEffectType =
  | 'gainCommon'
  | 'loseCommon'
  | 'grantItem'
  | 'moveBack'
  | 'attackCommon';

export interface CardDef {
  id: string;
  code: string;
  title: string;
  category: CardCategory;
  description: string;
  effectType: CardEffectType;
  amount: number;
  grantsItem?: ItemId;
  targetRule: 'self' | 'otherPlayer';
  blockable: boolean;
  reversible: boolean;
  presentationKey: string;
}

export interface MinigameDef {
  id: string;
  name: string;
  format: 'individual' | 'teams';
  description: string;
  icon: string;
}

export interface RewardTable {
  individual: { first: number; second: number; others: number };
  teams: { winner: number; loser: number; draw: number };
}

export interface GameConfig {
  rounds: number;
  diceMin: number;
  diceMax: number;
  startingCommon: number;
  goldenPrice: number;
  plusAmount: number;
  minusAmount: number;
  inventoryLimit: number;
  activeItemsPerTurn: number;
  itemWindowMs: number;
  thiefEnabled: boolean;
  rewards: RewardTable;
  shopItems: ItemId[];
  minigameOrder: string[];
  cardMode: 'physical';
}

export interface PlayerItem {
  /** ID único da cópia no inventário: impede consumo duplicado. */
  uid: string;
  itemId: ItemId;
}

export interface Player {
  id: string;
  name: string;
  color: string;
  symbol: string;
  portrait: string;
  nodeId: string;
  common: number;
  golden: number;
  inventory: PlayerItem[];
  /** Histórico real de nós percorridos (usado por recuo). */
  stepHistory: string[];
}

export type Phase =
  | 'setup'
  | 'roundReady'
  | 'turnStart'
  | 'itemWindow'
  | 'awaitingItemChoice'
  | 'readyToRoll'
  | 'moving'
  | 'awaitingPath'
  | 'awaitingInteraction'
  | 'resolvingSpace'
  | 'turnEnd'
  | 'minigameIntro'
  | 'awaitingResults'
  | 'roundEnd'
  | 'finished';

export type Pending =
  | { kind: 'path'; playerId: string; options: string[] }
  | { kind: 'shop'; playerId: string; nodeId: string; items: ItemId[] }
  | { kind: 'pedestal'; playerId: string; nodeId: string; price: number }
  | { kind: 'cardCode'; playerId: string; category: CardCategory }
  | {
      kind: 'cardPreview';
      playerId: string;
      cardId: string;
      category: CardCategory;
    }
  | {
      kind: 'target';
      playerId: string;
      source: { type: 'item'; uid: string } | { type: 'card'; cardId: string };
      candidates: string[];
      amount: number;
      resume: 'readyToRoll' | 'turnEnd';
    }
  | {
      kind: 'defense';
      attackerId: string;
      targetId: string;
      amount: number;
      /** Itens defensivos disponíveis no alvo. */
      options: PlayerItem[];
      blockable: boolean;
      reversible: boolean;
      source: { type: 'item'; uid: string } | { type: 'card'; cardId: string };
      resume: 'readyToRoll' | 'turnEnd';
    }
  | { kind: 'itemChoice'; playerId: string };

export interface Movement {
  remaining: number;
  /** Nós já atravessados neste deslocamento (para o traço no mapa). */
  traversed: string[];
  /** Movimento por carta não ativa passagem nem destino. */
  activatesSpaces: boolean;
  direction: 'forward' | 'back';
}

export interface MinigameRoundState {
  minigameId: string;
  /** Equipes: lista de listas de playerIds. Individual: vazio. */
  teams: string[][];
  applied: boolean;
  /** ID da submissão aplicada, para rejeitar confirmação duplicada. */
  appliedResultId?: string;
}

export interface MinigameResultRecord {
  round: number;
  minigameId: string;
  format: 'individual' | 'teams';
  /** playerId -> bananas ganhas */
  awards: Record<string, number>;
  /** Ordem/posições informadas pelo anfitrião. */
  detail: string;
}

export interface HistoryEntry {
  id: string;
  round: number;
  playerId?: string;
  text: string;
  kind: 'info' | 'money' | 'golden' | 'card' | 'minigame' | 'manual' | 'system';
}

export interface ItemWindowState {
  playerId: string;
  remainingMs: number;
}

export interface GameState {
  schemaVersion: number;
  gameId: string;
  createdAt: number;
  config: GameConfig;
  map: BoardMap;
  phase: Phase;
  round: number;
  order: string[];
  activeIndex: number;
  players: Record<string, Player>;
  dice: number | null;
  /** Multiplicador aplicado ao próximo dado (item dado duplo). */
  diceMultiplier: number;
  movement: Movement | null;
  pending: Pending | null;
  itemWindow: ItemWindowState | null;
  pedestalNodeId: string;
  /** Guardas por turno. */
  goldenBoughtThisTurn: boolean;
  activeItemsUsedThisTurn: number;
  shopUsedNodes: string[];
  minigame: MinigameRoundState | null;
  results: MinigameResultRecord[];
  history: HistoryEntry[];
  revision: number;
  rngSeed: number;
  rngCursor: number;
  /** Avisos não bloqueantes para a barra de status. */
  notice: string | null;
  finishedAt: number | null;
}

/* ---------- Comandos ---------- */

export type Command =
  | { type: 'startRound' }
  | { type: 'beginTurn' }
  | { type: 'openItemWindow' }
  | { type: 'itemWindowExpired' }
  | { type: 'requestItemChoice' }
  | { type: 'cancelItemChoice' }
  | { type: 'useItem'; uid: string }
  | { type: 'rollDice' }
  | { type: 'step' }
  | { type: 'choosePath'; nodeId: string }
  | { type: 'buyItem'; itemId: ItemId }
  | { type: 'skipShop' }
  | { type: 'buyGolden' }
  | { type: 'skipPedestal' }
  | { type: 'submitCardCode'; code: string }
  | { type: 'confirmCard' }
  | { type: 'cancelCard' }
  | { type: 'chooseTarget'; targetId: string }
  | { type: 'cancelTarget' }
  | { type: 'resolveDefense'; choice: 'block' | 'reverse' | 'none'; uid?: string }
  | { type: 'resolveSpace' }
  | { type: 'endTurn' }
  | { type: 'startMinigame' }
  | { type: 'setTeams'; teams: string[][] }
  | {
      type: 'submitResults';
      resultId: string;
      format: 'individual' | 'teams';
      /** individual: playerIds em ordem de colocação, com empates na mesma posição */
      ranking?: string[][];
      /** teams: índice da equipe vencedora, ou -1 para empate */
      winningTeam?: number;
    }
  | { type: 'nextRound' }
  | { type: 'manualAdjust'; playerId: string; common: number; golden: number; reason: string }
  | { type: 'dismissNotice' };

export interface CommandEnvelope {
  commandId: string;
  expectedRevision: number;
  command: Command;
}

/* ---------- Eventos de domínio (alimentam a apresentação) ---------- */

export type DomainEvent =
  | { type: 'roundStarted'; round: number }
  | { type: 'turnStarted'; playerId: string }
  | { type: 'diceRolled'; playerId: string; value: number; doubled: boolean }
  | { type: 'movementFinished'; playerId: string; nodeId: string }
  | { type: 'coinsChanged'; playerId: string; delta: number; reason: string }
  | { type: 'itemGranted'; playerId: string; itemId: ItemId }
  | { type: 'itemUsed'; playerId: string; itemId: ItemId }
  | { type: 'cardResolved'; playerId: string; cardId: string }
  | { type: 'attackResolved'; attackerId: string; targetId: string; amount: number }
  | { type: 'attackBlocked'; attackerId: string; targetId: string }
  | { type: 'attackReversed'; attackerId: string; targetId: string; amount: number }
  | { type: 'goldenBananaPurchased'; playerId: string }
  | { type: 'turnEnded'; playerId: string }
  | { type: 'minigameStarted'; minigameId: string }
  | { type: 'minigameCompleted'; minigameId: string; winners: string[] }
  | { type: 'roundEnded'; round: number }
  | { type: 'gameCompleted'; winners: string[] };

export interface CommandResult {
  state: GameState;
  events: DomainEvent[];
  /** Quando o comando foi rejeitado, o estado volta idêntico. */
  rejected?: string;
}
