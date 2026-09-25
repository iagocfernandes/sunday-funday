import type { IncomingMessage, ServerResponse } from 'node:http';
import { RoomError, RoomService, hashToken } from './room.js';
import { RedisRoomStore, limitRequest } from './store.js';
import type { RemoteCommand } from '../src/remote/types';
export const roomService = new RoomService(new RedisRoomStore());
export function tokenFrom(req: IncomingMessage) { return req.headers.authorization?.replace(/^Bearer /, '') ?? ''; }
export function sameOrigin(req: IncomingMessage) {
  if (!req.headers.origin) return true;
  try { return new URL(req.headers.origin).host === req.headers.host; } catch { return false; }
}
function respond(res: ServerResponse, status: number, value: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); res.end(JSON.stringify(value));
}
export async function roomHandler(req: IncomingMessage, res: ServerResponse) {
  try {
    if (!sameOrigin(req)) throw new RoomError(403, 'Origem não permitida.');
    const url = new URL(req.url ?? '/', 'http://localhost');
    const token = tokenFrom(req);
    if (req.method === 'GET') {
      const reply = await roomService.read(url.searchParams.get('room') ?? '', token);
      return respond(res, 200, reply);
    }
    if (req.method !== 'POST') throw new RoomError(405, 'Método não permitido.');
    if (!req.headers['content-type']?.startsWith('application/json')) throw new RoomError(415, 'Envie JSON.');
    const parsedBody = (req as IncomingMessage & { body?: unknown }).body;
    let text = '';
    if (parsedBody !== undefined) text = typeof parsedBody === 'string' ? parsedBody : JSON.stringify(parsedBody);
    else for await (const chunk of req) { text += chunk.toString(); if (Buffer.byteLength(text) > 20000) throw new RoomError(413, 'Pedido muito grande.'); }
    if (Buffer.byteLength(text) > 20000) throw new RoomError(413, 'Pedido muito grande.');
    let body: { type: string; code: string; mode?: unknown; commandId: string; command: RemoteCommand };
    try { body = JSON.parse(text); } catch { throw new RoomError(400, 'Pedido inválido.'); }
    if (!body || typeof body !== 'object') throw new RoomError(400, 'Pedido inválido.');
    const ip = String(req.headers['x-forwarded-for'] ?? req.socket.remoteAddress ?? 'unknown').split(',')[0];
    if (!await limitRequest(hashToken(ip), body.type === 'create')) throw new RoomError(429, 'Muitas tentativas. Aguarde um minuto.');
    const result = body.type === 'create' ? await roomService.create(body.code, token, body.mode ?? 'dice')
      : body.type === 'command' ? await roomService.command(body.code, token, body.commandId, body.command)
      : (() => { throw new RoomError(400, 'Pedido desconhecido.'); })();
    respond(res, 200, result);
  } catch (error) {
    if (error instanceof RoomError) respond(res, error.status, { error: error.message });
    else { console.error('remote_room_error', error instanceof Error ? error.message : 'Unknown error'); respond(res, 503, { error: 'Não foi possível conectar à sala. Aguarde e tente novamente.' }); }
  }
}
