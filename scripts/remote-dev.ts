import { createServer } from 'node:http';
import { roomHandler } from '../server/http';
import { attachRoomSockets } from '../server/socket';
const server = createServer(roomHandler);
attachRoomSockets(server);
server.listen(3001, '127.0.0.1', () => console.log('Remote API: http://127.0.0.1:3001'));
