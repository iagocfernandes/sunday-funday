// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createGame } from '../game/engine';
import type { DomainEvent, GameState } from '../game/types';
import { freshMiguelEvents, messageForMiguelCardPreview, messageForMiguelEvent, messageForMiguelPending, persistentMiguelSad, useMiguelHost } from './useMiguelHost';

function game(): GameState {
  return createGame(
    ['Iago', 'Milena', 'AR2'].map((name, i) => ({ id: `p${i}`, name, color: '#abc', symbol: 'X', portrait: '/x.png' })),
    {},
    { seed: 17, shuffleOrder: false },
  );
}

function remote(seq: number, event: DomainEvent, matchId = 'm1') {
  return { seq, matchId, event, byHost: false };
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('Miguel host presentation', () => {
  it('consome o histórico inicial sem replayar e deduplica seqências', () => {
    const events = [
      remote(4, { type: 'diceRolled', playerId: 'p0', value: 5, doubled: false }),
      remote(4, { type: 'diceRolled', playerId: 'p0', value: 5, doubled: false }),
      remote(7, { type: 'roundEnded', round: 1 }),
    ];
    expect(freshMiguelEvents(events, 'm1', null)).toEqual({ fresh: [], cursor: 7 });
    const afterCursor = freshMiguelEvents([
      ...events,
      remote(7, { type: 'roundEnded', round: 1 }),
      remote(9, { type: 'roundStarted', round: 2 }),
      remote(9, { type: 'roundStarted', round: 2 }),
    ], 'm1', 4);
    expect(afterCursor.fresh.map(event => event.seq)).toEqual([7, 9]);
    expect(freshMiguelEvents([...events, remote(9, { type: 'roundStarted', round: 2 }, 'other')], 'm1', 7).fresh).toHaveLength(0);
  });

  it('reage aos eventos principais com fala curta e humor sem humilhar', () => {
    const state = game();
    expect(messageForMiguelEvent({ type: 'diceRolled', playerId: 'p0', value: 8, doubled: false }, state)?.text).toContain('Iago');
    expect(messageForMiguelEvent({ type: 'goldenBananaPurchased', playerId: 'p1' }, state)?.text).toContain('Milena');
    expect(messageForMiguelEvent({ type: 'attackBlocked', attackerId: 'p0', targetId: 'p1' }, state)?.text).toContain('Defesa perfeita');
    expect(messageForMiguelEvent({ type: 'cardResolved', playerId: 'p0', cardId: 'MA03' }, state)?.text).toBe('Cinco pra trás! Esse GPS foi comprado na promoção?');
    expect(messageForMiguelEvent({ type: 'cardResolved', playerId: 'p0', cardId: 'MA04' }, state)?.text).toContain('Chef Iago');
    expect(messageForMiguelEvent({ type: 'cardResolved', playerId: 'p0', cardId: 'MA05' }, state)?.text).toContain('Bill e Maya');
    expect(messageForMiguelEvent({ type: 'cardResolved', playerId: 'p0', cardId: 'MA07' }, state)?.text).toBe('A banana foi de arrasta. Eu não vi nada.');
    expect(messageForMiguelEvent({ type: 'itemGranted', playerId: 'p0', itemId: 'preguicao' }, state)?.text).toBe('Comprou Preguição? Os amigos que lutem.');
    expect(messageForMiguelEvent({ type: 'itemUsed', playerId: 'p0', itemId: 'preguicao' }, state)?.text).toContain('apertou o freio');
    expect(messageForMiguelEvent({ type: 'cardResolved', playerId: 'p0', cardId: 'MA03' }, state)?.mood).toBe('mischievous');
    expect(messageForMiguelEvent({ type: 'minigameCompleted', minigameId: 'quiz', winners: ['p0', 'p1'] }, state)?.text).toContain('Iago e Milena');
    expect(messageForMiguelEvent({ type: 'minigameCompleted', minigameId: 'quiz', winners: [] }, state)?.text).toContain('Empate');
    state.pending = { kind: 'duelBet', playerId: 'p0', opponentId: 'p1', maxBet: 5 };
    expect(messageForMiguelPending(state)?.text).toContain('Duelo à vista');
    state.pending = { kind: 'duelResult', playerId: 'p0', opponentId: 'p1', bet: 5 };
    expect(messageForMiguelPending(state)?.text).toContain('aguardando resultado');
  });

  it('mantém tristeza enquanto qualquer Fique Sóbrio estiver ativo', () => {
    const state = game();
    state.round = 2;
    state.players.p0.tasks = [{ cardId: 'MA02', untilRound: 3 }];
    expect(persistentMiguelSad(state)).toBe(true);
    state.players.p0.tasks = [{ cardId: 'MA02', untilRound: 2 }];
    expect(persistentMiguelSad(state)).toBe(false);
    state.players.p1.tasks = [{ cardId: 'MA02', untilRound: 5 }];
    expect(persistentMiguelSad(state)).toBe(true);
  });

  it('comenta a prévia no início e suprime o cardResolved correspondente', async () => {
    vi.useFakeTimers();
    const initial = game();
    const preview = structuredClone(initial);
    preview.pending = { kind: 'cardPreview', playerId: 'p0', cardId: 'MA03', category: 'unluck' };
    const resolved = structuredClone(initial);
    const { result, rerender } = renderHook(
      ({ state, events }) => useMiguelHost({ board: { matchId: 'm1', events }, state, enabled: true, paused: false }),
      { initialProps: { state: initial, events: [] as ReturnType<typeof remote>[] } },
    );
    await act(async () => {});
    rerender({ state: preview, events: [] });
    await act(async () => {});
    expect(messageForMiguelCardPreview(preview)?.text).toBe('Cinco pra trás! Esse GPS foi comprado na promoção?');
    const repeated = structuredClone(preview);
    repeated.revision += 1;
    expect(messageForMiguelCardPreview(preview, 'm1:10')?.key).not.toBe(messageForMiguelCardPreview(repeated, 'm1:11')?.key);
    expect(result.current.text).toBe('Cinco pra trás! Esse GPS foi comprado na promoção?');
    rerender({ state: resolved, events: [remote(1, { type: 'cardResolved', playerId: 'p0', cardId: 'MA03' })] });
    await act(async () => {});
    vi.advanceTimersByTime(5001);
    await act(async () => {});
    expect(result.current.text).toBeNull();
    expect(result.current.messageId).toBeNull();
  });

  it('mantém reação com reduced motion; apenas a animação fica a cargo do CSS', async () => {
    Object.defineProperty(window, 'matchMedia', { configurable: true, value: () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }) });
    const state = game();
    const event = remote(1, { type: 'diceRolled', playerId: 'p0', value: 6, doubled: false });
    const { result, rerender } = renderHook(
      ({ events }) => useMiguelHost({ board: { matchId: 'm1', events }, state, enabled: true, paused: false }),
      { initialProps: { events: [] as ReturnType<typeof remote>[] } },
    );
    rerender({ events: [event] });
    await act(async () => {});
    expect(result.current.visible).toBe(true);
    expect(result.current.text).toContain('dado veio 6');
    rerender({ events: [event] });
    await act(async () => {});
    expect(result.current.messageId).toContain('m1:1');
  });

  it('mantém vitória importante quando o próximo poll traz apenas turnStarted', async () => {
    const initial = game();
    const victory = remote(1, { type: 'minigameCompleted', minigameId: 'quiz', winners: ['p0'] });
    const turn = remote(2, { type: 'turnStarted', playerId: 'p1' });
    const { result, rerender } = renderHook(
      ({ state, events }) => useMiguelHost({ board: { matchId: 'm1', events }, state, enabled: true, paused: false }),
      { initialProps: { state: initial, events: [] as ReturnType<typeof remote>[] } },
    );
    rerender({ state: initial, events: [victory] });
    await act(async () => {});
    expect(result.current.text).toContain('Parabéns, Iago');
    const next = structuredClone(initial);
    next.revision += 1;
    rerender({ state: next, events: [victory, turn] });
    await act(async () => {});
    expect(result.current.text).toContain('Parabéns, Iago');
  });

  it('encerra a tristeza de MA02 no fim da rodada e libera fala feliz', async () => {
    const initial = game();
    initial.round = 1;
    initial.players.p0.tasks = [{ cardId: 'MA02', untilRound: 3 }];
    const soberEvent = remote(1, { type: 'cardResolved', playerId: 'p0', cardId: 'MA02' });
    const roundTwo = remote(2, { type: 'roundStarted', round: 2 });
    const roundThree = remote(3, { type: 'roundStarted', round: 3 });
    const { result, rerender } = renderHook(
      ({ state, events }) => useMiguelHost({ board: { matchId: 'm1', events }, state, enabled: true, paused: false }),
      { initialProps: { state: initial, events: [] as ReturnType<typeof remote>[] } },
    );
    rerender({ state: initial, events: [soberEvent] });
    await act(async () => {});
    expect(result.current.mood).toBe('sad');
    const middle = structuredClone(initial);
    middle.round = 2;
    rerender({ state: middle, events: [soberEvent, roundTwo] });
    await act(async () => {});
    expect(result.current.mood).toBe('sad');
    const finished = structuredClone(initial);
    finished.round = 3;
    rerender({ state: finished, events: [soberEvent, roundTwo, roundThree] });
    await act(async () => {});
    expect(result.current.mood).toBe('happy');
    expect(result.current.text).toContain('Rodada 3');
  });
});
