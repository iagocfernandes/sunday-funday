import type { Server } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import { roomService, sameOrigin } from './http.js';
import { RoomError, validCode, validToken } from './room.js';
export function attachRoomSockets(server: Server) {
  const wss = new WebSocketServer({ server, maxPayload: 2048 });
  wss.on('connection', (socket, request) => {
    if (!sameOrigin(request)) { socket.close(1008); return; }
    let room = '', token = '', busy = false, revision = -1;
    const authTimeout = setTimeout(() => socket.close(1008, 'Identifique a sala'), 10000);
    const update = async () => {
      if (!room || busy || socket.readyState !== WebSocket.OPEN) return;
      busy = true;
      try {
        const result = await roomService.read(room, token);
        if (socket.readyState !== WebSocket.OPEN) return;
        if (result.room.revision !== revision) { socket.send(JSON.stringify({ type: 'state', ...result })); revision = result.room.revision; }
        else socket.send(JSON.stringify({ type: 'heartbeat' }));
      } catch (error) {
        if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'error', error: error instanceof RoomError ? error.message : 'Conexão temporariamente indisponível.' }));
        socket.close(1011);
      } finally { busy = false; }
    };
    socket.on('message', data => {
      if (room) return;
      try {
        const parsed = JSON.parse(data.toString()); validCode(parsed.room); validToken(parsed.token);
        room = parsed.room; token = parsed.token; clearTimeout(authTimeout); void update();
      } catch { socket.close(1008, 'Identificação inválida'); }
    });
    const interval = setInterval(() => void update(), 1000);
    socket.on('close', () => { clearInterval(interval); clearTimeout(authTimeout); });
    socket.on('error', () => socket.close());
  });
  return wss;
}
