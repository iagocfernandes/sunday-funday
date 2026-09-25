import { createServer } from 'node:http';
import { attachRoomSockets } from '../server/socket.js';
const server = createServer((_req, res) => { res.writeHead(426); res.end('WebSocket required'); });
attachRoomSockets(server);
export default server;
