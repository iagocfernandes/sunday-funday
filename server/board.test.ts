import { describe, expect, it } from 'vitest';
import { createLegacyMap, createV4Map } from '../src/data/map';
import { cardsOfCategory } from '../src/data/cards';
import type { Command } from '../src/game/types';
import type { RoomReply } from '../src/remote/types';
import { MAX_STEPS_PER_REQUEST, PRESENTATION_GRACE_MS } from './board';
import { RoomService, type RoomStore, type StoredRoom } from './room';

class MemoryStore implements RoomStore {
  data = new Map<string, StoredRoom>();
  async get(code: string) { return structuredClone(this.data.get(code) ?? null); }
  async create(room: StoredRoom) { if (this.data.has(room.code)) return false; this.data.set(room.code, structuredClone(room)); return true; }
  async compareAndSet(before: StoredRoom, after: StoredRoom) {
    if (JSON.stringify(this.data.get(before.code)) !== JSON.stringify(before)) return false;
    this.data.set(after.code, structuredClone(after)); return true;
  }
}
const host = 'a'.repeat(64), p1 = 'b'.repeat(64), p2 = 'c'.repeat(64), outsider = 'd'.repeat(64), code = 'BRD234';

async function boardRoom(seed = 12345, finishOpening = true) {
  const store = new MemoryStore(); let now = 1_000_000, n = 0;
  const service = new RoomService(store, () => now, () => { throw new Error('dice mode RNG must not run in board mode'); }, () => seed);
  const id = () => `cmd-${String(++n).padStart(10, '0')}`;
  await service.create(code, host, 'board');
  const a = await service.command(code, p1, id(), { type: 'join', name: 'Iago' });
  const b = await service.command(code, p2, id(), { type: 'join', name: 'Emiliano' });
  const started = await service.command(code, host, id(), { type: 'start' });
  const opening = started.room.board!.presentation;
  const ready = finishOpening && opening
    ? await service.command(code, host, id(), {
      type: 'finishPresentation', matchId: started.room.board!.matchId, presentationId: opening.id,
    })
    : started;
  const begun = finishOpening ? await service.read(code, host) : ready;
  const tokenOf = (playerId: string | null) => playerId === a.playerId ? p1 : p2;
  const f = {
    store, service, id, tokenOf, p1Id: a.playerId!, p2Id: b.playerId!,
    tick: (ms: number) => { now += ms; },
    now: () => now,
    read: () => service.read(code, host),
    game: (reply: RoomReply) => reply.room.board!.game,
    host: (reply: RoomReply, command: Command) => service.command(code, host, id(), { type: 'game', matchId: reply.room.board!.matchId, revision: reply.room.board!.game.revision, command }),
    stored: () => store.data.get(code)!,
  };
  return { ...f, opening, started: begun };
}
type Fixture = Awaited<ReturnType<typeof boardRoom>>;

/** Deixa o tempo correr até a partida parar esperando alguém. */
async function settleTurn(f: Fixture) {
  let reply = await f.read();
  for (let i = 0; i < 200; i++) {
    const g = f.game(reply);
    if (reply.room.board!.presentation) { f.tick(1000); reply = await f.read(); continue; }
    if (g.phase !== 'itemWindow' && (g.pending || ['readyToRoll', 'roundReady', 'minigameIntro', 'awaitingResults', 'roundEnd', 'finished', 'awaitingPath', 'awaitingItemChoice'].includes(g.phase))) return reply;
    f.tick(1000); reply = await f.read();
  }
  throw new Error('board never settled');
}

/** Resolve na TV (anfitrião) qualquer decisão pendente, como o operador faria. */
function hostDecision(f: Fixture, reply: RoomReply): Command {
  const g = f.game(reply); const pending = g.pending!;
  switch (pending.kind) {
    case 'discardPower': return {type:'discardPower',uid:g.players[pending.playerId].inventory[0].uid};
    case 'iagugu': return {type:'skipIagugu'};
    case 'duelBet': return {type:'setDuelBet',amount:Math.min(1,pending.maxBet)};
    case 'duelResult': return {type:'resolveDuel',winnerId:null};
    case 'harvest': return { type: 'continueHarvest' };
    case 'chooseDice': return { type: 'chooseDice', value: 3 };
    case 'stealItem': return { type: 'stealItem', targetId: pending.candidates[0] };
    case 'path': return { type: 'choosePath', nodeId: pending.options[0] };
    case 'shop': return { type: 'skipShop' };
    case 'pedestal': return { type: 'buyGolden' };
    case 'cardCode': return { type: 'submitCardCode', code: cardsOfCategory(pending.category).find(c => c.effectType !== 'moveBack')!.code };
    case 'cardPreview': return { type: 'confirmCard' };
    case 'target': return { type: 'chooseTarget', targetId: pending.candidates[0] };
    case 'defense': return { type: 'resolveDefense', choice: 'none' };
    case 'itemChoice': return { type: 'cancelItemChoice' };
  }
}

