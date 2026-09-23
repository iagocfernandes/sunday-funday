import { validateMap } from '../data/map';
import type { GameState } from '../game/types';
import { SCHEMA_VERSION } from '../game/types';

const KEY_CURRENT = 'sundayfunday:current';
const KEY_PREVIOUS = 'sundayfunday:previous';
const KEY_UNDO = 'sundayfunday:undo';
const KEY_LOCK = 'sundayfunday:lock';

export interface Snapshot {
  schemaVersion: number;
  savedAt: number;
  state: GameState;
  /** Estado de controle recuperável: recarga sempre volta em pausa manual. */
  control: PersistedControl;
}

export interface PersistedControl {
  itemWindowRemainingMs: number | null;
  speed: 'normal' | 'fast';
}

export type SaveStatus =
  | { ok: true; savedAt: number }
  | { ok: false; error: string };

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function saveSnapshot(state: GameState, control: PersistedControl): SaveStatus {
  const store = storage();
  if (!store) return { ok: false, error: 'Armazenamento local indisponível neste navegador.' };
  const snapshot: Snapshot = {
    schemaVersion: SCHEMA_VERSION,
    savedAt: Date.now(),
    state,
    control,
  };
  try {
    const current = store.getItem(KEY_CURRENT);
    if (current) store.setItem(KEY_PREVIOUS, current);
    store.setItem(KEY_CURRENT, JSON.stringify(snapshot));
    return { ok: true, savedAt: snapshot.savedAt };
  } catch (error) {
    return {
      ok: false,
      error: `Falha ao salvar (${(error as Error).name}). Exporte um backup agora.`,
    };
  }
}

