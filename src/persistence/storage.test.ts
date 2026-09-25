// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createGame } from '../game/engine';
import { SCHEMA_VERSION } from '../game/types';
import {
  clearSaved,
  dropForeignUndo,
  loadSnapshotDetailed,
  exportSnapshot,
  loadSnapshot,
  parseImport,
  popUndo,
  pushUndo,
  saveSnapshot,
  undoDepth,
} from './storage';

const control = { itemWindowRemainingMs: null, speed: 'normal' as const };

function game() {
  return createGame(
    [
      { id: 'p0', name: 'A', color: '#fff', symbol: '★', portrait: 'a.png' },
      { id: 'p1', name: 'B', color: '#000', symbol: '▲', portrait: 'b.png' },
    ],
    { rounds: 2 },
    { seed: 99, shuffleOrder: false },
  );
}

/** Uma segunda partida, com gameId necessariamente diferente. */
function otherGame() {
  const other = createGame(
    [
      { id: 'p0', name: 'C', color: '#fff', symbol: '★', portrait: 'c.png' },
      { id: 'p1', name: 'D', color: '#000', symbol: '▲', portrait: 'd.png' },
    ],
    { rounds: 2 },
    { seed: 12345, shuffleOrder: false },
  );
  other.gameId = `${other.gameId}-outra`;
  return other;
}

beforeEach(() => {
  localStorage.clear();
});

describe('autosave', () => {
  it('salva e recupera o estado com o mesmo saldo e fase', () => {
    const state = game();
    state.players.p0.common = 17;
    state.phase = 'awaitingPath';
    state.pending = { kind: 'path', playerId: 'p0', options: ['m1', 'a0'] };
    state.dice = 7;

    expect(saveSnapshot(state, control).ok).toBe(true);
    const loaded = loadSnapshot()!;
    expect(loaded.state.players.p0.common).toBe(17);
    expect(loaded.state.phase).toBe('awaitingPath');
    expect(loaded.state.pending).toEqual(state.pending);
    // O dado já rolado é preservado: retomar não rerola.
    expect(loaded.state.dice).toBe(7);
    expect(loaded.state.revision).toBe(state.revision);
  });

  it('preserva o tempo restante da janela de item', () => {
    const state = game();
    state.itemWindow = { playerId: 'p0', remainingMs: 2300 };
    saveSnapshot(state, { itemWindowRemainingMs: 2300, speed: 'fast' });
    const loaded = loadSnapshot()!;
    expect(loaded.control.itemWindowRemainingMs).toBe(2300);
    expect(loaded.control.speed).toBe('fast');
  });

  it('reporta falha de gravação em vez de dizer que salvou', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      const error = new Error('cheio');
      error.name = 'QuotaExceededError';
      throw error;
    });
    const result = saveSnapshot(game(), control);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('QuotaExceededError');
    spy.mockRestore();
  });

  it('clearSaved remove a partida', () => {
    saveSnapshot(game(), control);
    clearSaved();
    expect(loadSnapshot()).toBeNull();
  });
});

describe('export / import', () => {
  it('faz round-trip sem perder nada', () => {
    const state = game();
    state.players.p1.golden = 2;
    const text = exportSnapshot(state, control);
    const result = parseImport(text);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.snapshot.state.players.p1.golden).toBe(2);
      expect(result.snapshot.state.gameId).toBe(state.gameId);
    }
  });

  it('rejeita JSON inválido', () => {
    expect(parseImport('{nope').ok).toBe(false);
  });

  it('rejeita arquivo sem estado', () => {
    expect(parseImport('{"schemaVersion":1}').ok).toBe(false);
  });

  it('rejeita versão de schema futura', () => {
    const state = game();
    const raw = JSON.parse(exportSnapshot(state, control));
    raw.schemaVersion = SCHEMA_VERSION + 5;
    expect(parseImport(JSON.stringify(raw)).ok).toBe(false);
  });

  it('rejeita referência quebrada de jogador', () => {
    const state = game();
    const raw = JSON.parse(exportSnapshot(state, control));
    raw.state.order.push('fantasma');
    const result = parseImport(JSON.stringify(raw));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('fantasma');
  });

  it('rejeita jogador em casa inexistente', () => {
    const state = game();
    const raw = JSON.parse(exportSnapshot(state, control));
    raw.state.players.p0.nodeId = 'nao-existe';
    expect(parseImport(JSON.stringify(raw)).ok).toBe(false);
  });

  it('rejeita mapa inválido', () => {
    const state = game();
    const raw = JSON.parse(exportSnapshot(state, control));
    raw.state.map.nodes.m0.next = ['fantasma'];
    expect(parseImport(JSON.stringify(raw)).ok).toBe(false);
  });

  // Regressão P1: casos que passavam pela validação antiga da importação.
  it('rejeita saldo inválido que não é negativo', () => {
    const raw = JSON.parse(exportSnapshot(game(), control));
    raw.state.players.p0.common = 3.5;
    expect(parseImport(JSON.stringify(raw)).ok).toBe(false);
  });

  it('rejeita fase arbitrária', () => {
    const raw = JSON.parse(exportSnapshot(game(), control));
    raw.state.phase = 'ganhouTudo';
    expect(parseImport(JSON.stringify(raw)).ok).toBe(false);
  });

  it('rejeita item desconhecido no inventário', () => {
    const raw = JSON.parse(exportSnapshot(game(), control));
    raw.state.players.p0.inventory = [{ uid: 'x', itemId: 'bananaMagica' }];
    expect(parseImport(JSON.stringify(raw)).ok).toBe(false);
  });

  it('rejeita activeIndex fora da ordem', () => {
    const raw = JSON.parse(exportSnapshot(game(), control));
    raw.state.activeIndex = 42;
    expect(parseImport(JSON.stringify(raw)).ok).toBe(false);
  });

  it('rejeita decisão pendente incoerente com a fase', () => {
    const raw = JSON.parse(exportSnapshot(game(), control));
    raw.state.phase = 'awaitingPath';
    raw.state.pending = null;
    expect(parseImport(JSON.stringify(raw)).ok).toBe(false);
  });

  it('estrutura aninhada malformada devolve erro em vez de exceção', () => {
    const casos = [
      '{"schemaVersion":1,"state":{"map":null}}',
      '{"schemaVersion":1,"state":{"map":{"nodes":"texto"},"players":{}}}',
      '{"schemaVersion":1,"state":{"map":{"nodes":{"m0":7}},"players":null,"order":[]}}',
      '{"schemaVersion":1,"state":[]}',
      '[]',
    ];
    for (const caso of casos) {
      expect(() => parseImport(caso)).not.toThrow();
      expect(parseImport(caso).ok).toBe(false);
    }
  });

  it('arquivo inválido não destrói a partida salva', () => {
    const state = game();
    saveSnapshot(state, control);
    parseImport('lixo');
    expect(loadSnapshot()!.state.gameId).toBe(state.gameId);
  });
});

