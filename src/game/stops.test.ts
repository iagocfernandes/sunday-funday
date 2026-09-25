import { describe, expect, it } from 'vitest';
import { createV3Map as createDefaultMap, createLegacyMap, routeHint, validateMap } from '../data/map';
import { applyCommand, createGame } from './engine';
import type { Command, GameState, ItemId } from './types';
import { intAt } from './rng';
import { validateGameState } from '../persistence/validate';
const seeds = ['p0', 'p1', 'p2'].map(id => ({ id, name: id, color: '#abc', symbol: 'X', portrait: '/x.png' }));
function game() { return createGame(seeds, {}, { seed: 87, shuffleOrder: false, map: createDefaultMap() }); }
function result(s: GameState, command: Command) { return applyCommand(s, { commandId: `c-${s.revision}`, expectedRevision: s.revision, command }); }
function run(s: GameState, command: Command) { const r = result(s, command); expect(r.rejected).toBeUndefined(); return r.state; }
function walk(from: string, remaining = 2) { const s = game(); s.players.p0.nodeId = from; s.phase = 'moving'; s.players.p0.common = 100; s.movement = { remaining, traversed: [], activatesSpaces: true, direction: 'forward' }; return s; }
function item(id: ItemId) { const s = game(); s.phase = 'awaitingItemChoice'; s.pending = { kind: 'itemChoice', playerId: 'p0' }; s.players.p0.inventory = [{ uid: 'power', itemId: id }]; return s; }

describe('V3: serviços entre casas', () => {
  it('tem 36 casas, duas lojas e quatro árvores acessíveis em trechos válidos', () => {
    const map = createDefaultMap(); expect(validateMap(map)).toEqual({ ok: true, errors: [] });
    expect(Object.keys(map.nodes)).toHaveLength(36);
    expect(map.stops!.filter(s => s.kind === 'shop')).toHaveLength(2);
    expect(map.pedestalSpots).toHaveLength(4);
    expect(routeHint(map, 'm16', 'm17')).toContain('Barraca da Cachoeira');
    expect(routeHint(map, 'm16', 'b0')).toContain('Árvore da Clareira');
  });
  it('para na barraca sem gastar o último passo e só chega à casa depois da decisão', () => {
    let s = run(walk('m2', 1), { type: 'step' });
    expect(s.pending?.kind).toBe('shop'); expect(s.players.p0.nodeId).toBe('m2'); expect(s.movement?.remaining).toBe(1);
    expect(validateGameState(s).ok).toBe(true);
    s = run(JSON.parse(JSON.stringify(s)), { type: 'skipShop' });
    s = run(s, { type: 'step' });
    expect(s.players.p0.nodeId).toBe('m3'); expect(s.phase).toBe('resolvingSpace'); expect(s.movement).toBeNull();
  });
  it('compra e descarte são atômicos, sem cobrança ao rejeitar descarte inválido', () => {
    let s = walk('m2'); s.players.p0.inventory = ['a', 'b', 'c'].map(uid => ({ uid, itemId: 'bananaTurbo' }));
    s = run(s, { type: 'step' }); expect(s.pending?.kind).toBe('shop');
    const failed = result(s, { type: 'buyItem', itemId: 'dadoCerteiro', discardUid: 'estranho' });
    expect(failed.rejected).toBeDefined(); expect(failed.state).toBe(s);
    const bought = run(s, { type: 'buyItem', itemId: 'dadoCerteiro', discardUid: 'b' });
    expect(bought.players.p0.common).toBe(95); expect(bought.players.p0.inventory).toHaveLength(3);
    expect(bought.players.p0.inventory.some(i => i.uid === 'b')).toBe(false);
    expect(result(bought, { type: 'buyItem', itemId: 'dadoCerteiro', discardUid: 'a' }).rejected).toBeDefined();
    expect(run(bought, { type: 'step' }).players.p0.nodeId).toBe('m3');
  });
  it('colher salva nova árvore e exige confirmação antes de continuar', () => {
    let s = run(walk('m9', 1), { type: 'step' });
    expect(s.pending?.kind).toBe('pedestal');
    s = run(s, { type: 'buyGolden' });
    expect(s.players.p0.golden).toBe(1); expect(s.players.p0.common).toBe(80);
    expect(s.pedestalNodeId).not.toBe('tree-temple'); expect(s.pending?.kind).toBe('harvest'); expect(s.movement?.remaining).toBe(1);
    expect(validateGameState(s)).toEqual({ ok: true, errors: [] });
    expect(result(s, { type: 'buyGolden' }).rejected).toBeDefined();
    s = run(JSON.parse(JSON.stringify(s)), { type: 'continueHarvest' });
    s = run(s, { type: 'step' }); expect(s.players.p0.nodeId).toBe('m10'); expect(s.phase).toBe('resolvingSpace');
  });
  it('recusar mantém fruto, árvores inativas e ausência de saldo não interrompem', () => {
    let s = run(walk('m9'), { type: 'step' }); s = run(s, { type: 'skipPedestal' });
    expect(s.pedestalNodeId).toBe('tree-temple'); expect(run(s, { type: 'step' }).players.p0.nodeId).toBe('m10');
    const poor = walk('m9'); poor.players.p0.common = 0;
    expect(run(poor, { type: 'step' }).pending).toBeNull();
    const inactive = walk('m13'); expect(run(inactive, { type: 'step' }).pending).toBeNull();
  });
  it('não permite segunda banana no mesmo turno nem ativa paradas em movimento forçado', () => {
    const s = walk('m9'); s.goldenBoughtThisTurn = true;
    expect(run(s, { type: 'step' }).pending).toBeNull();
    const forced = walk('m2'); forced.movement!.activatesSpaces = false;
    expect(run(forced, { type: 'step' }).pending).toBeNull();
    const back = walk('m3'); back.movement!.direction = 'back'; back.players.p0.stepHistory = ['m2'];
    expect(run(back, { type: 'step' }).pending).toBeNull();
  });
  it('bifurcação escolhe o trecho persistido da parada antes de cobrar um passo', () => {
    const s = walk('m16');
    s.map.stops!.find(p => p.id === 'tree-glade')!.from = 'm16'; s.map.stops!.find(p => p.id === 'tree-glade')!.to = 'b0'; s.pedestalNodeId = 'tree-glade';
    const fork = run(s, { type: 'step' }); const stop = run(fork, { type: 'choosePath', nodeId: 'b0' });
    expect(stop.players.p0.nodeId).toBe('m16'); expect(stop.movement?.transit?.to).toBe('b0');
    const resumed = run(run(stop, { type: 'skipPedestal' }), { type: 'step' });
    expect(resumed.players.p0.nodeId).toBe('b0'); expect(resumed.movement?.remaining).toBe(1);
  });
  it('rejeita save com travessia quebrada e preserva mapa legado', () => {
    const s = run(walk('m2'), { type: 'step' }); s.movement!.transit!.to = 'm10';
    expect(validateGameState(s).ok).toBe(false);
    const legacy = createGame(seeds, {}, { map: createLegacyMap() });
    expect(legacy.config.cardMode).toBe('physical'); expect(legacy.config.shopItems).toContain('escudo'); expect(validateGameState(legacy).ok).toBe(true);
  });
});

