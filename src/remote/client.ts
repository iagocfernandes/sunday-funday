import type { RoomReply } from './types';
export interface RemoteSession { code: string; token: string; name?: string; }
export const remoteKey = (role: string, code: string) => `sunday:remote:${role}:${code}`;
export const secret = () => Array.from(crypto.getRandomValues(new Uint8Array(32)), v => v.toString(16).padStart(2, '0')).join('');
export const newCode = () => Array.from(crypto.getRandomValues(new Uint8Array(6)), v => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[v % 32]).join('');
export function saveSession(role: string, session: RemoteSession) { localStorage.setItem(remoteKey(role, session.code), JSON.stringify(session)); }
export function loadSession(role: string, code: string): RemoteSession | null {
  try { const v = JSON.parse(localStorage.getItem(remoteKey(role, code)) ?? 'null'); return v?.code === code && typeof v.token === 'string' ? v : null; } catch { return null; }
}
export async function request(session: RemoteSession, body?: unknown): Promise<RoomReply> {
  const res = await fetch(`/api/room?room=${encodeURIComponent(session.code)}`, {
    method: body ? 'POST' : 'GET', headers: { Authorization: `Bearer ${session.token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(12000), cache: 'no-store',
  });
  const result = await res.json().catch(() => ({ error: 'O servidor está indisponível por um momento. Tente novamente.' }));
  if (!res.ok) throw new Error(result.error || 'Não foi possível conectar. Tente novamente.');
  return result;
}
