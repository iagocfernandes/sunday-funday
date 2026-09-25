// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createV4Map } from '../data/map';
import { createGame } from '../game/engine';
import type { GameState } from '../game/types';
import type { BoardView } from '../remote/types';

const audio = vi.hoisted(() => ({
  play: vi.fn(),
  enable: vi.fn(async () => true),
  setSuspended: vi.fn(),
  setMuted: vi.fn(),
  setEffectsVolume: vi.fn(),
  setMusicVolume: vi.fn(),
  setMusicEnabled: vi.fn(),
  setMusicDucked: vi.fn(),
  dispose: vi.fn(),
}));

vi.mock('./audioEngine', async importOriginal => {
  const actual = await importOriginal<typeof import('./audioEngine')>();
  return {
    ...actual,
    createAudioEngine: () => ({ supported: true, enabled: true, ...audio }),
  };
});

import { useGameAudio } from './useGameAudio';

function game(): GameState {
  return createGame(
    [{ id: 'p0', name: 'P0', color: '#fff', symbol: '0', portrait: '0.png' }],
    {},
    { seed: 1, shuffleOrder: false, map: createV4Map() },
  );
}

function board(matchId: string): Pick<BoardView, 'matchId' | 'events'> {
  return { matchId, events: [] };
}

function preview(source: GameState, cardId: 'S01' | 'A01'): GameState {
  const state = structuredClone(source);
  state.revision += 1;
  state.phase = 'awaitingInteraction';
  state.pending = { kind: 'cardPreview', playerId: 'p0', cardId, category: cardId === 'S01' ? 'luck' : 'unluck' };
  return state;
}

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe('áudio de revelação entre partidas', () => {
  it('toca a primeira carta que chega depois de uma troca de match sem carta aberta', async () => {
    const initial = game();
    const { result, rerender } = renderHook(
      ({ matchId, state }) => useGameAudio({ board: board(matchId), state }),
      { initialProps: { matchId: 'm1', state: initial } },
    );
    await act(async () => { await result.current.enable(); });

    rerender({ matchId: 'm1', state: preview(initial, 'S01') });
    await act(async () => {});
    expect(audio.play).toHaveBeenLastCalledWith('luck');

    const next = game();
    rerender({ matchId: 'm2', state: next });
    await act(async () => {});
    rerender({ matchId: 'm2', state: preview(next, 'A01') });
    await act(async () => {});

    expect(audio.play).toHaveBeenCalledWith('unluck');
    expect(audio.play).toHaveBeenCalledTimes(2);
  });

  it('toca o primeiro pouso após o gesto, cria baseline no match novo e consome passos pausados', async () => {
    const state = game();
    const { result, rerender } = renderHook(
      ({ matchId, stepKey, paused }) => useGameAudio({ board: board(matchId), state, stepKey, visualSteps: true, paused }),
      { initialProps: { matchId: 'm1', stepKey: undefined as string | undefined, paused: false } },
    );
    await act(async () => { await result.current.enable(); });

    rerender({ matchId: 'm1', stepKey: 'passo-1', paused: false });
    await act(async () => {});
    expect(audio.play).toHaveBeenCalledWith('step');

    // A chave que veio junto da troca é estado atual, não um passo novo.
    rerender({ matchId: 'm2', stepKey: 'passo-1', paused: false });
    await act(async () => {});
    expect(audio.play).toHaveBeenCalledTimes(1);

    rerender({ matchId: 'm2', stepKey: 'passo-2', paused: true });
    await act(async () => {});
    rerender({ matchId: 'm2', stepKey: 'passo-2', paused: false });
    await act(async () => {});
    expect(audio.play).toHaveBeenCalledTimes(1);

    rerender({ matchId: 'm2', stepKey: 'passo-3', paused: false });
    await act(async () => {});
    expect(audio.play).toHaveBeenCalledTimes(2);
    expect(audio.play).toHaveBeenLastCalledWith('step');
  });
});
