// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createGame } from '../game/engine';
import type { GameState } from '../game/types';
import { createV4Map } from '../data/map';
import { deriveBoardMotionSteps, useBoardMotion } from './useBoardMotion';

function game(playerCount = 1): GameState {
  return createGame(
    Array.from({ length: playerCount }, (_, index) => ({
      id: `p${index}`, name: `P${index}`, color: '#fff', symbol: String(index), portrait: `${index}.png`,
    })),
    {},
    { seed: 1, shuffleOrder: false, map: createV4Map() },
  );
}

function snapshot(base: GameState, nodeId: string, history: string[], revision: number) {
  const state = structuredClone(base);
  state.players.p0.nodeId = nodeId;
  state.players.p0.stepHistory = history;
  state.revision = revision;
  return state;
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
});

describe('trajeto visual comprovado', () => {
  it('expande vários passos agrupados pelo snapshot, inclusive o último após movement=null', () => {
    const before = snapshot(game(), 'm0', [], 10);
    const after = snapshot(before, 'm3', ['m0', 'm1', 'm2'], 13);
    after.movement = null;
    expect(deriveBoardMotionSteps(before, after).map(step => [step.from.id, step.to.id, step.animate])).toEqual([
      ['m0', 'm1', true],
      ['m1', 'm2', true],
      ['m2', 'm3', true],
    ]);
  });

  it('usa a escolha registrada na bifurcação em vez de procurar uma rota no grafo', () => {
    const before = snapshot(game(), 'm4', ['m3'], 20);
    const after = snapshot(before, 'a1', ['m3', 'm4', 'a0'], 22);
    expect(deriveBoardMotionSteps(before, after).map(step => step.to.id)).toEqual(['a0', 'a1']);
  });

  it('reproduz recuo na ordem em que o histórico foi consumido', () => {
    const before = snapshot(game(), 'm3', ['m0', 'm1', 'm2'], 30);
    const after = snapshot(before, 'm1', ['m0'], 32);
    expect(deriveBoardMotionSteps(before, after).map(step => step.to.id)).toEqual(['m2', 'm1']);
  });

  it('mostra a parada entre casas depois dos passos já percorridos', () => {
    const before = snapshot(game(), 'm0', [], 40);
    const after = snapshot(before, 'm2', ['m0', 'm1'], 42);
    after.movement = { remaining: 2, traversed: ['m1', 'm2'], activatesSpaces: true, direction: 'forward', transit: { stopId: 'shop-west', to: 'm3' } };
    expect(deriveBoardMotionSteps(before, after).map(step => `${step.to.kind}:${step.to.id}`)).toEqual([
      'node:m1', 'node:m2', 'stop:shop-west',
    ]);
  });

  it('sincroniza troca/teleporte sem desenhar um caminho falso', () => {
    const before = snapshot(game(), 'm4', ['m0', 'm1', 'm2', 'm3'], 50);
    const after = snapshot(before, 'm20', [], 51);
    const steps = deriveBoardMotionSteps(before, after);
    expect(steps).toHaveLength(1);
    expect(steps[0]).toMatchObject({ to: { kind: 'node', id: 'm20' }, animate: false });
  });

  it('teleporte do jogador ativo não bloqueia trajetória comprovada de outro jogador', () => {
    const before = game(2);
    before.movement = { remaining: 1, traversed: [], activatesSpaces: false, direction: 'forward', teleport: true };
    const after = structuredClone(before);
    after.players.p1.nodeId = 'm2';
    after.players.p1.stepHistory = ['m0', 'm1'];
    after.revision += 2;
    expect(deriveBoardMotionSteps(before, after).filter(step => step.playerId === 'p1').map(step => step.animate)).toEqual([true, true]);
  });
});

