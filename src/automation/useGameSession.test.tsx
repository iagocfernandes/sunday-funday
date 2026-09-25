// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import { StrictMode, useEffect, useRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createLegacyMap } from '../data/map';
import { createGame } from '../game/engine';
import type { GameState } from '../game/types';
import { useGameSession, type Session } from './useGameSession';

function game(count = 3, overrides = {}): GameState {
  return createGame(
    Array.from({ length: count }, (_, i) => ({
      id: `p${i}`,
      name: `G${i}`,
      color: '#fff',
      symbol: '★',
      portrait: 'x.png',
    })),
    { rounds: 1, ...overrides },
    { seed: 4242, shuffleOrder: false, map: createLegacyMap() },
  );
}

let current: Session | null = null;
let renderCount = 0;
/** Quantos dados foram rolados: detecta rolagem duplicada. */
let diceRolls: number[] = [];

function Harness({ initialState }: { initialState: GameState }) {
  const session = useGameSession({ initialState, autoBackup: false });
  current = session;
  const lastDice = useRef<number | null>(null);
  renderCount += 1;
  useEffect(() => {
    if (session.state.dice !== null && session.state.dice !== lastDice.current) {
      diceRolls.push(session.state.dice);
    }
    lastDice.current = session.state.dice;
  });
  return <div data-testid="phase">{session.state.phase}</div>;
}

function mount(state: GameState, strict = false) {
  current = null;
  renderCount = 0;
  diceRolls = [];
  const tree = <Harness initialState={state} />;
  return render(strict ? <StrictMode>{tree}</StrictMode> : tree);
}

/**
 * Avança o relógio falso em fatias, deixando o React renderizar entre elas.
 * Sem isso, um único advance grande executaria só um passo da automação.
 */
async function advance(ms: number) {
  const slice = 50;
  for (let elapsed = 0; elapsed < ms; elapsed += slice) {
    await act(async () => {
      vi.advanceTimersByTime(slice);
    });
  }
}