export function loadSnapshot(): Snapshot | null {
  const store = storage();
  if (!store) return null;
  const raw = store.getItem(KEY_CURRENT);
  if (!raw) return null;
  try {
    return migrate(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function hasSavedGame(): boolean {
  return loadSnapshot() !== null;
}

export function clearSaved(): void {
  const store = storage();
  if (!store) return;
  store.removeItem(KEY_CURRENT);
  store.removeItem(KEY_PREVIOUS);
  store.removeItem(KEY_UNDO);
}

/* ---------------- Pilha de desfazer ---------------- */

export function pushUndo(state: GameState): void {
  const store = storage();
  if (!store) return;
  try {
    const stack: GameState[] = JSON.parse(store.getItem(KEY_UNDO) ?? '[]');
    stack.push(state);
    while (stack.length > 30) stack.shift();
    store.setItem(KEY_UNDO, JSON.stringify(stack));
  } catch {
    /* pilha de desfazer é best-effort */
  }
}

export function popUndo(): GameState | null {
  const store = storage();
  if (!store) return null;
  try {
    const stack: GameState[] = JSON.parse(store.getItem(KEY_UNDO) ?? '[]');
    const state = stack.pop() ?? null;
    store.setItem(KEY_UNDO, JSON.stringify(stack));
    return state;
  } catch {
    return null;
  }
}

export function undoDepth(): number {
  const store = storage();
  if (!store) return 0;
  try {
    return (JSON.parse(store.getItem(KEY_UNDO) ?? '[]') as GameState[]).length;
  } catch {
    return 0;
  }
}

export function clearUndo(): void {
  storage()?.removeItem(KEY_UNDO);
}

/* ---------------- Migração de schema ---------------- */

export function migrate(snapshot: Snapshot): Snapshot | null {
  if (!snapshot || typeof snapshot !== 'object' || !snapshot.state) return null;
  if (snapshot.schemaVersion > SCHEMA_VERSION) return null; // arquivo de versão futura
  const state = snapshot.state;
  // Versões anteriores não existiram em produção; normalizamos campos ausentes.
  state.schemaVersion = SCHEMA_VERSION;
  state.notice = state.notice ?? null;
  state.shopUsedNodes = state.shopUsedNodes ?? [];
  state.results = state.results ?? [];
  state.history = state.history ?? [];
  snapshot.control = snapshot.control ?? { itemWindowRemainingMs: null, speed: 'normal' };
  return { ...snapshot, schemaVersion: SCHEMA_VERSION };
}

/* ---------------- Exportar / importar ---------------- */

export function exportSnapshot(state: GameState, control: PersistedControl): string {
  const snapshot: Snapshot = { schemaVersion: SCHEMA_VERSION, savedAt: Date.now(), state, control };
  return JSON.stringify(snapshot, null, 2);
}

export function downloadBackup(state: GameState, control: PersistedControl, tag = ''): void {
  const blob = new Blob([exportSnapshot(state, control)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `sunday-funday-${state.gameId}${tag ? `-${tag}` : ''}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export type ImportResult =
  | { ok: true; snapshot: Snapshot }
  | { ok: false; error: string };

/** Validação estrutural completa. Arquivo inválido não destrói a partida atual. */
export function parseImport(text: string): ImportResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: 'Arquivo não é um JSON válido.' };
  }
  const snapshot = raw as Snapshot;
  if (!snapshot || typeof snapshot !== 'object' || !snapshot.state) {
    return { ok: false, error: 'Arquivo não contém um estado de partida.' };
  }
  if (typeof snapshot.schemaVersion !== 'number') {
    return { ok: false, error: 'Arquivo sem versão de schema.' };
  }
  if (snapshot.schemaVersion > SCHEMA_VERSION) {
    return { ok: false, error: `Arquivo da versão ${snapshot.schemaVersion}; este app lê até ${SCHEMA_VERSION}.` };
  }

  const state = snapshot.state;
  const required: Array<keyof GameState> = ['gameId', 'config', 'map', 'phase', 'players', 'order', 'revision'];
  for (const key of required) {
    if (state[key] === undefined || state[key] === null) {
      return { ok: false, error: `Campo obrigatório ausente: ${String(key)}.` };
    }
  }
  if (!Array.isArray(state.order) || state.order.length === 0) {
    return { ok: false, error: 'Ordem de jogadores vazia.' };
  }
  for (const id of state.order) {
    if (!state.players[id]) return { ok: false, error: `Jogador ${id} referenciado mas ausente.` };
  }
  for (const player of Object.values(state.players)) {
    if (!state.map.nodes[player.nodeId]) {
      return { ok: false, error: `Jogador ${player.name} está numa casa inexistente.` };
    }
    if (player.common < 0 || player.golden < 0) {
      return { ok: false, error: `Saldo negativo em ${player.name}.` };
    }
  }
  if (!state.map.nodes[state.pedestalNodeId]) {
    return { ok: false, error: 'Pedestal em casa inexistente.' };
  }
  const validation = validateMap(state.map);
  if (!validation.ok) return { ok: false, error: `Mapa inválido: ${validation.errors[0]}` };

  const migrated = migrate(snapshot);
  if (!migrated) return { ok: false, error: 'Não foi possível migrar o arquivo.' };
  return { ok: true, snapshot: migrated };
}

/* ---------------- Bloqueio de abas ---------------- */

export interface TabLock {
  release(): void;
  /** true se outra aba já está editando esta partida. */
  conflicted: boolean;
}

export function acquireTabLock(gameId: string, sessionId: string): TabLock {
  const store = storage();
  if (!store) return { release: () => {}, conflicted: false };
  const now = Date.now();
  let conflicted = false;
  try {
    const raw = store.getItem(KEY_LOCK);
    if (raw) {
      const lock = JSON.parse(raw) as { gameId: string; sessionId: string; at: number };
      // Considera abandonado após 15 s sem renovação.
      if (lock.gameId === gameId && lock.sessionId !== sessionId && now - lock.at < 15000) {
        conflicted = true;
      }
    }
    if (!conflicted) store.setItem(KEY_LOCK, JSON.stringify({ gameId, sessionId, at: now }));
  } catch {
    /* sem bloqueio é melhor que travar a festa */
  }
  return {
    conflicted,
    release: () => {
      try {
        const raw = store.getItem(KEY_LOCK);
        if (raw && JSON.parse(raw).sessionId === sessionId) store.removeItem(KEY_LOCK);
      } catch {
        /* ignore */
      }
    },
  };
}

/** O anfitrião assume o controle explicitamente após um conflito de abas. */
export function forceTakeTabLock(gameId: string, sessionId: string): void {
  renewTabLock(gameId, sessionId);
}

export function renewTabLock(gameId: string, sessionId: string): void {
  const store = storage();
  if (!store) return;
  try {
    store.setItem(KEY_LOCK, JSON.stringify({ gameId, sessionId, at: Date.now() }));
  } catch {
    /* ignore */
  }
}