describe('poderes digitais do novo mapa', () => {
  it('Dado Duplo soma duas rolagens persistíveis; Turbo soma cinco', () => {
    for (const id of ['dadoDuplo', 'bananaTurbo'] as const) {
      let s = item(id); const first = intAt(s.rngSeed, s.rngCursor, 1, 10), second = intAt(s.rngSeed, s.rngCursor + 1, 1, 10);
      s = run(s, { type: 'useItem', uid: 'power' }); s = run(s, { type: 'rollDice' });
      expect(s.dice).toBe(id === 'dadoDuplo' ? first + second : first + 5); expect(s.players.p0.inventory).toHaveLength(0);
    }
  });
  it('Dado Certeiro valida valor e só consome ao confirmar', () => {
    let s = run(item('dadoCerteiro'), { type: 'useItem', uid: 'power' });
    expect(result(s, { type: 'chooseDice', value: 11 }).rejected).toBeDefined(); expect(s.players.p0.inventory).toHaveLength(1);
    s = run(s, { type: 'chooseDice', value: 7 }); expect(validateGameState(s).ok).toBe(true);
    expect(run(s, { type: 'rollDice' }).dice).toBe(7);
  });
  it('Troca-Troca sorteia outro jogador, sem oferecer compra nem manter histórico falso', () => {
    const s = item('trocaTroca'); s.players.p1.nodeId = 'm17'; s.players.p2.nodeId = 'm9'; s.players.p0.stepHistory = ['m1'];
    const expected = ['p1','p2'][intAt(s.rngSeed, s.rngCursor, 0, 1)];
    const changed = run(s, { type: 'useItem', uid: 'power' });
    expect(changed.players.p0.nodeId).toBe(s.players[expected].nodeId); expect(changed.players[expected].nodeId).toBe('m0');
    expect(changed.players.p0.stepHistory).toEqual([]); expect(changed.pending).toBeNull(); expect(changed.phase).toBe('readyToRoll');
  });
  it('Mão no Bolso não gasta carta sem alvo e transfere uma cópia real com a mão cheia', () => {
    let s = item('maoNoBolso'); expect(result(s, { type: 'useItem', uid: 'power' }).rejected).toBeDefined();
    s.players.p0.inventory.push({ uid: 'two', itemId: 'dadoDuplo' }, { uid: 'three', itemId: 'bananaTurbo' });
    s.players.p1.inventory = [{ uid: 'stolen', itemId: 'dadoCerteiro' }];
    s = run(s, { type: 'useItem', uid: 'power' }); s = run(s, { type: 'stealItem', targetId: 'p1' });
    expect(s.players.p0.inventory).toHaveLength(3); expect(s.players.p0.inventory.some(i => i.uid === 'stolen')).toBe(true); expect(s.players.p1.inventory).toHaveLength(0);
  });
  it('Muda a Banana escolhe outra árvore, sem dar ponto, e a decisão de item não expira', () => {
    const s = item('mudaBanana'); const changed = run(s, { type: 'useItem', uid: 'power' });
    expect(changed.pedestalNodeId).not.toBe(s.pedestalNodeId); expect(changed.players.p0.golden).toBe(0);
    const turn = item('bananaTurbo'); turn.pending = null; turn.phase = 'turnStart';
    const started = run(turn, { type: 'beginTurn' }); expect(started.pending?.kind).toBe('itemChoice'); expect(started.itemWindow).toBeNull();
  });
  it('sorte digital não pode ser trocada e preserva um baralho válido', () => {
    let s = game(); const seen = new Set();
    for (let i = 0; i < 3; i++) {
      s.players.p0.nodeId = 'm9'; s.pending = null; s.phase = 'resolvingSpace';
      s = run(s, { type: 'resolveSpace' }); expect(s.pending?.kind).toBe('cardPreview');
      if (s.pending?.kind !== 'cardPreview') throw new Error('missing event');
      seen.add(s.pending.cardId);
      expect(result(s, { type: 'cancelCard' }).rejected).toBeDefined(); expect(validateGameState(s).ok).toBe(true);
    }
  });
});
