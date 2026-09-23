import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { applyCommand, nextAutoCommand, statusText } from '../game/engine';
import type { Command, DomainEvent, GameState } from '../game/types';
import { isBlocking, scenesFor, type Scene } from '../presentation/manifest';
import {
  acquireTabLock,
  clearUndo,
  forceTakeTabLock,
  downloadBackup,
  popUndo,
  pushUndo,
  renewTabLock,
  saveSnapshot,
  undoDepth,
  type PersistedControl,
} from '../persistence/storage';

export type Speed = 'normal' | 'fast';

/** Atrasos da execução automática (ms). A velocidade NUNCA altera a janela de item. */
const BASE_DELAY: Record<string, number> = {
  turnStart: 750,
  readyToRoll: 650,
  moving: 420,
  resolvingSpace: 650,
  turnEnd: 700,
};

function delayFor(phase: string, speed: Speed): number {
  const base = BASE_DELAY[phase] ?? 400;
  return speed === 'fast' ? Math.round(base * 0.45) : base;
}

/** Comandos que valem como "ação lógica" para o Desfazer. */
const UNDOABLE = new Set<Command['type']>([
  'startRound', 'useItem', 'rollDice', 'choosePath', 'buyItem', 'skipShop',
  'buyGolden', 'skipPedestal', 'confirmCard', 'chooseTarget', 'resolveDefense',
  'endTurn', 'submitResults', 'nextRound', 'manualAdjust',
]);

export interface SessionOptions {
  initialState: GameState;
  initialControl?: PersistedControl;
  autoBackup?: boolean;
}

export interface Session {
  state: GameState;
  status: string;
  manualPaused: boolean;
  speed: Speed;
  muted: boolean;
  reducedMotion: boolean;
  itemRemainingMs: number | null;
  currentScene: Scene | null;
  sceneQueueLength: number;
  saveError: string | null;
  savedAt: number | null;
  undoAvailable: boolean;
  tabConflict: boolean;
  takeControl: () => void;
  dispatch: (command: Command) => boolean;
  pause: () => void;
  resume: () => void;
  togglePause: () => void;
  setSpeed: (speed: Speed) => void;
  setMuted: (value: boolean) => void;
  setReducedMotion: (value: boolean) => void;
  undo: () => void;
  skipScene: () => void;
  backup: (tag?: string) => void;
  replaceState: (state: GameState, control?: PersistedControl) => void;
  controlSnapshot: PersistedControl;
}

let sessionCounter = 0;