describe('remote board: engine authority on the server', () => {
  it('publishes the opening with server time and only the host can finish its exact id', async () => {
    const f = await boardRoom(12345, false);
    const board = f.started.room.board!;
    const opening = board.presentation!;
    expect(opening.clip).toBe('opening');
    expect(opening.expiresAt).toBe(f.now() + opening.durationMs + PRESENTATION_GRACE_MS);

    await expect(f.service.command(code, p1, f.id(), {
      type: 'finishPresentation', matchId: board.matchId, presentationId: opening.id,
    })).rejects.toThrow('anfitrião');
    await expect(f.service.command(code, f.tokenOf(f.game(f.started).order[0]), f.id(), {
      type: 'roll', turn: f.started.room.turn, matchId: board.matchId,
    })).rejects.toThrow('apresentação');

    const finished = await f.service.command(code, host, f.id(), {
      type: 'finishPresentation', matchId: board.matchId, presentationId: opening.id,
    });
    expect(finished.room.board!.presentation).toBeNull();
    const replay = await f.service.command(code, host, f.id(), {
      type: 'finishPresentation', matchId: board.matchId, presentationId: opening.id,
    });
    expect(replay.room.board!.presentation).toBeNull();

    const current = f.stored().board!;
    current.presentation = { ...opening, id: 'new-presentation', expiresAt: f.now() + 5000 };
    const stale = await f.service.command(code, host, f.id(), {
      type: 'finishPresentation', matchId: board.matchId, presentationId: opening.id,
    });
    expect(stale.room.board!.presentation?.id).toBe('new-presentation');
  });

  it('expires presentation fail-open but keeps a manual pause authoritative', async () => {
    const automatic = await boardRoom(12345, false);
    const initialRevision = automatic.game(automatic.started).revision;
    automatic.tick(automatic.opening!.expiresAt - automatic.now());
    const reply = await automatic.read();
    expect(reply.room.board!.presentation).toBeNull();
    expect(automatic.game(reply).revision).toBe(initialRevision + 1);

    const manual = await boardRoom(54321, false);
    const matchId = manual.started.room.board!.matchId;
    const paused = await manual.service.command(code, host, manual.id(), { type: 'pause', matchId });
    expect(paused.room.board!.paused).toBe(true);
    manual.tick(manual.opening!.expiresAt - manual.now());
    const expired = await manual.read();
    expect(expired.room.board!.presentation).toBeNull();
    expect(expired.room.board!.paused).toBe(true);
    const resumed = await manual.service.command(code, host, manual.id(), { type: 'resume', matchId });
    expect(resumed.room.board!.paused).toBe(false);
  });

  it('allows completion and fail-open expiry of the final cue after the room is finished', async () => {
    const f = await boardRoom(777, false);
    const stored = f.stored();
    stored.phase = 'finished';
    stored.board!.game.phase = 'finished';
    const presentation = stored.board!.presentation!;

    const reply = await f.service.command(code, host, f.id(), {
      type: 'finishPresentation', matchId: stored.board!.matchId, presentationId: presentation.id,
    });

    expect(reply.room.phase).toBe('finished');
    expect(reply.room.board!.presentation).toBeNull();

    const timeout = await boardRoom(778, false);
    const timedStored = timeout.stored();
    timedStored.phase = 'finished';
    timedStored.board!.game.phase = 'finished';
    const gameRevision = timedStored.board!.game.revision;
    timeout.tick(timedStored.board!.presentation!.expiresAt - timeout.now());
    const expired = await timeout.read();
    expect(expired.room.phase).toBe('finished');
    expect(expired.room.board!.presentation).toBeNull();
    expect(timeout.game(expired).revision).toBe(gameRevision);
  });

  it('anchors recovered cues to observed time and reconnects without replaying card resolution', async () => {
    const f = await boardRoom();
    const stored = f.stored().board!;
    const playerId = stored.game.order[stored.game.activeIndex];
    stored.game.phase = 'awaitingInteraction';
    stored.game.pending = { kind: 'cardPreview', playerId, cardId: 'S01', category: 'luck' };
    stored.nextAutoAt = f.now() - 20_000;
    const revision = stored.game.revision;

    const resolved = await f.read();
    const presentation = resolved.room.board!.presentation!;
    expect(presentation.clip).toBe('luck');
    expect(presentation.expiresAt).toBe(f.now() + presentation.durationMs + PRESENTATION_GRACE_MS);
    expect(f.game(resolved).revision).toBe(revision + 1);
    expect(resolved.room.board!.events.filter(event => event.event.type === 'cardResolved')).toHaveLength(1);

    const reconnected = await f.service.read(code, p1);
    expect(reconnected.room.board!.presentation?.id).toBe(presentation.id);
    expect(reconnected.room.board!.events.filter(event => event.event.type === 'cardResolved')).toHaveLength(1);
  });

  it('maps each room identity to exactly one engine player and keeps private fields out', async () => {
    const f = await boardRoom();
    const reply = await f.service.read(code, p1);
    const g = f.game(reply);
    expect(Object.keys(g.players).sort()).toEqual([f.p1Id, f.p2Id].sort());
    expect(reply.room.mode).toBe('board');
    const output = JSON.stringify(reply);
    for (const secret of ['rngSeed', 'rngCursor', 'hostHash', 'credentials', 'accepted', 'nextAutoAt', 'eventSeq', host, p1]) expect(output).not.toContain(secret);
    await expect(f.service.read(code, outsider)).rejects.toThrow('não está conectado');
  });

  it('stops automation at the dice and only the active player (or host) can roll', async () => {
    const f = await boardRoom();
    const reply = await settleTurn(f);
    const g = f.game(reply);
    expect(g.phase).toBe('readyToRoll'); expect(g.dice).toBeNull();
    f.tick(60_000); expect(f.game(await f.read()).phase).toBe('readyToRoll');
    const active = g.order[g.activeIndex]; const other = g.order.find(x => x !== active)!;
    const matchId = reply.room.board!.matchId, turn = reply.room.turn;
    await expect(f.service.command(code, f.tokenOf(other), f.id(), { type: 'roll', turn, matchId })).rejects.toThrow('outro jogador');
    await expect(f.service.command(code, f.tokenOf(active), f.id(), { type: 'game', matchId, revision: g.revision, command: { type: 'rollDice' } })).rejects.toThrow('não pertence');
    const rolled = await f.service.command(code, f.tokenOf(active), f.id(), { type: 'roll', turn, matchId });
    const dice = rolled.room.board!.events.filter(e => e.event.type === 'diceRolled');
    expect(dice).toHaveLength(1); expect(f.game(rolled).dice).toBe((dice[0].event as { value: number }).value);
  });

  it('turns simultaneous clicks and a replayed id into a single movement', async () => {
    const f = await boardRoom();
    const reply = await settleTurn(f); const g = f.game(reply);
    const token = f.tokenOf(g.order[g.activeIndex]);
    const base = { type: 'roll' as const, turn: reply.room.turn, matchId: reply.room.board!.matchId };
    const outcomes = await Promise.allSettled([f.id(), f.id(), f.id()].map(id => f.service.command(code, token, id, base)));
    expect(outcomes.filter(o => o.status === 'fulfilled')).toHaveLength(1);
    const same = f.id();
    await expect(f.service.command(code, token, same, base)).rejects.toThrow(); // already rolled
    const after = await f.read();
    expect(after.room.board!.events.filter(e => e.event.type === 'diceRolled')).toHaveLength(1);
  });

  it('replays a committed id without reapplying even after the turn moved on', async () => {
    const f = await boardRoom();
    const reply = await settleTurn(f); const g = f.game(reply);
    const token = f.tokenOf(g.order[g.activeIndex]); const id = f.id();
    const command = { type: 'roll' as const, turn: reply.room.turn, matchId: reply.room.board!.matchId };
    await f.service.command(code, token, id, command);
    f.tick(5000); await f.read();
    const replay = await f.service.command(code, token, id, command);
    expect(replay.room.board!.events.filter(e => e.event.type === 'diceRolled')).toHaveLength(1);
  });

  it('host can roll for a disconnected player; it is recorded in the history', async () => {
    const f = await boardRoom();
    const reply = await settleTurn(f);
    const rolled = await f.service.command(code, host, f.id(), { type: 'roll', turn: reply.room.turn, matchId: reply.room.board!.matchId });
    expect(rolled.room.board!.events.at(-1)!.byHost).toBe(true);
    expect(f.game(rolled).history.some(h => h.text.startsWith('Anfitrião rolou'))).toBe(true);
  });

  it('rejects stale host decisions and actions from a previous match', async () => {
    const f = await boardRoom();
    const reply = await settleTurn(f);
    const old = reply.room.board!.matchId;
    await expect(f.service.command(code, host, f.id(), { type: 'game', matchId: old, revision: f.game(reply).revision - 1, command: { type: 'dismissNotice' } })).rejects.toThrow('mudou');
    await expect(f.service.command(code, host, f.id(), { type: 'game', matchId: old, revision: f.game(reply).revision, command: { type: 'step' } })).rejects.toThrow('inválida');
    await f.service.command(code, host, f.id(), { type: 'restart' });
    const again = await f.service.command(code, host, f.id(), { type: 'start' });
    expect(again.room.board!.matchId).not.toBe(old);
    await expect(f.service.command(code, host, f.id(), { type: 'roll', turn: again.room.turn, matchId: old })).rejects.toThrow('partida anterior');
  });

  it('pause blocks automation and commands and preserves the item window time', async () => {
    const f = await boardRoom();
    let reply = await f.read();
    // Dá um Dado duplo ao primeiro jogador antes do início do turno: abre a janela de 5 s.
    const stored = f.stored(); const first = stored.board!.game.order[0];
    stored.board!.game.map = createLegacyMap();
    stored.board!.game.pedestalNodeId = 'm14';
    stored.board!.game.players[first].inventory.push({ uid: 'test-item', itemId: 'dadoDuplo' });
    f.tick(2000); reply = await f.read();
    expect(f.game(reply).phase).toBe('itemWindow');
    const deadline = reply.room.board!.itemDeadline!;
    f.tick(2000);
    const matchId = reply.room.board!.matchId;
    const paused = await f.service.command(code, host, f.id(), { type: 'pause', matchId });
    const remaining = paused.room.board!.pausedItemMs!;
    expect(remaining).toBe(deadline - f.now()); expect(remaining).toBeGreaterThan(0);
    f.tick(60_000); reply = await f.read();
    expect(f.game(reply).phase).toBe('itemWindow');
    await expect(f.host(reply, { type: 'requestItemChoice' })).rejects.toThrow('pausado');
    const resumed = await f.service.command(code, host, f.id(), { type: 'resume', matchId });
    expect(resumed.room.board!.itemDeadline).toBe(f.now() + remaining);
    f.tick(remaining - 100); expect(f.game(await f.read()).phase).toBe('itemWindow');
    f.tick(200); expect(f.game(await f.read()).phase).toBe('readyToRoll');
  });

  it('bounds the work done by a single read after a long absence', async () => {
    const f = await boardRoom();
    const reply = await settleTurn(f); const g = f.game(reply);
    await f.service.command(code, f.tokenOf(g.order[g.activeIndex]), f.id(), { type: 'roll', turn: reply.room.turn, matchId: reply.room.board!.matchId });
    const before = f.stored().board!.game.revision;
    f.tick(10 * 60_000); await f.read();
    expect(f.stored().board!.game.revision - before).toBeLessThanOrEqual(MAX_STEPS_PER_REQUEST);
  });

  it('completes a full round with decisions on the TV, applies results once and starts round 2', async () => {
    const seen = new Set<string>();
    for (const seed of [1, 7, 42, 999, 31337, 5, 77, 2024]) {
      const f = await boardRoom(seed);
      let reply = await settleTurn(f);
      for (let guard = 0; guard < 300 && f.game(reply).phase !== 'minigameIntro'; guard++) {
        const g = f.game(reply);
        if (g.pending) { seen.add(g.pending.kind); reply = await f.host(reply, hostDecision(f, reply)); }
        else if (g.phase === 'readyToRoll') reply = await f.service.command(code, f.tokenOf(g.order[g.activeIndex]), f.id(), { type: 'roll', turn: reply.room.turn, matchId: reply.room.board!.matchId });
        reply = await settleTurn(f);
      }
      expect(f.game(reply).phase).toBe('minigameIntro');
      expect(reply.room.board!.events.filter(e => e.event.type === 'turnStarted').length).toBeGreaterThanOrEqual(2);
      reply = await f.host(reply, { type: 'startMinigame' });
      const g = f.game(reply);
      const submit: Command = g.minigame!.teams.length
        ? { type: 'submitResults', resultId: 'r1', format: 'teams', winningTeam: 0 }
        : { type: 'submitResults', resultId: 'r1', format: 'individual', ranking: [[g.order[0]], [g.order[1]]] };
      const totalBefore = Object.values(g.players).reduce((s, p) => s + p.common, 0);
      reply = await f.host(reply, submit);
      const totalAfter = Object.values(f.game(reply).players).reduce((s, p) => s + p.common, 0);
      expect(totalAfter).toBeGreaterThan(totalBefore);
      await expect(f.host(reply, submit)).rejects.toThrow();
      reply = await f.host(reply, { type: 'nextRound' });
      expect(f.game(reply).phase).toBe('roundReady'); expect(reply.room.round).toBe(2);
    }
    expect([...seen]).toEqual(expect.arrayContaining(['path', 'shop', 'cardPreview']));
  });

  it('keeps the approved three-round dice test untouched for rooms without a mode', async () => {
    const store = new MemoryStore();
    const service = new RoomService(store, () => 1000, () => 4);
    await service.create(code, host);
    const legacy = store.data.get(code)!; delete legacy.mode; delete legacy.board;
    await service.command(code, p1, 'legacy-000000001', { type: 'join', name: 'Iago' });
    await service.command(code, p2, 'legacy-000000002', { type: 'join', name: 'Emiliano' });
    const started = await service.command(code, host, 'legacy-000000003', { type: 'start' });
    expect(started.room.mode).toBe('dice'); expect(started.room.board).toBeNull();
    const rolled = await service.command(code, p1, 'legacy-000000004', { type: 'roll', turn: started.room.turn });
    expect(rolled.room.lastRoll?.value).toBe(4);
  });
});


