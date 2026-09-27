import type { IncomingMessage, ServerResponse } from 'node:http';
import { getStoredPortrait } from './store.js';

function respond(res: ServerResponse, status: number, body = '') {
  res.writeHead(status, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(body);
}

export async function portraitHandler(req: IncomingMessage, res: ServerResponse) {
  try {
    if (req.method !== 'GET') return respond(res, 405, 'Método não permitido.');
    const id = new URL(req.url ?? '/', 'http://localhost').searchParams.get('id') ?? '';
    if (!/^[a-f0-9]{64}$/.test(id)) return respond(res, 404, 'Foto não encontrada.');
    const portrait = await getStoredPortrait(id);
    if (!portrait || portrait.expiresAt <= Date.now()) return respond(res, 404, 'Foto não encontrada.');
    const maxAge = Math.max(0, Math.min(3600, Math.floor((portrait.expiresAt - Date.now()) / 1000)));
    res.writeHead(200, {
      'Content-Type': 'image/jpeg',
      'Content-Length': Buffer.byteLength(portrait.data.slice(23), 'base64'),
      'Cache-Control': maxAge > 0 ? `private, max-age=${maxAge}, immutable` : 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; sandbox",
    });
    res.end(Buffer.from(portrait.data.slice(23), 'base64'));
  } catch (error) {
    console.error('portrait_error', error instanceof Error ? error.message : 'Unknown error');
    respond(res, 503, 'Foto temporariamente indisponível.');
  }
}
