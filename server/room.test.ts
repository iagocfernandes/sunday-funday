import { describe, expect, it } from 'vitest';
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
const host = 'a'.repeat(64), p1 = 'b'.repeat(64), p2 = 'c'.repeat(64), outsider = 'd'.repeat(64), code = 'ABC234';
function fixture() {
  const store = new MemoryStore(); let now = 1000, diceCalls = 0, command = 0;
  const service = new RoomService(store, () => now, () => { diceCalls++; return 7; });
  return { store, service, advance: () => { now += 3000; }, expire: () => { now += 13 * 3600000; }, diceCalls: () => diceCalls, id: () => `request-${String(++command).padStart(8, '0')}` };
}
async function ready() {
  const f = fixture(); await f.service.create(code, host);
  const one = await f.service.command(code, p1, f.id(), { type: 'join', name: 'Iago' });
  const two = await f.service.command(code, p2, f.id(), { type: 'join', name: 'Milena' });
  await f.service.command(code, host, f.id(), { type: 'start' });
  return { ...f, player1: one.playerId!, player2: two.playerId! };
}
describe('remote rooms: server authority and recovery', () => {
  it('keeps host secrets and player tokens out of public state', async () => {
    const f = await ready(); const output = JSON.stringify(await f.service.read(code, p1));
    expect(output).not.toContain('hostHash'); expect(output).not.toContain('credentials'); expect(output).not.toContain('accepted'); expect(output).not.toContain(host);
    await expect(f.service.read(code, outsider)).rejects.toThrow('não está conectado');
  });
  it('recovers an uncertain create and join without duplicate participants', async () => {
    const f = fixture(); await f.service.create(code, host); await f.service.create(code, host);
    const first = await f.service.command(code, p1, f.id(), { type: 'join', name: 'Iago' });
    const second = await f.service.command(code, p1, f.id(), { type: 'join', name: 'Iago' });
    expect(second.playerId).toBe(first.playerId); expect(second.room.players).toHaveLength(1);
    await expect(f.service.create(code, outsider)).rejects.toThrow('Código já utilizado');
  });
  it('rejects another player rolling, starting, or restarting', async () => {
    const f = await ready();
    await expect(f.service.command(code, p2, f.id(), { type: 'roll', turn: 1 })).rejects.toThrow('outro jogador');
    await expect(f.service.command(code, p1, f.id(), { type: 'restart' })).rejects.toThrow('anfitrião');
    expect((await f.service.read(code, host)).room.rolls).toHaveLength(0); expect(f.diceCalls()).toBe(0);
  });
  it('accepts one of two different clicks arriving simultaneously', async () => {
    const f = await ready(); const ids = [f.id(), f.id()];
    const results = await Promise.allSettled(ids.map(id => f.service.command(code, p1, id, { type: 'roll', turn: 1 })));
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    const room = (await f.service.read(code, p1)).room;
    expect(room.rolls).toHaveLength(1); expect(room.lastRoll?.value).toBe(7);
  });
  it('replays an uncertain request id without a second committed roll', async () => {
    const f = await ready(); const id = f.id();
    await Promise.all([f.service.command(code, p1, id, { type: 'roll', turn: 1 }), f.service.command(code, p1, id, { type: 'roll', turn: 1 })]);
    f.advance(); const snapshot = await f.service.read(code, host);
    const replay = await f.service.command(code, p1, id, { type: 'roll', turn: 1 });
    expect(snapshot.room.activePlayerId).toBe(f.player2); expect(replay.room.rolls).toHaveLength(1);
  });
  it('restores a recorded result using another service instance, then advances once', async () => {
    const f = await ready(); await f.service.command(code, p1, f.id(), { type: 'roll', turn: 1 });
    const secondServer = new RoomService(f.store, () => 1000, () => { throw new Error('must not reroll'); });
    expect((await secondServer.read(code, p1)).room.lastRoll?.value).toBe(7);
    f.advance(); await Promise.all([f.service.read(code, p1), f.service.read(code, p2), f.service.read(code, host)]);
    const room = (await f.service.read(code, host)).room;
    expect(room.turn).toBe(2); expect(room.activePlayerId).toBe(f.player2); expect(room.rolls).toHaveLength(1);
  });
  it('finishes exactly three rounds and allows host fallback without duplicate turns', async () => {
    const f = await ready();
    for (let turn = 1; turn <= 6; turn++) {
      const result = await f.service.command(code, host, f.id(), { type: 'roll', turn });
      expect(result.room.lastRoll?.byHost).toBe(true); f.advance(); await f.service.read(code, host);
    }
    const result = await f.service.read(code, host);
    expect(result.room.phase).toBe('finished'); expect(result.room.rolls).toHaveLength(6);
    expect(result.room.rolls.map(r => r.playerName)).toEqual(['Iago', 'Milena', 'Iago', 'Milena', 'Iago', 'Milena']);
    expect(result.room.rolls.map(r => r.round)).toEqual([1,1,2,2,3,3]);
    await expect(f.service.command(code, p1, f.id(), { type: 'roll', turn: 6 })).rejects.toThrow();
  });
  it('never accepts a stale click after restarting', async () => {
    const f = await ready(); await f.service.command(code, host, f.id(), { type: 'restart' });
    const room = (await f.service.command(code, host, f.id(), { type: 'start' })).room;
    expect(room.turn).toBeGreaterThan(1);
    await expect(f.service.command(code, p1, f.id(), { type: 'roll', turn: 1 })).rejects.toThrow('vez já passou');
  });
  it('rejects late joins, duplicate names, invalid codes and expired rooms', async () => {
    const f = fixture(); await f.service.create(code, host);
    await f.service.command(code, p1, f.id(), { type: 'join', name: 'Iago' });
    await expect(f.service.command(code, p2, f.id(), { type: 'join', name: ' iago ' })).rejects.toThrow('nome já entrou');
    await expect(f.service.command(code, host, f.id(), { type: 'start' })).rejects.toThrow('dois jogadores');
    await f.service.command(code, p2, f.id(), { type: 'join', name: 'Milena' });
    await f.service.command(code, host, f.id(), { type: 'start' });
    await expect(f.service.command(code, outsider, f.id(), { type: 'join', name: 'Outro' })).rejects.toThrow('já começou');
    await expect(f.service.read('../../xx', host)).rejects.toThrow('código'); f.expire();
    await expect(f.service.read(code, host)).rejects.toThrow('expirada');
  });
  it('limits the room to ten participants under concurrent joins', async () => {
    const f = fixture(); await f.service.create(code, host);
    const outcomes = await Promise.allSettled(Array.from({ length: 11 }, (_, i) => f.service.command(code, (i + 32).toString(16).repeat(32), f.id(), { type: 'join', name: `Gorila ${i}` })));
    expect(outcomes.filter(x => x.status === 'fulfilled')).toHaveLength(10);
    expect((await f.service.read(code, host)).room.players).toHaveLength(10);
  });
});