describe('decisões do celular no mapa V3', () => {
  it('autoriza só o dono da visita, persiste compra concorrente uma vez e retoma a travessia', async () => {
    const f = await boardRoom();
    const stored = f.stored(), board = stored.board!, g = board.game;
    const pid = g.order[g.activeIndex], other = g.order.find(id => id !== pid)!;
    g.players[pid].nodeId = 'm2'; g.players[pid].common = 30;
    g.phase = 'awaitingInteraction'; g.pending = { kind: 'shop', playerId: pid, nodeId: 'shop-west', items: ['bananaTurbo'] };
    g.movement = { remaining: 1, traversed: [], direction: 'forward', activatesSpaces: true, transit: { stopId: 'shop-west', to: 'm3' } };
    const command = { type: 'game' as const, matchId: board.matchId, revision: g.revision, command: { type: 'buyItem' as const, itemId: 'bananaTurbo' as const } };
    await expect(f.service.command(code, f.tokenOf(other), f.id(), command)).rejects.toThrow('não pertence');
    const id = f.id();
    const replies = await Promise.all([f.service.command(code, f.tokenOf(pid), id, command), f.service.command(code, f.tokenOf(pid), id, command)]);
    for (const reply of replies) { expect(f.game(reply).players[pid].common).toBe(25); expect(f.game(reply).players[pid].inventory).toHaveLength(1); }
    expect(f.game(replies[0]).movement?.remaining).toBe(1);
    f.tick(1000); const moved = f.game(await f.read()); expect(moved.players[pid].nodeId).toBe('m3');
  });
  it('bloqueia administração pelo celular e decisões durante pausa; oculta baralho futuro', async () => {
    const f = await boardRoom(); const b = f.stored().board!, g = b.game, pid = g.order[g.activeIndex];
    g.phase = 'awaitingPath'; g.players[pid].nodeId = 'm16'; g.pending = { kind: 'path', playerId: pid, options: ['m17', 'b0'] };
    g.movement = { remaining: 4, direction: 'forward', activatesSpaces: true, traversed: [] };
    g.cardDecks = { luck: ['S01'] };
    const command = { type: 'game' as const, matchId: b.matchId, revision: g.revision, command: { type: 'choosePath' as const, nodeId: 'b0' } };
    await expect(f.service.command(code, f.tokenOf(pid), f.id(), { ...command, command: { type: 'manualAdjust', playerId: pid, common: 999, golden: 9, reason: 'no' } })).rejects.toThrow('não pertence');
    await f.service.command(code, host, f.id(), { type: 'pause', matchId: b.matchId });
    await expect(f.service.command(code, f.tokenOf(pid), f.id(), command)).rejects.toThrow('pausado');
    await f.service.command(code, host, f.id(), { type: 'resume', matchId: b.matchId });
    const reply = await f.service.command(code, f.tokenOf(pid), f.id(), command);
    expect(f.game(reply).players[pid].nodeId).toBe('b0'); expect(JSON.stringify(reply)).not.toContain('cardDecks');
  });
  it('escolha de poder permanece aberta sem prazo e o dono pode seguir para o dado', async () => {
    const f = await boardRoom(); const b = f.stored().board!, g = b.game, pid = g.order[0];
    g.players[pid].inventory = [{ uid: 'owned', itemId: 'bananaTurbo' }];
    f.tick(2000); let reply = await f.read(); expect(f.game(reply).pending?.kind).toBe('itemChoice');
    f.tick(60000); reply = await f.read(); expect(f.game(reply).pending?.kind).toBe('itemChoice');
    reply = await f.service.command(code, f.tokenOf(pid), f.id(), { type: 'game', matchId: b.matchId, revision: f.game(reply).revision, command: { type: 'cancelItemChoice' } });
    expect(f.game(reply).phase).toBe('readyToRoll');
  });
});


