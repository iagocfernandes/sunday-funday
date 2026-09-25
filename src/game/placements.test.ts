import { describe, expect, it } from 'vitest';
import {
  boxPositions,
  describePlacement,
  individualAwards,
  normalizePlacement,
  placementTiers,
} from './placements';

const ORDER = ['p0', 'p1', 'p2', 'p3'];
const REWARDS = { first: 10, second: 6, others: 3 };

describe('normalização da classificação', () => {
  it('aceita posições preenchidas em sequência', () => {
    const result = normalizePlacement(ORDER, [['p0'], ['p1'], ['p2']]);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.tiers).toEqual([['p0'], ['p1'], ['p2']]);
  });

  it('descarta grupos vazios no fim', () => {
    const result = normalizePlacement(ORDER, [['p0'], [], []]);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.tiers).toEqual([['p0']]);
  });

  // Regressão P1: primeiro grupo vazio não pode premiar o segundo como primeiro.
  it('recusa a primeira posição vazia com a segunda preenchida', () => {
    const result = normalizePlacement(ORDER, [[], ['p1']]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('1ª posição está vazia');
  });

  it('recusa lacuna no meio', () => {
    const result = normalizePlacement(ORDER, [['p0'], [], ['p2']]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('2ª posição está vazia');
  });

  it('recusa classificação totalmente vazia', () => {
    expect(normalizePlacement(ORDER, [[], [], []]).ok).toBe(false);
    expect(normalizePlacement(ORDER, []).ok).toBe(false);
  });

  it('recusa jogador repetido', () => {
    const result = normalizePlacement(ORDER, [['p0'], ['p0']]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('repetido');
  });

  it('recusa jogador desconhecido', () => {
    expect(normalizePlacement(ORDER, [['fantasma']]).ok).toBe(false);
  });

  it('recusa entrada que não é lista de listas', () => {
    expect(normalizePlacement(ORDER, 'primeiro lugar').ok).toBe(false);
    expect(normalizePlacement(ORDER, ['p0']).ok).toBe(false);
  });
});

describe('posições competitivas', () => {
  it('empate no primeiro leva o próximo à terceira posição', () => {
    expect(placementTiers([['p0', 'p1'], ['p2']])).toEqual([
      { position: 1, playerIds: ['p0', 'p1'] },
      { position: 3, playerIds: ['p2'] },
    ]);
  });

  it('sem empates as posições seguem 1, 2, 3', () => {
    expect(placementTiers([['p0'], ['p1'], ['p2']]).map((t) => t.position)).toEqual([1, 2, 3]);
  });

  it('empate triplo no primeiro leva o próximo à quarta posição', () => {
    expect(placementTiers([['p0', 'p1', 'p2'], ['p3']]).map((t) => t.position)).toEqual([1, 4]);
  });
});

describe('posições das caixas do formulário', () => {
  it('a posição da caixa vem dos grupos anteriores, não do índice', () => {
    expect(boxPositions([['p0', 'p1'], [], []])).toEqual([1, 3, null]);
  });

  it('caixa após uma vazia fica bloqueada', () => {
    expect(boxPositions([[], [], []])).toEqual([1, null, null]);
  });

  it('todas as caixas ficam disponíveis quando preenchidas em sequência', () => {
    expect(boxPositions([['p0'], ['p1'], []])).toEqual([1, 2, 3]);
  });
});

describe('premiação individual', () => {
  it('empatados no primeiro recebem o prêmio de primeiro e o seguinte recebe o de terceiro', () => {
    const awards = individualAwards(ORDER, [['p0', 'p1'], ['p2']], REWARDS);
    expect(awards).toEqual({ p0: 10, p1: 10, p2: 3, p3: 3 });
  });

  it('classificação simples usa 1º, 2º e participação', () => {
    const awards = individualAwards(ORDER, [['p0'], ['p1']], REWARDS);
    expect(awards).toEqual({ p0: 10, p1: 6, p2: 3, p3: 3 });
  });

  it('empate no segundo não gera dois prêmios de segundo para o terceiro', () => {
    const awards = individualAwards(ORDER, [['p0'], ['p1', 'p2'], ['p3']], REWARDS);
    expect(awards).toEqual({ p0: 10, p1: 6, p2: 6, p3: 3 });
  });
});

describe('texto registrado', () => {
  it('usa as mesmas posições competitivas da premiação', () => {
    const text = describePlacement([['p0', 'p1'], ['p2']], (id) => id.toUpperCase());
    expect(text).toBe('1º: P0, P1 | 3º: P2');
  });
});