describe('hook de apresentação', () => {
  it('não repete movimento ao montar/reconectar e entrega passos posteriores um a um', async () => {
    vi.useFakeTimers();
    const initial = snapshot(game(), 'm2', ['m0', 'm1'], 2);
    const { result, rerender } = renderHook(
      ({ state }) => useBoardMotion('partida-1', state, { jumpMs: 100, landMs: 20, reducedMotion: false }),
      { initialProps: { state: initial } },
    );
    expect(result.current.pendingSteps).toBe(0);
    expect(result.current.state.players.p0.nodeId).toBe('m2');

    const grouped = snapshot(initial, 'm4', ['m0', 'm1', 'm2', 'm3'], 4);
    rerender({ state: grouped });
    await act(async () => {});
    expect(result.current.state.players.p0.nodeId).toBe('m3');
    expect(result.current.frame?.phase).toBe('jump');

    await act(async () => vi.advanceTimersByTime(100));
    expect(result.current.frame?.phase).toBe('land');
    await act(async () => vi.advanceTimersByTime(20));
    expect(result.current.state.players.p0.nodeId).toBe('m4');
    expect(result.current.pendingSteps).toBe(1);
  });

  it('respeita reduced motion e sincroniza imediatamente', async () => {
    const initial = snapshot(game(), 'm0', [], 1);
    const { result, rerender } = renderHook(
      ({ state }) => useBoardMotion('partida-1', state, { reducedMotion: true }),
      { initialProps: { state: initial } },
    );
    const grouped = snapshot(initial, 'm3', ['m0', 'm1', 'm2'], 4);
    rerender({ state: grouped });
    await act(async () => {});
    expect(result.current.state.players.p0.nodeId).toBe('m3');
    expect(result.current.pendingSteps).toBe(0);
    expect(result.current.frame).toBeNull();
  });

  it('ignora snapshot atrasado da mesma partida durante reconexão', async () => {
    const latest = snapshot(game(), 'm4', ['m0', 'm1', 'm2', 'm3'], 4);
    const { result, rerender } = renderHook(
      ({ state }) => useBoardMotion('partida-1', state, { reducedMotion: false }),
      { initialProps: { state: latest } },
    );
    rerender({ state: snapshot(game(), 'm2', ['m0', 'm1'], 2) });
    await act(async () => {});
    expect(result.current.state.players.p0.nodeId).toBe('m4');
    expect(result.current.pendingSteps).toBe(0);
  });

  it('mantém no Board o jogador do passo agrupado mesmo se o turno canônico já mudou', async () => {
    const before = game(2);
    const after = structuredClone(before);
    after.players.p0.nodeId = 'm2';
    after.players.p0.stepHistory = ['m0', 'm1'];
    after.activeIndex = 1;
    after.revision += 3;
    const { result, rerender } = renderHook(
      ({ state }) => useBoardMotion('partida-1', state, { jumpMs: 100, landMs: 20, reducedMotion: false }),
      { initialProps: { state: before } },
    );
    rerender({ state: after });
    await act(async () => {});
    expect(after.order[after.activeIndex]).toBe('p1');
    expect(result.current.state.order[result.current.state.activeIndex]).toBe('p0');
    expect(result.current.state.players.p0.nodeId).toBe('m1');
  });

  it('descarta a fila ao pausar e retoma do snapshot atual sem replay', async () => {
    vi.useFakeTimers();
    const before = snapshot(game(), 'm0', [], 1);
    const after = snapshot(before, 'm3', ['m0', 'm1', 'm2'], 4);
    const { result, rerender } = renderHook(
      ({ state, paused }) => useBoardMotion('partida-1', state, { jumpMs: 100, landMs: 20, reducedMotion: false, paused }),
      { initialProps: { state: before, paused: false } },
    );
    rerender({ state: after, paused: false });
    await act(async () => {});
    expect(result.current.pendingSteps).toBe(3);

    rerender({ state: after, paused: true });
    await act(async () => {});
    expect(result.current.pendingSteps).toBe(0);
    expect(result.current.state.players.p0.nodeId).toBe('m3');

    rerender({ state: after, paused: false });
    await act(async () => vi.runOnlyPendingTimers());
    expect(result.current.pendingSteps).toBe(0);
  });

  it('descarta a fila enquanto a aba está oculta e volta no ponto atual', async () => {
    const before = snapshot(game(), 'm0', [], 1);
    const after = snapshot(before, 'm3', ['m0', 'm1', 'm2'], 4);
    const { result, rerender } = renderHook(
      ({ state }) => useBoardMotion('partida-1', state, { reducedMotion: false }),
      { initialProps: { state: before } },
    );
    rerender({ state: after });
    await act(async () => {});
    expect(result.current.pendingSteps).toBe(3);

    await act(async () => {
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(result.current.pendingSteps).toBe(0);
    expect(result.current.state.players.p0.nodeId).toBe('m3');

    await act(async () => {
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(result.current.pendingSteps).toBe(0);
  });
});