export function useGameSession(options: SessionOptions): Session {
  const [state, setState] = useState<GameState>(options.initialState);
  const stateRef = useRef(state);
  stateRef.current = state;

  const [manualPaused, setManualPaused] = useState(true); // recarga sempre volta em pausa
  const pausedRef = useRef(manualPaused);
  pausedRef.current = manualPaused;

  const [speed, setSpeedState] = useState<Speed>(options.initialControl?.speed ?? 'normal');
  const [muted, setMuted] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(
    typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches,
  );

  const [itemRemainingMs, setItemRemainingMs] = useState<number | null>(
    options.initialControl?.itemWindowRemainingMs ?? null,
  );
  const itemRef = useRef(itemRemainingMs);
  itemRef.current = itemRemainingMs;

  const [queue, setQueue] = useState<Scene[]>([]);
  const [currentScene, setCurrentScene] = useState<Scene | null>(null);

  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [undoAvailable, setUndoAvailable] = useState(() => undoDepth() > 0);
  const [tabConflict, setTabConflict] = useState(false);

  /** Geração da execução: invalida qualquer callback já enfileirado. */
  const generation = useRef(0);
  const sessionId = useMemo(() => `tab-${++sessionCounter}-${Math.random().toString(36).slice(2)}`, []);
  const lastBackupRound = useRef(0);

  const controlSnapshot: PersistedControl = useMemo(
    () => ({ itemWindowRemainingMs: itemRemainingMs, speed }),
    [itemRemainingMs, speed],
  );

  /* -------------------- bloqueio de aba -------------------- */
  useEffect(() => {
    const lock = acquireTabLock(state.gameId, sessionId);
    if (lock.conflicted) {
      setTabConflict(true);
      setManualPaused(true);
    }
    const interval = setInterval(() => {
      if (!lock.conflicted) renewTabLock(stateRef.current.gameId, sessionId);
    }, 5000);
    // Uma recarga da página precisa liberar o bloqueio: sem isto, reabrir a
    // partida na mesma aba ficaria travado como se outra aba a estivesse editando.
    const onLeave = () => lock.release();
    window.addEventListener('pagehide', onLeave);
    return () => {
      clearInterval(interval);
      window.removeEventListener('pagehide', onLeave);
      lock.release();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  /* -------------------- persistência -------------------- */
  const persist = useCallback((next: GameState, control: PersistedControl) => {
    const result = saveSnapshot(next, control);
    if (result.ok) {
      setSaveError(null);
      setSavedAt(result.savedAt);
    } else {
      // Nunca dizer "salvo" se falhou: para a automação e pede backup.
      setSaveError(result.error);
      setManualPaused(true);
      generation.current += 1;
    }
  }, []);

  const invalidate = useCallback(() => {
    generation.current += 1;
  }, []);

  /* -------------------- dispatch -------------------- */
  const dispatch = useCallback(
    (command: Command): boolean => {
      const prev = stateRef.current;
      const result = applyCommand(prev, {
        commandId: `cmd-${prev.revision}-${command.type}-${Math.random().toString(36).slice(2)}`,
        expectedRevision: prev.revision,
        command,
      });
      if (result.rejected) return false;

      if (UNDOABLE.has(command.type)) {
        pushUndo(prev);
        setUndoAvailable(true);
      }

      stateRef.current = result.state;
      setState(result.state);

      // Janela de item: o motor decide quando ela existe.
      if (result.state.itemWindow) {
        if (!prev.itemWindow || prev.itemWindow.playerId !== result.state.itemWindow.playerId) {
          setItemRemainingMs(result.state.itemWindow.remainingMs);
        }
      } else {
        setItemRemainingMs(null);
      }

      // O estado é salvo ANTES de iniciar qualquer animação.
      persist(result.state, {
        itemWindowRemainingMs: result.state.itemWindow?.remainingMs ?? null,
        speed,
      });

      const scenes = result.events.flatMap((event: DomainEvent) => scenesFor(event, result.state));
      if (scenes.length > 0) setQueue((q) => [...q, ...scenes]);
      return true;
    },
    [persist, speed],
  );

  const dispatchRef = useRef(dispatch);
  dispatchRef.current = dispatch;

  /* -------------------- fila de cenas -------------------- */
  useEffect(() => {
    if (currentScene || queue.length === 0) return;
    setCurrentScene(queue[0]);
    setQueue((q) => q.slice(1));
  }, [queue, currentScene]);

  useEffect(() => {
    if (!currentScene) return;
    if (manualPaused) return; // pausa congela a reprodução visual
    const factor = reducedMotion ? 0.35 : speed === 'fast' ? 0.5 : 1;
    const duration = Math.max(250, currentScene.durationMs * factor);
    // Limite de duração: terminar/pular/falhar produz exatamente o mesmo estado.
    const timer = setTimeout(() => setCurrentScene(null), duration);
    return () => clearTimeout(timer);
  }, [currentScene, manualPaused, speed, reducedMotion]);

  const skipScene = useCallback(() => {
    setCurrentScene(null);
  }, []);

  const blockingScene = currentScene !== null && isBlocking(currentScene);

  /* -------------------- coordenador automático -------------------- */
  useEffect(() => {
    if (manualPaused || tabConflict || saveError) return;
    if (blockingScene) return;
    if (state.phase === 'itemWindow') return; // tratado pelo timer da janela
    const command = nextAutoCommand(state);
    if (!command) return;

    const gen = generation.current;
    const revision = state.revision;
    const timer = setTimeout(() => {
      // Rejeita callbacks antigos, montagem dupla e cliques duplicados.
      if (gen !== generation.current) return;
      if (pausedRef.current) return;
      if (stateRef.current.revision !== revision) return;
      dispatchRef.current(command);
    }, delayFor(state.phase, speed));

    return () => clearTimeout(timer);
  }, [state, manualPaused, blockingScene, speed, tabConflict, saveError]);

  /* -------------------- janela de 5 s do item -------------------- */
  useEffect(() => {
    if (state.phase !== 'itemWindow') return;
    if (manualPaused || blockingScene || tabConflict || saveError) return;
    const gen = generation.current;
    const revision = state.revision;
    const tick = 100;
    const interval = setInterval(() => {
      if (gen !== generation.current || pausedRef.current) return;
      if (stateRef.current.revision !== revision) return;
      // A contagem vive no ref: vários ticks entre renderizações não se perdem.
      const remaining = (itemRef.current ?? 0) - tick;
      itemRef.current = remaining;
      if (remaining <= 0) {
        setItemRemainingMs(0);
        dispatchRef.current({ type: 'itemWindowExpired' });
      } else {
        setItemRemainingMs(remaining);
      }
    }, tick);
    return () => clearInterval(interval);
  }, [state.phase, state.revision, manualPaused, blockingScene, tabConflict, saveError]);

  /* -------------------- pausa / retomada -------------------- */
  const pause = useCallback(() => {
    invalidate();
    setManualPaused(true);
    persist(stateRef.current, { itemWindowRemainingMs: itemRef.current, speed });
  }, [invalidate, persist, speed]);

  const resume = useCallback(() => {
    if (tabConflict || saveError) return;
    invalidate();
    setManualPaused(false);
  }, [invalidate, tabConflict, saveError]);

  const togglePause = useCallback(() => {
    if (pausedRef.current) resume();
    else pause();
  }, [pause, resume]);

  /* Aba oculta suspende a execução e exige Retomar explícito. */
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden' && !pausedRef.current) {
        invalidate();
        setManualPaused(true);
        // checkpoint ao ocultar; o tempo ausente não é descontado
        saveSnapshot(stateRef.current, { itemWindowRemainingMs: itemRef.current, speed });
      }
    };
    document.addEventListener('visibilitychange', onHide);
    return () => document.removeEventListener('visibilitychange', onHide);
  }, [invalidate, speed]);

  /* -------------------- desfazer -------------------- */
  const undo = useCallback(() => {
    const previous = popUndo();
    if (!previous) {
      setUndoAvailable(false);
      return;
    }
    invalidate();
    setManualPaused(true);
    setQueue([]);
    setCurrentScene(null);
    stateRef.current = previous;
    setState(previous);
    setItemRemainingMs(previous.itemWindow?.remainingMs ?? null);
    setUndoAvailable(undoDepth() > 0);
    persist(previous, { itemWindowRemainingMs: previous.itemWindow?.remainingMs ?? null, speed });
  }, [invalidate, persist, speed]);

  const replaceState = useCallback(
    (next: GameState, control?: PersistedControl) => {
      invalidate();
      setManualPaused(true);
      setQueue([]);
      setCurrentScene(null);
      clearUndo();
      setUndoAvailable(false);
      stateRef.current = next;
      setState(next);
      setItemRemainingMs(control?.itemWindowRemainingMs ?? next.itemWindow?.remainingMs ?? null);
      if (control?.speed) setSpeedState(control.speed);
      persist(next, control ?? { itemWindowRemainingMs: null, speed });
    },
    [invalidate, persist, speed],
  );

  const backup = useCallback(
    (tag?: string) => {
      downloadBackup(stateRef.current, { itemWindowRemainingMs: itemRef.current, speed }, tag);
    },
    [speed],
  );

  /* Backup automático no intervalo de cada rodada (complementa o autosave). */
  useEffect(() => {
    if (options.autoBackup === false) return;
    if (state.phase !== 'roundEnd') return;
    if (lastBackupRound.current === state.round) return;
    lastBackupRound.current = state.round;
    downloadBackup(stateRef.current, { itemWindowRemainingMs: null, speed }, `rodada-${state.round}`);
  }, [state.phase, state.round, speed, options.autoBackup]);

  const setSpeed = useCallback((value: Speed) => setSpeedState(value), []);

  /** Assumir o controle depois de um conflito de abas (decisão do anfitrião). */
  const takeControl = useCallback(() => {
    forceTakeTabLock(stateRef.current.gameId, sessionId);
    setTabConflict(false);
  }, [sessionId]);

  return {
    state,
    status: statusText(state, manualPaused),
    manualPaused,
    speed,
    muted,
    reducedMotion,
    itemRemainingMs,
    currentScene,
    sceneQueueLength: queue.length,
    saveError,
    savedAt,
    undoAvailable,
    tabConflict,
    takeControl,
    dispatch,
    pause,
    resume,
    togglePause,
    setSpeed,
    setMuted,
    setReducedMotion,
    undo,
    skipScene,
    backup,
    replaceState,
    controlSnapshot,
  };
}
