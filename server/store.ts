import type { RoomStore, StoredRoom } from './room';
import { createHash } from 'node:crypto';
import { validPortrait } from './portrait.js';

async function redis(args: (string | number)[]): Promise<unknown> {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error('Room database is not configured');
  const res = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(args), signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`Database unavailable: ${res.status}`);
  const json = await res.json() as { result: unknown; error?: string };
  if (json.error) throw new Error('Database command failed');
  return json.result;
}
const key = (code: string) => `sunday:remote:v1:${code}`;
const portraitKey = (id: string) => `sunday:portrait:v1:${id}`;
const portraitUrl = (id: string) => `/api/portrait?id=${id}`;

interface StoredPortrait { data: string; expiresAt: number }

/**
 * Uploaded photos used to be repeated throughout every room snapshot and CAS.
 * Keep the public shape (`portrait` remains a URL string), while storing each
 * room's photo once under an unguessable, content-addressed key.
 */
function snapshotForStorage(room: StoredRoom) {
  const portraits = new Map<string, StoredPortrait>();
  const json = JSON.stringify(room, (field, value: unknown) => {
    if (field !== 'portrait' || !validPortrait(value)) return value;
    const data = value;
    const id = createHash('sha256').update(room.code).update('\0').update(data).digest('hex');
    portraits.set(id, { data, expiresAt: room.expiresAt });
    return portraitUrl(id);
  });
  return { json, portraits };
}

async function storePortraits(portraits: Map<string, StoredPortrait>) {
  await Promise.all([...portraits].map(([id, portrait]) => redis([
    'SET', portraitKey(id), JSON.stringify(portrait), 'PX', Math.max(1, portrait.expiresAt - Date.now()),
  ])));
}

export async function getStoredPortrait(id: string): Promise<StoredPortrait | null> {
  if (!/^[a-f0-9]{64}$/.test(id)) return null;
  const raw = await redis(['GET', portraitKey(id)]);
  if (typeof raw !== 'string') return null;
  try {
    const portrait = JSON.parse(raw) as Partial<StoredPortrait>;
    return validPortrait(portrait.data) && typeof portrait.expiresAt === 'number'
      ? { data: portrait.data, expiresAt: portrait.expiresAt }
      : null;
  } catch { return null; }
}

export class RedisRoomStore implements RoomStore {
  async get(code: string) {
    const raw = await redis(['GET', key(code)]);
    return typeof raw === 'string' ? JSON.parse(raw) as StoredRoom : null;
  }
  async create(room: StoredRoom) {
    const stored = snapshotForStorage(room);
    await storePortraits(stored.portraits);
    return await redis(['SET', key(room.code), stored.json, 'NX', 'PX', Math.max(1, room.expiresAt - Date.now())]) === 'OK';
  }
  async compareAndSet(before: StoredRoom, after: StoredRoom) {
    const stored = snapshotForStorage(after);
    await storePortraits(stored.portraits);
    const script = "if redis.call('GET',KEYS[1]) ~= ARGV[1] then return 0 end redis.call('SET',KEYS[1],ARGV[2],'PX',ARGV[3]) return 1";
    // `before` intentionally remains byte-compatible with legacy inline rooms.
    // Their first successful mutation atomically replaces the old snapshot.
    return await redis(['EVAL', script, 1, key(before.code), JSON.stringify(before), stored.json, Math.max(1, after.expiresAt - Date.now())]) === 1;
  }
}
export async function limitRequest(ipHash: string, create = false) {
  const bucket = Math.floor(Date.now() / 60000);
  const result = await redis(['EVAL', "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],120) end; return n", 1, `sunday:rate:${create ? 'create' : 'action'}:${ipHash}:${bucket}`]);
  return Number(result) <= (create ? 10 : 180);
}
