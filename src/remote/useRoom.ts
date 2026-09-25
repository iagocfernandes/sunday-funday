import { useCallback, useEffect, useRef, useState } from 'react';
import { request, type RemoteSession } from './client';
import type { RemoteCommand, RoomReply } from './types';

export function useRoom(session: RemoteSession | null) {
  const [reply, setReply] = useState<RoomReply | null>(null);
  const [connection, setConnection] = useState<'connecting' | 'live' | 'syncing' | 'offline'>('connecting');
  const [error, setError] = useState('');
  // Erro de comando é separado do estado da conexão: um heartbeat saudável não o apaga.
  const [actionError, setActionError] = useState('');
  const [clockOffset, setClockOffset] = useState(0);
  const [busy, setBusy] = useState(false);
  const acting = useRef(false);
  const latestRevision = useRef(-1);
  const accept = useCallback((value: RoomReply) => {
    if (value.room.revision >= latestRevision.current) {
      latestRevision.current = value.room.revision; setReply(value);
      if (typeof value.serverNow === 'number') setClockOffset(value.serverNow - Date.now());
    }
  }, []);
  useEffect(() => {
    latestRevision.current = -1; setReply(null); setError(''); setActionError('');
    if (!session) return;
    let disposed = false, ws: WebSocket | null = null, retry: ReturnType<typeof setTimeout> | undefined;
    let delay = 1000, live = false, checking = false, lastMessage = 0;
    const refresh = async () => {
      if (disposed || checking) return;
      checking = true;
      try {
        const value = await request(session);
        if (!disposed) { accept(value); setConnection(live ? 'live' : 'syncing'); setError(''); }
      } catch (e) { if (!disposed) { setConnection('offline'); setError(e instanceof Error ? e.message : 'Conexão interrompida.'); } }
      finally { checking = false; }
    };
    const connect = () => {
      if (disposed) return;
      ws = new WebSocket(`${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/api/socket`);
      ws.onopen = () => { ws?.send(JSON.stringify({ room: session.code, token: session.token })); };
      ws.onmessage = event => {
        if (disposed) return;
        try {
          const value = JSON.parse(event.data);
          if (value.type === 'error') { live = false; setConnection('offline'); setError(value.error); return; }
          lastMessage = Date.now(); live = true; delay = 1000; setConnection('live'); setError('');
          if (value.type === 'state') accept(value);
        } catch { /* HTTP refresh will recover a malformed update. */ }
      };
      ws.onclose = () => {
        live = false;
        if (!disposed) { setConnection('connecting'); void refresh(); retry = setTimeout(connect, delay); delay = Math.min(delay * 2, 15000); }
      };
      ws.onerror = () => ws?.close();
    };
    void refresh(); connect();
    const tick = setInterval(() => {
      if (live && Date.now() - lastMessage > 8000) { live = false; ws?.close(); }
      if (!live) void refresh();
    }, 2000);
    const onReturn = () => { if (!document.hidden) void refresh(); };
    window.addEventListener('online', onReturn); document.addEventListener('visibilitychange', onReturn);
    return () => { disposed = true; clearTimeout(retry); clearInterval(tick); ws?.close(); window.removeEventListener('online', onReturn); document.removeEventListener('visibilitychange', onReturn); };
  }, [session, accept]);
  const act = useCallback(async (command: RemoteCommand): Promise<boolean> => {
    if (!session || acting.current) return false;
    acting.current = true; setBusy(true); setActionError('');
    const body = { type: 'command', code: session.code, commandId: crypto.randomUUID(), command };
    try { accept(await request(session, body)); return true; }
    catch (e) {
      // Reuse the SAME command id after an uncertain response. Never reroll.
      try { accept(await request(session, body)); return true; }
      catch (retryError) {
        setActionError(retryError instanceof Error ? retryError.message : (e instanceof Error ? e.message : 'Tente novamente.'));
        try { accept(await request(session)); } catch { /* Connection indicator handles reconnect. */ }
        return false;
      }
    } finally { acting.current = false; setBusy(false); }
  }, [session, accept]);
  const dismissActionError = useCallback(() => setActionError(''), []);
  return { reply, connection, error, actionError, dismissActionError, clockOffset, busy, act, accept };
}
