import { describe, expect, it } from 'vitest';
import { createGame } from '../game/engine';
import type { GameState } from '../game/types';
import { validateGameState } from './validate';

function game(): GameState {
  return createGame(
    [
      { id: 'p0', name: 'A', color: '#fff', symbol: '★', portrait: 'a.png' },
      { id: 'p1', name: 'B', color: '#000', symbol: '▲', portrait: 'b.png' },
    ],
    { rounds: 2 },
    { seed: 7, shuffleOrder: false },
  );
}

/** Serializa e desserializa, como acontece num arquivo importado. */
function roundTrip(mutate: (state: GameState) => void): GameState {
  const state = game();
  mutate(state);
  return JSON.parse(JSON.stringify(state));
}

function errorsOf(mutate: (state: GameState) => void): string[] {
  const result = validateGameState(roundTrip(mutate));
  return result.errors;
}

describe('estado legítimo', () => {
  it('aceita um estado recém-criado', () => {
    const result = validateGameState(game());
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it('aceita estados intermediários reais do motor', () => {
    const emMovimento = roundTrip((state) => {
      state.phase = 'moving';
      state.dice = 4;
      state.movement = { remaining: 2, traversed: ['m1', 'm2'], activatesSpaces: true, direction: 'forward' };
      state.players.p0.nodeId = 'm2';
      state.players.p0.stepHistory = ['m0', 'm1'];
    });
    expect(validateGameState(emMovimento).ok).toBe(true);

    const emDecisao = roundTrip((state) => {
      state.phase = 'awaitingPath';
      state.pending = { kind: 'path', playerId: 'p0', options: ['m5', 'a0'] };
    });
    expect(validateGameState(emDecisao).ok).toBe(true);

    const comItem = roundTrip((state) => {
      state.phase = 'itemWindow';
      state.itemWindow = { playerId: 'p0', remainingMs: 3200 };
      state.players.p0.inventory = [{ uid: 'i1', itemId: 'dadoDuplo' }];
    });
    expect(validateGameState(comItem).ok).toBe(true);
  });
});

describe('estruturas malformadas não lançam exceção', () => {
  const lixo: unknown[] = [
    null, undefined, 42, 'texto', [], true,
    { state: {} },
    { map: null, players: null },
    { phase: 'roundReady', map: { nodes: 'não é objeto' } },
    { phase: 'roundReady', map: { nodes: { m0: 7 } } },
  ];

  it.each(lixo.map((v, i) => [i, v]))('entrada malformada %i devolve erro', (_i, value) => {
    const result = validateGameState(value);
    expect(result.ok).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});

describe('valores inválidos que não são negativos', () => {
  it('recusa saldo fracionário', () => {
    expect(errorsOf((s) => { s.players.p0.common = 3.5; }).join()).toContain('moedas');
  });

  it('recusa saldo NaN ou infinito', () => {
    // NaN/Infinity viram null no JSON: continuam inválidos.
    expect(validateGameState(roundTrip((s) => { s.players.p0.common = NaN; })).ok).toBe(false);
    expect(validateGameState(roundTrip((s) => { s.players.p0.golden = Infinity; })).ok).toBe(false);
  });

  it('recusa saldo negativo', () => {
    expect(validateGameState(roundTrip((s) => { s.players.p0.common = -1; })).ok).toBe(false);
  });

  it('recusa revisão fracionária', () => {
    expect(validateGameState(roundTrip((s) => { s.revision = 2.7; })).ok).toBe(false);
  });
});

describe('enums e referências', () => {
  it('recusa fase arbitrária', () => {
    const result = validateGameState(roundTrip((s) => { (s as unknown as { phase: string }).phase = 'ganharTudo'; }));
    expect(result.ok).toBe(false);
    expect(result.errors[0]).toContain('Fase desconhecida');
  });

  it('recusa item desconhecido no inventário', () => {
    const result = validateGameState(roundTrip((s) => {
      s.players.p0.inventory = [{ uid: 'x', itemId: 'bananaMagica' as never }];
    }));
    expect(result.ok).toBe(false);
    expect(result.errors.join()).toContain('Item desconhecido');
  });

  it('recusa identificadores de item repetidos', () => {
    const result = validateGameState(roundTrip((s) => {
      s.players.p0.inventory = [{ uid: 'dup', itemId: 'escudo' }];
      s.players.p1.inventory = [{ uid: 'dup', itemId: 'casca' }];
    }));
    expect(result.ok).toBe(false);
    expect(result.errors.join()).toContain('repetido');
  });

  it('recusa inventário acima do limite configurado', () => {
    const result = validateGameState(roundTrip((s) => {
      s.config.inventoryLimit = 1;
      s.players.p0.inventory = [
        { uid: 'a', itemId: 'escudo' },
        { uid: 'b', itemId: 'casca' },
      ];
    }));
    expect(result.ok).toBe(false);
  });

  it('recusa tipo de casa desconhecido', () => {
    const result = validateGameState(roundTrip((s) => {
      (s.map.nodes.m1 as unknown as { kind: string }).kind = 'buracoNegro';
    }));
    expect(result.ok).toBe(false);
  });

  it('recusa activeIndex fora da ordem', () => {
    expect(validateGameState(roundTrip((s) => { s.activeIndex = 9; })).ok).toBe(false);
    expect(validateGameState(roundTrip((s) => { s.activeIndex = -1; })).ok).toBe(false);
  });

  it('recusa rodada maior que o total configurado', () => {
    expect(validateGameState(roundTrip((s) => { s.round = 99; })).ok).toBe(false);
  });

  it('recusa ordem com repetições', () => {
    expect(validateGameState(roundTrip((s) => { s.order = ['p0', 'p0']; })).ok).toBe(false);
  });

  it('recusa premiação registrada para jogador inexistente', () => {
    const result = validateGameState(roundTrip((s) => {
      s.results = [{ round: 1, minigameId: 'quiz', format: 'individual', awards: { fantasma: 3 }, detail: '' }];
    }));
    expect(result.ok).toBe(false);
  });
});

describe('coerência entre fase e decisão pendente', () => {
  it('recusa decisão pendente numa fase automática', () => {
    const result = validateGameState(roundTrip((s) => {
      s.phase = 'moving';
      s.movement = { remaining: 1, traversed: [], activatesSpaces: true, direction: 'forward' };
      s.pending = { kind: 'itemChoice', playerId: 'p0' };
    }));
    expect(result.ok).toBe(false);
    expect(result.errors.join()).toContain('não pode ter decisão pendente');
  });

  it('recusa fase de decisão sem decisão pendente', () => {
    const result = validateGameState(roundTrip((s) => { s.phase = 'awaitingPath'; }));
    expect(result.ok).toBe(false);
    expect(result.errors.join()).toContain('exige uma decisão pendente');
  });

  it('recusa decisão pendente de tipo desconhecido', () => {
    const result = validateGameState(roundTrip((s) => {
      s.phase = 'awaitingInteraction';
      s.pending = { kind: 'trapaça' } as never;
    }));
    expect(result.ok).toBe(false);
  });

  it('recusa bifurcação apontando para casa inexistente', () => {
    const result = validateGameState(roundTrip((s) => {
      s.phase = 'awaitingPath';
      s.pending = { kind: 'path', playerId: 'p0', options: ['m5', 'nao-existe'] };
    }));
    expect(result.ok).toBe(false);
  });

  it('recusa defesa citando item que o alvo não possui', () => {
    const result = validateGameState(roundTrip((s) => {
      s.phase = 'awaitingInteraction';
      s.players.p0.inventory = [{ uid: 'casca1', itemId: 'casca' }];
      s.pending = {
        kind: 'defense',
        attackerId: 'p0',
        targetId: 'p1',
        amount: 3,
        options: [{ uid: 'escudo-fantasma', itemId: 'escudo' }],
        blockable: true,
        reversible: true,
        source: { type: 'item', uid: 'casca1' },
        resume: 'readyToRoll',
      };
    }));
    expect(result.ok).toBe(false);
    expect(result.errors.join()).toContain('não possui');
  });

  it('aceita uma defesa coerente', () => {
    const result = validateGameState(roundTrip((s) => {
      s.phase = 'awaitingInteraction';
      s.players.p0.inventory = [{ uid: 'casca1', itemId: 'casca' }];
      s.players.p1.inventory = [{ uid: 'esc1', itemId: 'escudo' }];
      s.pending = {
        kind: 'defense',
        attackerId: 'p0',
        targetId: 'p1',
        amount: 3,
        options: [{ uid: 'esc1', itemId: 'escudo' }],
        blockable: true,
        reversible: true,
        source: { type: 'item', uid: 'casca1' },
        resume: 'readyToRoll',
      };
    }));
    expect(result.errors).toEqual([]);
  });
});

describe('configuração', () => {
  it('recusa configuração com números inválidos', () => {
    expect(validateGameState(roundTrip((s) => { s.config.goldenPrice = 0; })).ok).toBe(false);
    expect(validateGameState(roundTrip((s) => { s.config.rounds = 0; })).ok).toBe(false);
    expect(validateGameState(roundTrip((s) => { s.config.diceMax = 1; s.config.diceMin = 5; })).ok).toBe(false);
  });

  it('recusa item desconhecido na loja', () => {
    expect(validateGameState(roundTrip((s) => { s.config.shopItems = ['ouro' as never]; })).ok).toBe(false);
  });

  it('recusa tabela de premiação incompleta', () => {
    expect(validateGameState(roundTrip((s) => {
      delete (s.config.rewards.individual as Partial<typeof s.config.rewards.individual>).second;
    })).ok).toBe(false);
  });
});
