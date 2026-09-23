// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createGame } from '../game/engine';
import { SCHEMA_VERSION } from '../game/types';
import {
  clearSaved,
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

  it('arquivo inválido não destrói a partida salva', () => {
    const state = game();
    saveSnapshot(state, control);
    parseImport('lixo');
    expect(loadSnapshot()!.state.gameId).toBe(state.gameId);
  });
});

describe('desfazer', () => {
  it('empilha e restaura o estado anterior', () => {
    const a = game();
    const b = structuredClone(a);
    b.players.p0.common = 99;
    pushUndo(a);
    pushUndo(b);
    expect(undoDepth()).toBe(2);
    expect(popUndo()!.players.p0.common).toBe(99);
    expect(popUndo()!.players.p0.common).toBe(a.players.p0.common);
    expect(popUndo()).toBeNull();
  });
});