describe('desfazer', () => {
  it('empilha e restaura o estado anterior da mesma partida', () => {
    const a = game();
    const b = structuredClone(a);
    b.players.p0.common = 99;
    pushUndo(a);
    pushUndo(b);
    expect(undoDepth(a.gameId)).toBe(2);
    expect(popUndo(a.gameId)!.players.p0.common).toBe(99);
    expect(popUndo(a.gameId)!.players.p0.common).toBe(a.players.p0.common);
    expect(popUndo(a.gameId)).toBeNull();
  });

  // Regressão P1: Desfazer não pode restaurar o estado de outra partida.
  it('não restaura estado de outra partida', () => {
    const partidaA = game();
    partidaA.players.p0.common = 77;
    pushUndo(partidaA);

    const partidaB = otherGame();
    expect(partidaB.gameId).not.toBe(partidaA.gameId);
    expect(undoDepth(partidaB.gameId)).toBe(0);
    expect(popUndo(partidaB.gameId)).toBeNull();
  });

  it('descarta a pilha ao abrir outra partida', () => {
    const partidaA = game();
    pushUndo(partidaA);
    const partidaB = otherGame();

    expect(dropForeignUndo(partidaB.gameId)).toBe(true);
    expect(undoDepth(partidaB.gameId)).toBe(0);
    // E a pilha da partida A também não volta depois disso.
    expect(popUndo(partidaA.gameId)).toBeNull();
  });

  it('empilhar noutra partida substitui a pilha antiga', () => {
    const partidaA = game();
    pushUndo(partidaA);
    const partidaB = otherGame();
    pushUndo(partidaB);

    expect(undoDepth(partidaB.gameId)).toBe(1);
    expect(undoDepth(partidaA.gameId)).toBe(0);
    expect(popUndo(partidaB.gameId)!.gameId).toBe(partidaB.gameId);
  });

  it('pilha em formato antigo é descartada em vez de restaurada', () => {
    const partida = game();
    // Formato da versão anterior: array simples, sem gameId.
    localStorage.setItem('sundayfunday:undo', JSON.stringify([partida]));
    expect(undoDepth(partida.gameId)).toBe(0);
    expect(popUndo(partida.gameId)).toBeNull();
  });
});

describe('retomada valida o estado salvo', () => {
  it('recusa snapshot atual corrompido e recupera o anterior', () => {
    const bom = game();
    bom.players.p0.common = 42;
    saveSnapshot(bom, control); // vira o "atual"

    const ruim = structuredClone(bom);
    ruim.players.p0.common = -5; // saldo impossível
    saveSnapshot(ruim, control); // empurra o bom para "previous"

    const result = loadSnapshotDetailed()!;
    expect(result.origin).toBe('previous');
    expect(result.snapshot.state.players.p0.common).toBe(42);
    expect(result.recoveredFrom).toBeTruthy();
  });

  it('recusar um estado não apaga o último estado válido', () => {
    const bom = game();
    saveSnapshot(bom, control);
    const antes = localStorage.getItem('sundayfunday:current');

    parseImport('{"schemaVersion":1,"state":{"phase":"inexistente"}}');
    loadSnapshotDetailed();

    expect(localStorage.getItem('sundayfunday:current')).toBe(antes);
  });

  it('não retorna nada quando atual e anterior estão corrompidos', () => {
    localStorage.setItem('sundayfunday:current', '{"nope":true}');
    localStorage.setItem('sundayfunday:previous', 'lixo');
    expect(loadSnapshotDetailed()).toBeNull();
  });

  it('estado válido é carregado direto do atual', () => {
    const bom = game();
    saveSnapshot(bom, control);
    const result = loadSnapshotDetailed()!;
    expect(result.origin).toBe('current');
  });
});
