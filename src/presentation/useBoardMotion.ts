import { useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState } from 'react';
import type { BoardStop, GameState, Movement } from '../game/types';

export type BoardMotionTarget =
  | { kind: 'node'; id: string }
  | { kind: 'stop'; id: string };

export interface BoardMotionStep {
  key: string;
  playerId: string;
  from: BoardMotionTarget;
  to: BoardMotionTarget;
  /** False para teleporte/troca ou qualquer salto sem percurso comprovável. */
  animate: boolean;
}

export interface BoardMotionFrame extends BoardMotionStep {
  phase: 'jump' | 'land';
  jumpMs: number;
}

export type BoardMotionFocus = BoardMotionTarget & { x: number; y: number };

export interface BoardMotionOptions {
  jumpMs?: number;
  landMs?: number;
  /** Congela a apresentação e adota o snapshot mais recente sem replay ao retomar. */
  paused?: boolean;
  /** Útil em testes; em produção a media query é a fonte. */
  reducedMotion?: boolean;
}

const MOTION_FIELD = '__boardMotionFrame';
type PresentedState = GameState & { [MOTION_FIELD]?: BoardMotionFrame };

export function boardMotionFrame(state: GameState): BoardMotionFrame | null {
  return (state as PresentedState)[MOTION_FIELD] ?? null;
}

const node = (id: string): BoardMotionTarget => ({ kind: 'node', id });
const stop = (id: string): BoardMotionTarget => ({ kind: 'stop', id });
const sameTarget = (a: BoardMotionTarget, b: BoardMotionTarget) => a.kind === b.kind && a.id === b.id;
const isPrefix = (prefix: string[], whole: string[]) => prefix.every((id, index) => whole[index] === id);

function canonicalTarget(state: GameState, playerId: string): BoardMotionTarget {
  if (state.order[state.activeIndex] === playerId && state.movement?.transit) {
    return stop(state.movement.transit.stopId);
  }
  return node(state.players[playerId].nodeId);
}

/**
 * Extrai somente trajetos registrados pelo motor. Não busca caminho no grafo:
 * bifurcações, trocas e teleportes nunca viram animações inventadas.
 */
export function deriveBoardMotionSteps(previous: GameState, next: GameState): BoardMotionStep[] {
  const steps: BoardMotionStep[] = [];
  for (const playerId of next.order) {
    const before = previous.players[playerId];
    const after = next.players[playerId];
    if (!before || !after) continue;

    const from = canonicalTarget(previous, playerId);
    const beforeHistory = before.stepHistory ?? [];
    const afterHistory = after.stepHistory ?? [];
    const movedBefore = previous.order[previous.activeIndex] === playerId;
    const movesNow = next.order[next.activeIndex] === playerId;
    const teleported = (movedBefore && !!previous.movement?.teleport) || (movesNow && !!next.movement?.teleport);
    let exactNodes: string[] = [];

    if (!teleported && afterHistory.length > beforeHistory.length && isPrefix(beforeHistory, afterHistory)) {
      const appended = afterHistory.slice(beforeHistory.length);
      // Cada passo para frente grava a origem antes de trocar player.nodeId.
      if (appended[0] === before.nodeId) exactNodes = [...appended.slice(1), after.nodeId];
    } else if (!teleported && afterHistory.length < beforeHistory.length && isPrefix(afterHistory, beforeHistory)) {
      // Recuo consome o histórico de trás para frente.
      const popped = beforeHistory.slice(afterHistory.length).reverse();
      if (popped.at(-1) === after.nodeId) exactNodes = popped;
    }

    let cursor = from;
    exactNodes
      .filter(id => !!next.map.nodes[id])
      .forEach((id, index) => {
        const target = node(id);
        if (!sameTarget(cursor, target)) {
          steps.push({
            key: `${next.revision}:${playerId}:node:${index}:${id}`,
            playerId,
            from: cursor,
            to: target,
            animate: true,
          });
          cursor = target;
        }
      });

    const nextTransit = next.order[next.activeIndex] === playerId ? next.movement?.transit : undefined;
    const previousTransit = previous.order[previous.activeIndex] === playerId ? previous.movement?.transit : undefined;
    if (nextTransit && nextTransit.stopId !== previousTransit?.stopId && next.map.stops?.some(item => item.id === nextTransit.stopId)) {
      const target = stop(nextTransit.stopId);
      steps.push({
        key: `${next.revision}:${playerId}:stop:${nextTransit.stopId}`,
        playerId,
        from: cursor,
        to: target,
        animate: !teleported,
      });
      cursor = target;
    }

    const finalTarget = canonicalTarget(next, playerId);
    const changed = !sameTarget(from, finalTarget);
    if (changed && exactNodes.length === 0 && !nextTransit) {
      // Há mudança real, mas não há prova dos passos (troca, teleporte ou save antigo).
      steps.push({
        key: `${next.revision}:${playerId}:sync:${finalTarget.kind}:${finalTarget.id}`,
        playerId,
        from,
        to: finalTarget,
        animate: false,
      });
    } else if (!sameTarget(cursor, finalTarget) && !nextTransit) {
      // Fecha uma chegada conhecida após uma parada já vista em snapshot anterior.
      steps.push({
        key: `${next.revision}:${playerId}:finish:${finalTarget.id}`,
        playerId,
        from: cursor,
        to: finalTarget,
        animate: exactNodes.length > 0,
      });
    }
  }
  return steps;
}

interface Machine {
  current: BoardMotionStep | null;
  phase: 'jump' | 'land';
  queue: BoardMotionStep[];
}

