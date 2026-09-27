import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { RoomService, type StoredRoom } from './room';
import { RedisRoomStore, getStoredPortrait } from './store';
import { portraitHandler } from './portrait-http';

const roomKey = (code: string) => `sunday:remote:v1:${code}`;

function tinyJpeg() {
  const bytes = Buffer.from([
    0xff, 0xd8,
    0xff, 0xc0, 0x00, 0x11, 0x08, 0x00, 0x01, 0x00, 0x01, 0x03,
    0x01, 0x11, 0x00, 0x02, 0x11, 0x00, 0x03, 0x11, 0x00,
    0xff, 0xd9,
  ]);
  return `data:image/jpeg;base64,${bytes.toString('base64')}`;
}

function room(portrait?: string): StoredRoom {
  return {
    code: 'ABC234', revision: 1, mode: 'board', board: null, phase: 'lobby',
    players: [{ id: 'p1', name: 'Iago', ...(portrait ? { portrait } : {}) }],
    activePlayerId: null, turn: 0, round: 1, rounds: 10, diceMax: 10,
    lastRoll: null, rolls: [], advanceAt: null, expiresAt: Date.now() + 60_000,
    hostHash: 'h', credentials: { p1: 'c' }, accepted: [],
  };
}

describe('RedisRoomStore portrait snapshots', () => {
  const database = new Map<string, string>();

  beforeEach(() => {
    process.env.KV_REST_API_URL = 'https://redis.test';
    process.env.KV_REST_API_TOKEN = 'token';
    database.clear();
    vi.stubGlobal('fetch', vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      const args = JSON.parse(String(init?.body)) as (string | number)[];
      let result: unknown = null;
      if (args[0] === 'GET') result = database.get(String(args[1])) ?? null;
      if (args[0] === 'SET') {
        const redisKey = String(args[1]);
        if (!args.includes('NX') || !database.has(redisKey)) {
          database.set(redisKey, String(args[2])); result = 'OK';
        }
      }
      if (args[0] === 'EVAL') {
        const redisKey = String(args[3]);
        if (database.get(redisKey) === args[4]) {
          database.set(redisKey, String(args[5])); result = 1;
        } else result = 0;
      }
      return new Response(JSON.stringify({ result }), { status: 200 });
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.KV_REST_API_URL;
    delete process.env.KV_REST_API_TOKEN;
  });

  it('migrates an inline legacy photo once and preserves CAS under concurrency', async () => {
    const photo = tinyJpeg();
    const legacy = room(photo);
    database.set(roomKey(legacy.code), JSON.stringify(legacy));
    const store = new RedisRoomStore();
    const before = await store.get(legacy.code);
    expect(before?.players[0].portrait).toBe(photo);

    const first = structuredClone(before!); first.revision = 2;
    const second = structuredClone(before!); second.revision = 3;
    const outcomes = await Promise.all([
      store.compareAndSet(before!, first),
      store.compareAndSet(before!, second),
    ]);
    expect(outcomes.filter(Boolean)).toHaveLength(1);

    const stored = database.get(roomKey(legacy.code))!;
    expect(stored).not.toContain(photo);
    const reference = (JSON.parse(stored) as StoredRoom).players[0].portrait!;
    expect(reference).toMatch(/^\/api\/portrait\?id=[a-f0-9]{64}$/);
    const id = new URL(reference, 'https://game.test').searchParams.get('id')!;
    expect(await getStoredPortrait(id)).toEqual({ data: photo, expiresAt: legacy.expiresAt });
    expect([...database.keys()].filter(key => key.startsWith('sunday:portrait:v1:'))).toHaveLength(1);
  });

  it('stores new snapshots with a reference and rejects malformed portrait ids locally', async () => {
    const photo = tinyJpeg();
    const store = new RedisRoomStore();
    expect(await store.create(room(photo))).toBe(true);
    expect(database.get(roomKey('ABC234'))).not.toContain(photo);
    const calls = vi.mocked(fetch).mock.calls.length;
    expect(await getStoredPortrait('../ABC234')).toBeNull();
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(calls);
  });

  it('serves only a validated JPEG reference with private bounded caching', async () => {
    const store = new RedisRoomStore();
    await store.create(room(tinyJpeg()));
    const stored = JSON.parse(database.get(roomKey('ABC234'))!) as StoredRoom;
    const url = stored.players[0].portrait!;
    const writeHead = vi.fn();
    const end = vi.fn();
    const response = { writeHead, end } as unknown as ServerResponse;

    await portraitHandler({ method: 'GET', url } as IncomingMessage, response);

    expect(writeHead).toHaveBeenCalledWith(200, expect.objectContaining({
      'Content-Type': 'image/jpeg',
      'Cache-Control': expect.stringMatching(/^private, max-age=\d+, immutable$/),
    }));
    expect(Buffer.isBuffer(end.mock.calls[0][0])).toBe(true);
  });

  it('continues room commands with stored refs but rejects refs as new uploads', async () => {
    const store = new RedisRoomStore();
    const service = new RoomService(store);
    const host = 'a'.repeat(64), firstToken = 'b'.repeat(64), secondToken = 'c'.repeat(64);
    await service.create('ABC234', host, 'board');
    const first = await service.command('ABC234', firstToken, 'request-000001', {
      type: 'join', name: 'Iago', portrait: tinyJpeg(),
    });
    const persisted = JSON.parse(database.get(roomKey('ABC234'))!) as StoredRoom;
    const reference = persisted.players[0].portrait!;

    await expect(service.command('ABC234', secondToken, 'request-000002', {
      type: 'join', name: 'Milena', portrait: reference,
    })).rejects.toThrow('Foto inválida');
    await service.command('ABC234', secondToken, 'request-000003', { type: 'join', name: 'Milena' });
    const started = await service.command('ABC234', host, 'request-000004', { type: 'start' });

    expect(started.room.board?.game.players[first.playerId!].portrait).toBe(reference);
  });
});
