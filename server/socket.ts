import type { Server } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import { roomService, sameOrigin } from './http.js';
import { RoomError, validCode, validToken } from './room.js';

export const ROOM_SOCKET_ACTIVE_POLL_MS = 1000;
export const ROOM_SOCKET_IDLE_POLL_MS = 2000;
export const ROOM_SOCKET_IDLE_AFTER_UNCHANGED_READS = 2;

export function roomSocketPollDelay(unchangedReads: number) {
  return unchangedReads >= ROOM_SOCKET_IDLE_AFTER_UNCHANGED_READS
    ? ROOM_SOCKET_IDLE_POLL_MS
    : ROOM_SOCKET_ACTIVE_POLL_MS;
}

export function attachRoomSockets(server: Server) {
  const wss = new WebSocketServer({ server, maxPayload: 2048 });
  wss.on('connection', (socket, request) => {
    if (!sameOrigin(request)) { socket.close(1008); return; }
    let room = '', token = '', busy = false, revision = -1, unchangedReads = 0;
    let pollTimer: ReturnType<typeof setTimeout> | undefined;
    const authTimeout = setTimeout(() => socket.close(1008, 'Identifique a sala'), 10000);
    const update = async () => {
      if (!room || busy || socket.readyState !== WebSocket.OPEN) return;
      busy = true;
      try {
        const result = await roomService.read(room, token);
        if (socket.readyState !== WebSocket.OPEN) return;
        if (result.room.revision !== revision) {
          socket.send(JSON.stringify({ type: 'state', ...result })); revision = result.room.revision; unchangedReads = 0;
        } else {
          socket.send(JSON.stringify({ type: 'heartbeat' })); unchangedReads += 1;
        }
      } catch (error) {
        if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'error', error: error instanceof RoomError ? error.message : 'Conexão temporariamente indisponível.' }));
        socket.close(1011);
      } finally { busy = false; }
    };
    const poll = async () => {
      await update();
      if (socket.readyState === WebSocket.OPEN) pollTimer = setTimeout(poll, roomSocketPollDelay(unchangedReads));
    };
    socket.on('message', data => {
      if (room) return;
      try {
        const parsed = JSON.parse(data.toString()); validCode(parsed.room); validToken(parsed.token);
        room = parsed.room; token = parsed.token; clearTimeout(authTimeout); void poll();
      } catch { socket.close(1008, 'Identificação inválida'); }
    });
    socket.on('close', () => { clearTimeout(pollTimer); clearTimeout(authTimeout); });
    socket.on('error', () => socket.close());
  });
  return wss;
}
