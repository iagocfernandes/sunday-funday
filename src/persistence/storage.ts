import type { GameState } from '../game/types';
import { SCHEMA_VERSION } from '../game/types';
import { validateGameState } from './validate';

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

export type LoadOrigin = 'current' | 'previous';

export interface LoadResult {
  snapshot: Snapshot;
  origin: LoadOrigin;
  /** Motivo pelo qual o snapshot atual foi descartado, quando houve recuperação. */
  recoveredFrom?: string;
}

function readKey(key: string): { snapshot: Snapshot } | { error: string } | null {
  const store = storage();
  if (!store) return null;
  const raw = store.getItem(key);
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { error: 'Arquivo salvo ilegível (JSON inválido).' };
  }
  const migrated = migrate(parsed as Snapshot);
  if (!migrated) return { error: 'Estado salvo de versão incompatível.' };
  // A mesma validação da importação: nada entra na partida sem passar por ela.
  const validation = validateGameState(migrated.state);
  if (!validation.ok) return { error: validation.errors[0] };
  return { snapshot: migrated };
}

/**
 * Carrega a partida salva. Se o snapshot atual estiver corrompido, recupera o
 * snapshot anterior válido. Nada é gravado aqui: recusar um estado nunca
 * substitui o último estado válido.
 */
export function loadSnapshotDetailed(): LoadResult | null {
  const current = readKey(KEY_CURRENT);
  if (current && 'snapshot' in current) return { snapshot: current.snapshot, origin: 'current' };

  const previous = readKey(KEY_PREVIOUS);
  if (previous && 'snapshot' in previous) {
    return {
      snapshot: previous.snapshot,
      origin: 'previous',
      recoveredFrom: current && 'error' in current ? current.error : 'Snapshot atual ausente.',
    };
  }
  return null;
}

export function loadSnapshot(): Snapshot | null {
  return loadSnapshotDetailed()?.snapshot ?? null;
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

/**
 * A pilha é vinculada a uma única partida. Trocar de partida (nova, importada
 * ou retomada de outro gameId) descarta a pilha antiga, para que Desfazer nunca
 * restaure o estado de outra partida.
 */
interface UndoStack {
  gameId: string;
  entries: GameState[];
}

function readUndoStack(): UndoStack | null {
  const store = storage();
  if (!store) return null;
  const raw = store.getItem(KEY_UNDO);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (
      typeof parsed !== 'object' || parsed === null ||
      typeof (parsed as UndoStack).gameId !== 'string' ||
      !Array.isArray((parsed as UndoStack).entries)
    ) {
      return null; // formato antigo ou corrompido: tratado como inexistente
    }
    return parsed as UndoStack;
  } catch {
    return null;
  }
}

export function pushUndo(state: GameState): void {
  const store = storage();
  if (!store) return;
  try {
    const existing = readUndoStack();
    const stack: UndoStack =
      existing && existing.gameId === state.gameId
        ? existing
        : { gameId: state.gameId, entries: [] };
    stack.entries.push(state);
    while (stack.entries.length > 30) stack.entries.shift();
    store.setItem(KEY_UNDO, JSON.stringify(stack));
  } catch {
    /* pilha de desfazer é best-effort */
  }
}

/** Só devolve um estado da MESMA partida; qualquer outro é descartado. */
export function popUndo(gameId: string): GameState | null {
  const store = storage();
  if (!store) return null;
  const stack = readUndoStack();
  if (!stack) return null;
  if (stack.gameId !== gameId) {
    store.removeItem(KEY_UNDO);
    return null;
  }
  try {
    const state = stack.entries.pop() ?? null;
    if (state && state.gameId !== gameId) {
      // Defesa extra: entrada de outra partida dentro da pilha.
      store.removeItem(KEY_UNDO);
      return null;
    }
    store.setItem(KEY_UNDO, JSON.stringify(stack));
    return state;
  } catch {
    return null;
  }
}

export function undoDepth(gameId: string): number {
  const stack = readUndoStack();
  if (!stack || stack.gameId !== gameId) return 0;
  return stack.entries.filter((entry) => entry.gameId === gameId).length;
}

/** Descarta a pilha se ela pertencer a outra partida. Devolve true se limpou. */
export function dropForeignUndo(gameId: string): boolean {
  const store = storage();
  if (!store) return false;
  const stack = readUndoStack();
  if (stack && stack.gameId !== gameId) {
    store.removeItem(KEY_UNDO);
    return true;
  }
  if (!stack && store.getItem(KEY_UNDO)) {
    store.removeItem(KEY_UNDO); // formato antigo/corrompido
    return true;
  }
  return false;
}

export function clearUndo(): void {
  storage()?.removeItem(KEY_UNDO);
}

/* ---------------- Migração de schema ---------------- */

export function migrate(snapshot: Snapshot): Snapshot | null {
  if (!snapshot || typeof snapshot !== 'object' || !snapshot.state || typeof snapshot.state !== 'object' || Array.isArray(snapshot.state)) return null;
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

/**
 * Validação completa do arquivo importado. Um arquivo inválido é recusado sem
 * gravar nada: a partida atual e o último estado válido permanecem intactos.
 */
export function parseImport(text: string): ImportResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: 'Arquivo não é um JSON válido.' };
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { ok: false, error: 'Arquivo não contém um estado de partida.' };
  }
  const snapshot = raw as Snapshot;
  if (!snapshot.state) return { ok: false, error: 'Arquivo não contém um estado de partida.' };
  if (typeof snapshot.schemaVersion !== 'number' || !Number.isInteger(snapshot.schemaVersion)) {
    return { ok: false, error: 'Arquivo sem versão de schema.' };
  }
  if (snapshot.schemaVersion > SCHEMA_VERSION) {
    return { ok: false, error: `Arquivo da versão ${snapshot.schemaVersion}; este app lê até ${SCHEMA_VERSION}.` };
  }

  const validation = validateGameState(snapshot.state);
  if (!validation.ok) {
    return {
      ok: false,
      error:
        validation.errors.length > 1
          ? `${validation.errors[0]} (+${validation.errors.length - 1} outro(s) problema(s))`
          : validation.errors[0],
    };
  }

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
