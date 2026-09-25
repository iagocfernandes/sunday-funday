import type { RoomStore, StoredRoom } from './room';

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
export class RedisRoomStore implements RoomStore {
  async get(code: string) {
    const raw = await redis(['GET', key(code)]);
    return typeof raw === 'string' ? JSON.parse(raw) as StoredRoom : null;
  }
  async create(room: StoredRoom) {
    return await redis(['SET', key(room.code), JSON.stringify(room), 'NX', 'PX', Math.max(1, room.expiresAt - Date.now())]) === 'OK';
  }
  async compareAndSet(before: StoredRoom, after: StoredRoom) {
    const script = "if redis.call('GET',KEYS[1]) ~= ARGV[1] then return 0 end redis.call('SET',KEYS[1],ARGV[2],'PX',ARGV[3]) return 1";
    return await redis(['EVAL', script, 1, key(before.code), JSON.stringify(before), JSON.stringify(after), Math.max(1, after.expiresAt - Date.now())]) === 1;
  }
}
export async function limitRequest(ipHash: string, create = false) {
  const bucket = Math.floor(Date.now() / 60000);
  const result = await redis(['EVAL', "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],120) end; return n", 1, `sunday:rate:${create ? 'create' : 'action'}:${ipHash}:${bucket}`]);
  return Number(result) <= (create ? 10 : 180);
}
