// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { applyCommand, createGame, type PlayerSeed } from '../game/engine';
import type { Command, GameState } from '../game/types';
import { MinigamePanel } from './MinigamePanel';

afterEach(cleanup);

function seeds(count: number): PlayerSeed[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `p${index}`, name: `P${index}`, color: '#fff', symbol: '●', portrait: '/player.png',
  }));
}

function run(state: GameState, command: Command): GameState {
  const result = applyCommand(state, { commandId: `ui-${state.revision}`, expectedRevision: state.revision, command });
  if (result.rejected) throw new Error(result.rejected);
  return result.state;
}

function resultsState(count: number, minigameId: string, seed = 1234): GameState {
  let state = createGame(seeds(count), { rounds: 1, minigameOrder: [minigameId] }, { seed, shuffleOrder: false });
  state.phase = 'turnEnd';
  state.activeIndex = state.order.length - 1;
  state = run(state, { type: 'endTurn' });
  return run(state, { type: 'startMinigame' });
}

function select(name: string) { fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${name}(?:\\s|$)`) })); }

describe('MinigamePanel modern rules', () => {
  it('accepts one BeerPong winner with 7 participants and submits that selection', () => {
    const dispatch = vi.fn(() => true);
    render(<MinigamePanel state={resultsState(7, 'beerpong')} dispatch={dispatch} />);
    select('P0');
    expect((screen.getByRole('button', { name: 'Revisar e confirmar' }) as HTMLButtonElement).disabled).toBe(false);
    select('Revisar e confirmar');
    select('Confirmar premiação');
    expect(dispatch).toHaveBeenLastCalledWith(expect.objectContaining({ type: 'submitResults', winnerIds: ['p0'] }));
  });

  it('does not allow a solo winner with 8 participants', () => {
    render(<MinigamePanel state={resultsState(8, 'switch-tennis')} dispatch={() => true} />);
    select('P0');
    expect(screen.getByText('Selecione exatamente dois vencedores.')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Revisar e confirmar' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('submits a winning duo with 10 participants', () => {
    const dispatch = vi.fn(() => true);
    render(<MinigamePanel state={resultsState(10, 'jamboree')} dispatch={dispatch} />);
    select('P0'); select('P1'); select('Revisar e confirmar'); select('Confirmar premiação');
    expect(dispatch).toHaveBeenLastCalledWith(expect.objectContaining({ winnerIds: ['p0', 'p1'] }));
  });

  it('previews the finale golden banana and sends one winner', () => {
    const dispatch = vi.fn(() => true);
    render(<MinigamePanel state={resultsState(7, 'party-finale')} dispatch={dispatch} />);
    select('P2');
    expect(screen.getByLabelText('Prévia da premiação').textContent).toContain('P2: +0 🪙 · +1 🍌');
    select('Revisar e confirmar'); select('Confirmar premiação');
    expect(dispatch).toHaveBeenLastCalledWith(expect.objectContaining({ winnerIds: ['p2'] }));
  });

  it('does not render the persisted Coup exclusion as a selectable winner', () => {
    const state = resultsState(8, 'coup');
    const excluded = state.minigame?.excludedPlayerIds?.[0]!;
    render(<MinigamePanel state={state} dispatch={() => true} />);
    expect(screen.getByText(new RegExp(`Fora da prova .*${state.players[excluded].name}`))).toBeTruthy();
    expect(screen.queryByRole('button', { name: state.players[excluded].name })).toBeNull();
  });

  it('leaves review mode when a selection is corrected', () => {
    render(<MinigamePanel state={resultsState(7, 'beerpong')} dispatch={() => true} />);
    select('P0'); select('Revisar e confirmar');
    expect(screen.getByRole('button', { name: 'Confirmar premiação' })).toBeTruthy();
    select('P0');
    expect(screen.queryByRole('button', { name: 'Confirmar premiação' })).toBeNull();
    expect((screen.getByRole('button', { name: 'Revisar e confirmar' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('resets a selection and review when the match or round changes', () => {
    const first = resultsState(7, 'beerpong');
    const view = render(<MinigamePanel state={first} dispatch={() => true} />);
    select('P0'); select('Revisar e confirmar');
    const next = { ...resultsState(7, 'beerpong'), gameId: 'new-match', round: 2 };
    view.rerender(<MinigamePanel state={next} dispatch={() => true} />);
    expect(screen.queryByRole('button', { name: 'Confirmar premiação' })).toBeNull();
    expect(screen.getByRole('button', { name: 'P0' }).getAttribute('aria-pressed')).toBe('false');
  });

  it('keeps the review open and reports a rejected dispatch', () => {
    render(<MinigamePanel state={resultsState(7, 'beerpong')} dispatch={() => false} />);
    select('P0'); select('Revisar e confirmar'); select('Confirmar premiação');
    expect(screen.getByRole('alert').textContent).toContain('O resultado não foi registrado');
    expect(screen.getByRole('button', { name: 'Confirmar premiação' })).toBeTruthy();
  });
});
