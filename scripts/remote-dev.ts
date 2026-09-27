import { createServer } from 'node:http';
import { roomHandler } from '../server/http';
import { portraitHandler } from '../server/portrait-http';
import { attachRoomSockets } from '../server/socket';
const server = createServer((req, res) => req.url?.startsWith('/api/portrait') ? portraitHandler(req, res) : roomHandler(req, res));
attachRoomSockets(server);
server.listen(3001, '127.0.0.1', () => console.log('Remote API: http://127.0.0.1:3001'));