type MachineAction =
  | { type: 'ingest'; steps: BoardMotionStep[] }
  | { type: 'tick' }
  | { type: 'reset' };

const EMPTY_MACHINE: Machine = { current: null, phase: 'jump', queue: [] };

function machineReducer(state: Machine, action: MachineAction): Machine {
  if (action.type === 'reset') return EMPTY_MACHINE;
  if (action.type === 'ingest') {
    if (!action.steps.length) return state;
    if (!state.current) return { current: action.steps[0], phase: 'jump', queue: action.steps.slice(1) };
    return { ...state, queue: [...state.queue, ...action.steps] };
  }
  if (state.current?.animate && state.phase === 'jump') return { ...state, phase: 'land' };
  const [current = null, ...queue] = state.queue;
  return { current, phase: 'jump', queue };
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return reduced;
}

function usePageHidden() {
  const [hidden, setHidden] = useState(() =>
    typeof document !== 'undefined' && document.visibilityState === 'hidden',
  );
  useEffect(() => {
    const update = () => setHidden(document.visibilityState === 'hidden');
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);
  return hidden;
}

function targetFocus(state: GameState, target: BoardMotionTarget): BoardMotionFocus | null {
  const place = target.kind === 'node'
    ? state.map.nodes[target.id]
    : state.map.stops?.find(item => item.id === target.id);
  return place ? { ...target, x: place.x, y: place.y } : null;
}

function stateAtStep(state: GameState, step: BoardMotionStep, frame: BoardMotionFrame | null): GameState {
  const player = state.players[step.playerId];
  if (!player) return state;
  const players = { ...state.players, [step.playerId]: { ...player } };
  const visualActiveIndex = state.order.indexOf(step.playerId);
  const sameActivePlayer = visualActiveIndex === state.activeIndex;
  const baseMovement: Movement = sameActivePlayer && state.movement
    ? { ...state.movement, traversed: [...state.movement.traversed] }
    : { remaining: 0, traversed: [], activatesSpaces: false, direction: 'forward' };
  let movement: Movement | null = baseMovement;

  if (step.to.kind === 'node') {
    players[step.playerId].nodeId = step.to.id;
    delete baseMovement.transit;
    if (!sameActivePlayer || !state.movement) movement = null;
  } else {
    const boardStop: BoardStop | undefined = state.map.stops?.find(item => item.id === step.to.id);
    if (boardStop) {
      players[step.playerId].nodeId = boardStop.from;
      baseMovement.transit = { stopId: boardStop.id, to: boardStop.to };
    }
  }

  const presented: PresentedState = {
    ...state,
    players,
    movement,
    activeIndex: visualActiveIndex >= 0 ? visualActiveIndex : state.activeIndex,
  };
  if (frame) presented[MOTION_FIELD] = frame;
  return presented;
}

export function useBoardMotion(matchId: string, state: GameState, options: BoardMotionOptions = {}) {
  const mediaReduced = usePrefersReducedMotion();
  const pageHidden = usePageHidden();
  const reduced = options.reducedMotion ?? mediaReduced;
  const suspended = !!options.paused || pageHidden || reduced;
  const jumpMs = options.jumpMs ?? 360;
  const landMs = options.landMs ?? 140;
  const previous = useRef({ matchId, state });
  const [acceptedState, setAcceptedState] = useState(state);
  const [machine, dispatch] = useReducer(machineReducer, EMPTY_MACHINE);

  useLayoutEffect(() => {
    const prior = previous.current;
    if (suspended) {
      previous.current = { matchId, state };
      setAcceptedState(state);
      dispatch({ type: 'reset' });
      return;
    }
    if (prior.matchId !== matchId) {
      previous.current = { matchId, state };
      setAcceptedState(state);
      dispatch({ type: 'reset' });
      return;
    }
    // Resposta atrasada da reconexão: não volta a peça nem reabre animações antigas.
    if (state.revision < prior.state.revision) return;
    if (state.revision === prior.state.revision) return;
    const steps = deriveBoardMotionSteps(prior.state, state);
    previous.current = { matchId, state };
    setAcceptedState(state);
    dispatch({ type: 'ingest', steps });
  }, [matchId, state.revision, suspended]);

  useEffect(() => {
    if (!machine.current) return;
    const delay = !machine.current.animate ? 0 : machine.phase === 'jump' ? jumpMs : landMs;
    const timer = window.setTimeout(() => dispatch({ type: 'tick' }), delay);
    return () => window.clearTimeout(timer);
  }, [jumpMs, landMs, machine.current, machine.phase]);

  const presentedState = useMemo(() => {
    if (!machine.current || suspended) return acceptedState;
    const frame: BoardMotionFrame | null = machine.current.animate
      ? { ...machine.current, phase: machine.phase, jumpMs }
      : null;
    return stateAtStep(acceptedState, machine.current, frame);
  }, [acceptedState, jumpMs, machine.current, machine.phase, suspended]);

  const activeId = acceptedState.order[acceptedState.activeIndex];
  const focusTarget = machine.current?.to ?? (activeId ? canonicalTarget(acceptedState, activeId) : null);
  const focus = focusTarget ? targetFocus(acceptedState, focusTarget) : null;

  return {
    /** Passe este estado ao Board durante toda a partida. */
    state: presentedState,
    /** Use x/y na câmera; inclui paradas, que não possuem nodeId. */
    focus,
    frame: boardMotionFrame(presentedState),
    isAnimating: !!machine.current?.animate && !suspended,
    pendingSteps: (machine.current ? 1 : 0) + machine.queue.length,
  };
}