async function call(fn: () => void) {
  await act(async () => {
    fn();
  });
}

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('coordenador automático', () => {
  it('não executa nada enquanto está pausado', async () => {
    mount(game());
    await call(() => current!.dispatch({ type: 'startRound' }));
    expect(current!.manualPaused).toBe(true);
    await advance(8000);
    expect(current!.state.phase).toBe('turnStart');
    expect(diceRolls).toHaveLength(0);
  });

  it('conduz o turno sozinho depois de Retomar', async () => {
    mount(game());
    await call(() => {
      current!.dispatch({ type: 'startRound' });
      current!.resume();
    });
    await advance(12000);
    // Sem pendências neste mapa/semente, o jogo avança por conta própria.
    expect(current!.state.revision).toBeGreaterThan(3);
    expect(diceRolls.length).toBeGreaterThan(0);
  });

  it('pausar no meio do movimento congela a execução', async () => {
    mount(game());
    await call(() => {
      current!.dispatch({ type: 'startRound' });
      current!.resume();
    });
    await advance(2000);
    await call(() => current!.pause());
    const frozen = current!.state.revision;
    await advance(6000);
    expect(current!.state.revision).toBe(frozen);
  });

  it('retomar não repete a ação já concluída nem rerola o dado', async () => {
    mount(game());
    await call(() => {
      current!.dispatch({ type: 'startRound' });
      current!.resume();
    });
    await advance(1600); // passa por turnStart + rollDice
    const dice = current!.state.dice;
    expect(dice).not.toBeNull();
    await call(() => current!.pause());
    await advance(5000);
    await call(() => current!.resume());
    await advance(300);
    // Enquanto o movimento não terminou, o dado continua o mesmo.
    if (current!.state.phase === 'moving') expect(current!.state.dice).toBe(dice);
    expect(diceRolls.filter((d) => d === dice)).toHaveLength(1);
  });

  it('aba oculta suspende e exige Retomar explícito', async () => {
    mount(game());
    await call(() => {
      current!.dispatch({ type: 'startRound' });
      current!.resume();
    });
    await advance(900);
    await call(() => {
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(current!.manualPaused).toBe(true);
    const frozen = current!.state.revision;
    await advance(6000);
    expect(current!.state.revision).toBe(frozen);
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
  });

  it('montagem dupla (StrictMode) não gera dois dados', async () => {
    mount(game(), true);
    await call(() => {
      current!.dispatch({ type: 'startRound' });
      current!.resume();
    });
    await advance(1600);
    const unique = new Set(diceRolls);
    expect(diceRolls.length).toBe(unique.size);
    expect(diceRolls.length).toBeLessThanOrEqual(2);
  });

  it('cliques duplicados produzem uma única transição', async () => {
    mount(game());
    await call(() => {
      const first = current!.dispatch({ type: 'startRound' });
      const second = current!.dispatch({ type: 'startRound' });
      expect(first).toBe(true);
      expect(second).toBe(false);
    });
    expect(current!.state.round).toBe(1);
    expect(current!.state.phase).toBe('turnStart');
  });
});

describe('janela de 5 segundos', () => {
  function withItem() {
    const state = game();
    state.players.p0.inventory = [{ uid: 'a', itemId: 'dadoDuplo' }];
    return state;
  }

  it('espera exatamente 5 s e segue sozinha', async () => {
    mount(withItem());
    await call(() => {
      current!.dispatch({ type: 'startRound' });
      current!.resume();
    });
    await advance(800); // beginTurn
    expect(current!.state.phase).toBe('itemWindow');
    await advance(4000);
    expect(current!.state.phase).toBe('itemWindow');
    expect(current!.itemRemainingMs).toBeLessThanOrEqual(1100);
    await advance(1200);
    expect(current!.state.phase).not.toBe('itemWindow');
    expect(current!.state.players.p0.inventory).toHaveLength(1); // seguiu sem usar
  });

  it('velocidade rápida não encurta a janela', async () => {
    mount(withItem());
    await call(() => {
      current!.setSpeed('fast');
      current!.dispatch({ type: 'startRound' });
      current!.resume();
    });
    await advance(500);
    expect(current!.state.phase).toBe('itemWindow');
    await advance(4000);
    expect(current!.state.phase).toBe('itemWindow');
    await advance(1300);
    expect(current!.state.phase).not.toBe('itemWindow');
  });

  it('pausar congela a contagem e retomar preserva o tempo restante', async () => {
    mount(withItem());
    await call(() => {
      current!.dispatch({ type: 'startRound' });
      current!.resume();
    });
    await advance(800);
    await advance(2000);
    const remaining = current!.itemRemainingMs!;
    await call(() => current!.pause());
    await advance(10000);
    expect(current!.itemRemainingMs).toBe(remaining);
    expect(current!.state.phase).toBe('itemWindow');
    await call(() => current!.resume());
    await advance(remaining + 200);
    expect(current!.state.phase).not.toBe('itemWindow');
  });

  it('Usar carta interrompe o prazo e a decisão nunca expira', async () => {
    mount(withItem());
    await call(() => {
      current!.dispatch({ type: 'startRound' });
      current!.resume();
    });
    await advance(800);
    await call(() => current!.dispatch({ type: 'requestItemChoice' }));
    expect(current!.state.phase).toBe('awaitingItemChoice');
    await advance(20000);
    expect(current!.state.phase).toBe('awaitingItemChoice');
  });

  it('uso tardio na fronteira do timeout é rejeitado', async () => {
    mount(withItem());
    await call(() => {
      current!.dispatch({ type: 'startRound' });
      current!.resume();
    });
    await advance(800);
    await advance(5200); // janela expirou
    let accepted = true;
    await call(() => {
      accepted = current!.dispatch({ type: 'requestItemChoice' });
    });
    expect(accepted).toBe(false);
  });

  it('quem não tem item utilizável não espera', async () => {
    mount(game());
    await call(() => {
      current!.dispatch({ type: 'startRound' });
      current!.resume();
    });
    await advance(800);
    expect(current!.state.phase).not.toBe('itemWindow');
    expect(current!.itemRemainingMs).toBeNull();
  });
});

describe('desfazer', () => {
  it('pausa, restaura o estado anterior e exige Retomar', async () => {
    mount(game());
    await call(() => {
      current!.dispatch({ type: 'startRound' });
      current!.resume();
    });
    await advance(1600);
    const before = current!.state.revision;
    await call(() => current!.undo());
    expect(current!.manualPaused).toBe(true);
    expect(current!.state.revision).toBeLessThan(before);
    const frozen = current!.state.revision;
    await advance(6000);
    expect(current!.state.revision).toBe(frozen);
  });

  it('desfazer com timer pendente não dispara o comando antigo', async () => {
    mount(game());
    await call(() => {
      current!.dispatch({ type: 'startRound' });
      current!.resume();
    });
    // Desfaz no meio do atraso agendado.
    await advance(300);
    await call(() => current!.undo());
    const frozen = current!.state.revision;
    await advance(5000);
    expect(current!.state.revision).toBe(frozen);
  });
});

describe('desfazer entre partidas', () => {
  // Regressão P1: jogar A, sair, abrir B e clicar Desfazer não pode trazer A.
  it('não restaura estado da partida anterior', async () => {
    const partidaA = game();
    mount(partidaA);
    await call(() => {
      current!.dispatch({ type: 'startRound' });
      current!.resume();
    });
    await advance(1600);
    const saldoA = current!.state.players.p0.common;
    const idA = current!.state.gameId;
    cleanup();

    // Nova partida, gameId diferente, mesma aba e mesmo localStorage.
    const partidaB = game();
    partidaB.gameId = `${idA}-outra`;
    partidaB.players.p0.common = 999;
    mount(partidaB);

    expect(current!.undoAvailable).toBe(false);
    await call(() => current!.undo());
    expect(current!.state.gameId).toBe(partidaB.gameId);
    expect(current!.state.players.p0.common).toBe(999);
    expect(current!.state.players.p0.common).not.toBe(saldoA);
  });

  it('continua desfazendo dentro da mesma partida', async () => {
    mount(game());
    await call(() => {
      current!.dispatch({ type: 'startRound' });
      current!.resume();
    });
    await advance(1600);
    const antes = current!.state.revision;
    expect(current!.undoAvailable).toBe(true);
    await call(() => current!.undo());
    expect(current!.state.revision).toBeLessThan(antes);
  });
});

describe('persistência durante a automação', () => {
  it('salva o estado antes de iniciar a apresentação', async () => {
    mount(game());
    await call(() => {
      current!.dispatch({ type: 'startRound' });
      current!.resume();
    });
    await advance(1600);
    const saved = JSON.parse(localStorage.getItem('sundayfunday:current')!);
    expect(saved.state.revision).toBe(current!.state.revision);
    expect(saved.state.dice).toBe(current!.state.dice);
  });

  it('render count permanece finito (sem loop de renderização)', async () => {
    mount(game());
    await call(() => current!.resume());
    await advance(3000);
    expect(renderCount).toBeLessThan(400);
  });
});

describe('interface mínima', () => {
  it('expõe a fase atual', async () => {
    mount(game());
    expect(screen.getByTestId('phase').textContent).toBe('roundReady');
  });
});