describe('v4: permissões de duelo e Iagugu',()=>{
  it('dono aposta, outro não aposta e só anfitrião registra resultado',async()=>{
    const f=await boardRoom();const stored=f.stored();const b=stored.board!;const g=b.game;
    const owner=g.order[g.activeIndex],other=g.order.find(id=>id!==owner)!;
    g.players[owner].nodeId='m6';g.phase='awaitingInteraction';g.movement=null;
    g.pending={kind:'duelBet',playerId:owner,opponentId:other,maxBet:10};b.nextAutoAt=null;
    const bet={type:'game' as const,matchId:b.matchId,revision:g.revision,command:{type:'setDuelBet' as const,amount:5}};
    await expect(f.service.command(code,f.tokenOf(other),f.id(),bet)).rejects.toThrow('não pertence');
    let r=await f.service.command(code,f.tokenOf(owner),f.id(),bet);
    const result={type:'game' as const,matchId:b.matchId,revision:f.game(r).revision,command:{type:'resolveDuel' as const,winnerId:owner}};
    await expect(f.service.command(code,f.tokenOf(owner),f.id(),result)).rejects.toThrow('não pertence');
    const id=f.id();r=await f.service.command(code,host,id,result);await f.service.command(code,host,id,result);
    expect(f.game(r).players[owner].common).toBe(15);expect(f.game(r).players[other].common).toBe(5);
  });
  it('Iagugu rejeita outro jogador e cobranças simultâneas só acontecem uma vez',async()=>{
    const f=await boardRoom();const b=f.stored().board!;const g=b.game;const owner=g.order[g.activeIndex],other=g.order.find(id=>id!==owner)!;
    g.map=createV4Map();g.players[owner].nodeId='a0';g.players[owner].common=50;g.players[other].golden=1;
    g.phase='awaitingInteraction';g.movement={remaining:2,traversed:[],activatesSpaces:true,direction:'forward',transit:{stopId:'iagugu',to:'a1'}};
    g.pending={kind:'iagugu',playerId:owner,nodeId:'iagugu'};b.nextAutoAt=null;
    const cmd={type:'game' as const,matchId:b.matchId,revision:g.revision,command:{type:'rob' as const,targetId:other,currency:'golden' as const}};
    await expect(f.service.command(code,f.tokenOf(other),f.id(),cmd)).rejects.toThrow('não pertence');
    const res=await Promise.allSettled([f.service.command(code,f.tokenOf(owner),f.id(),cmd),f.service.command(code,f.tokenOf(owner),f.id(),cmd)]);
    expect(res.filter(r=>r.status==='fulfilled')).toHaveLength(1);
    const after=f.game(await f.read());expect(after.players[owner].common).toBe(10);expect(after.players[owner].golden).toBe(1);expect(after.players[other].golden).toBe(0);
  });
});
