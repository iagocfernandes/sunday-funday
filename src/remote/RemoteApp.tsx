import { primeRecordedHostAudio } from '../presentation/useRecordedHostAudio';
import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { loadSession, newCode, request, saveSession, secret, type RemoteSession } from './client';
import { useRoom } from './useRoom';
import type { RoomMode, RoomView } from './types';
import { BoardPhone, BoardTv } from './BoardRemote';
import './remote.css';
import { preparePortrait } from './photo';
import { usePageScroll } from './usePageScroll';

const labels = { connecting: 'Reconectando…', live: 'Conectado ao vivo', syncing: 'Conectado', offline: 'Sem conexão. Tentando novamente…' };
function useQr(url: string) {
  const [image, setImage] = useState('');
  useEffect(() => { let active = true; if (url) void QRCode.toDataURL(url, { width: 280, margin: 2, color: { dark: '#14291e', light: '#ffffff' } }).then(v => { if (active) setImage(v); }); return () => { active = false; }; }, [url]);
  return image;
}
function RollHistory({ room }: { room: RoomView }) {
  return <section className="remote-history"><h2>Dados registrados</h2>{room.rolls.length ? <ol>{[...room.rolls].reverse().slice(0, 10).map(roll => <li key={roll.id}><span><b>{roll.playerName}</b><small>Rodada {roll.round}{roll.byHost ? ' · pelo anfitrião' : ''}</small></span><strong>{roll.value}</strong></li>)}</ol> : <p>O primeiro resultado vai aparecer aqui.</p>}</section>;
}
export default function RemoteApp() {
  const params = new URLSearchParams(location.search);
  const isHost = params.get('remote') !== 'join';
  const role = isHost ? 'host' : 'player';
  const [code, setCode] = useState((params.get('room') ?? '').toUpperCase());
  const [session, setSession] = useState<RemoteSession | null>(() => loadSession(role, code));
  const [name, setName] = useState('');
  const [portrait,setPortrait]=useState('');
  const [photoBusy,setPhotoBusy]=useState(false);
  const [entryError, setEntryError] = useState('');
  const [joining, setJoining] = useState(false);
  const [copyMessage, setCopyMessage] = useState('');
  const { reply, connection, error, actionError, dismissActionError, clockOffset, busy, act, accept } = useRoom(session);
  const room = reply?.room;
  const joinUrl = session ? `${location.origin}/?remote=join&room=${session.code}` : '';
  const qr = useQr(isHost ? joinUrl : '');
  const active = room?.players.find(p => p.id === room.activePlayerId);
  const myTurn = !!room && reply?.playerId === room.activePlayerId;
  const me = room?.players.find(p => p.id === reply?.playerId);
  const last = room?.lastRoll;
  const showingResult = !!room?.advanceAt;
  const canRoll = room?.phase === 'playing' && !showingResult && (isHost || myTurn) && !busy && connection !== 'offline' && connection !== 'connecting';

  async function enter(mode: RoomMode = 'dice') {
    if (joining) return;
    setJoining(true); setEntryError('');
    try {
      const roomCode = isHost ? (code || newCode()) : code.trim().toUpperCase();
      const saved = loadSession(role, roomCode);
      const identity = saved ?? { code: roomCode, token: secret(), name: name.trim() };
      // Persist before the request: a lost join/create response must not lose identity.
      saveSession(role, identity); setCode(roomCode);
      const result = await request(identity, isHost ? { type: 'create', code: roomCode, mode } : { type: 'command', code: roomCode, commandId: crypto.randomUUID(), command: { type: 'join', name, ...(portrait?{portrait}:{}) } });
      history.replaceState(null, '', `/?remote=${isHost ? 'tv' : 'join'}&room=${roomCode}`);
      setSession(identity); accept(result);
    } catch (e) { setEntryError(e instanceof Error ? e.message : 'Não foi possível entrar.'); }
    finally { setJoining(false); }
  }
  function otherRoom() {
    setSession(null); setCode(''); setEntryError('');
    history.replaceState(null, '', `/?remote=${isHost ? 'tv' : 'join'}`);
  }
  async function copyLink() {
    try { await navigator.clipboard.writeText(joinUrl); setCopyMessage('Link copiado'); }
    catch { setCopyMessage('Use o endereço exibido abaixo.'); }
  }
  const boardMode = room?.mode === 'board';
  const tvPlaying = isHost && boardMode && room.phase !== 'lobby';
  usePageScroll(!tvPlaying);
  const shownError = error || actionError || entryError;
  if (isHost && boardMode && room.phase !== 'lobby' && reply) {
    return <>
      <BoardTv reply={reply} act={act} busy={busy} clockOffset={clockOffset} joinUrl={joinUrl} />
      {shownError && <div className="remote-toast" role="alert">{shownError}<button onClick={dismissActionError}>OK</button></div>}
      {connection === 'offline' || connection === 'connecting' ? <div className="remote-toast remote-toast-conn" role="status">{labels[connection]}</div> : null}
    </>;
  }
  return <main className={`remote-app ${isHost ? 'remote-tv' : 'remote-phone'} ${boardMode && room?.phase !== 'lobby' ? 'remote-in-game' : ''}`}>
    <header className="remote-header"><a className="remote-brand" href="/">SUNDAY <span>FUNDAY</span></a><span className="remote-tag">{boardMode ? (isHost ? 'TABULEIRO NA TV' : 'SEU CONTROLE') : 'TESTE DE CONTROLES'}</span>{session && <span className={`remote-connection ${connection}`} role="status">{labels[connection]}</span>}</header>
    {!session ? <section className="remote-entry">
      <div className="remote-eyebrow">{isHost ? 'O TABULEIRO NA TV. O CONTROLE NA MÃO.' : 'SEU CELULAR É O CONTROLE.'}</div>
      <h1>{isHost ? 'Vamos jogar Sunday Funday?' : 'Entre na sala.'}</h1>
      <p>{isHost ? 'Crie a partida, conecte de 2 a 10 celulares. Cada jogador rola o dado e faz suas escolhas no celular. A TV mostra o tabuleiro e o placar.' : 'Use o código da TV e escolha seu nome. Não precisa criar uma conta.'}</p>
      <form onSubmit={e => { e.preventDefault(); void enter(isHost ? 'board' : 'dice'); }}>
        {!isHost && <><label htmlFor="room-code">Código da sala</label><input id="room-code" value={code} onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z2-9]/g, '').slice(0, 6))} maxLength={6} autoCapitalize="characters" autoComplete="off" required placeholder="ABC234" /><label htmlFor="player-name">Seu nome</label><input id="player-name" value={name} onChange={e => setName(e.target.value)} maxLength={24} autoComplete="given-name" required placeholder="Como você quer aparecer?" /><label htmlFor="player-photo">Sua foto (opcional)</label><input id="player-photo" type="file" accept="image/*" disabled={joining||photoBusy} onChange={async e=>{const file=e.target.files?.[0];if(!file)return;setPhotoBusy(true);setEntryError('');try{setPortrait(await preparePortrait(file));}catch(error){setEntryError(error instanceof Error?error.message:'Foto inválida.');}finally{setPhotoBusy(false);}}}/>{portrait&&<div className="photo-preview"><img src={portrait} alt="Prévia do seu ícone"/><button type="button" onClick={()=>setPortrait('')}>Remover foto</button></div>}<small>{photoBusy?'Preparando foto…':'A foto será seu ícone no mapa e no placar. Sem foto, usamos um gorila.'}</small></>}
        <button className="remote-primary" disabled={joining||photoBusy}>{joining ? 'Conectando…' : isHost ? 'Criar partida no tabuleiro' : 'Entrar no jogo'}</button>
        {isHost && <button type="button" disabled={joining} onClick={() => void enter('dice')}>Criar teste de dados (3 rodadas)</button>}
      </form>
      {entryError && <p className="remote-error" role="alert">{entryError}</p>}
      <a className="remote-text-link" href={isHost ? '/?remote=join' : '/?remote=tv'}>{isHost ? 'Estou no celular: entrar como jogador' : 'Abrir a tela do anfitrião'}</a>
      {isHost && <a className="remote-text-link" href="/?mode=local">Modo local clássico e backups antigos</a>}
      <small>{isHost ? 'Dados, caminhos, poderes e compras pelo celular. O anfitrião registra os resultados das provas.' : 'Seu celular controla o dado, os caminhos, os poderes e as compras.'}</small>
    </section> : <>
      {!room ? <section className="remote-entry"><h1>Recuperando sua sala…</h1><p>Se você recarregou, seus dados continuam registrados.</p></section> : <>
        <div className="remote-room-heading"><div><span className="remote-eyebrow">SALA</span><strong>{room.code}</strong></div><span>{room.phase === 'lobby' ? 'Aguardando jogadores' : room.phase === 'finished' ? (boardMode ? 'Partida encerrada' : 'Teste concluído') : `Rodada ${room.round} de ${room.rounds}`}</span>{me && <span className="remote-player-badge">{me.name}</span>}</div>
        {room.phase === 'lobby' ? <div className="remote-lobby">
          {isHost && <section className="remote-qr"><h1>Conectem os celulares.</h1>{qr && <img src={qr} alt="QR code para entrar nesta sala" width={240} height={240} />}<p>Escaneie a câmera ou abra o link.</p><button onClick={() => void copyLink()}>Copiar link dos jogadores</button><small aria-live="polite">{copyMessage}</small><a href={joinUrl} target="_blank" rel="noreferrer">{joinUrl}</a></section>}
          <section className="remote-roster"><h2>{isHost ? 'Quem já entrou' : `Você entrou, ${me?.name ?? 'gorila'}!`}</h2><p>{isHost ? (boardMode ? 'A ordem será sorteada ao iniciar. De 2 a 10 jogadores.' : 'A ordem de entrada será a ordem dos dados.') : 'Aguarde o anfitrião iniciar. Pode deixar esta tela aberta.'}</p><ol>{room.players.map((p, i) => <li key={p.id}><span className="remote-avatar">{i + 1}</span><b>{p.name}</b><span>Pronto</span></li>)}</ol>{!room.players.length && <p className="remote-empty">Esperando o primeiro celular…</p>}{isHost && <button className="remote-primary" onClick={() => { primeRecordedHostAudio(); void act({ type: 'start' }); }} disabled={room.players.length < 2 || busy}>{room.players.length < 2 ? `Faltam ${2 - room.players.length} jogadores` : `Começar com ${room.players.length} jogadores`}</button>}</section>
        </div> : boardMode && reply ? <BoardPhone reply={reply} act={act} busy={busy} online={connection !== 'offline' && connection !== 'connecting'} /> : <div className="remote-play-layout"><section className={`remote-stage ${myTurn ? 'is-my-turn' : ''}`}>
          <div className="remote-eyebrow">{room.phase === 'finished' ? 'TRÊS RODADAS COMPLETAS' : showingResult ? `${last?.playerName} JOGOU` : myTurn && !isHost ? 'É A SUA VEZ' : 'VEZ DE'}</div>
          <h1>{room.phase === 'finished' ? 'Teste concluído!' : showingResult ? 'Dado registrado.' : active?.name}</h1>
          <div key={last?.id ?? 'waiting'} className={`remote-die ${showingResult ? 'remote-die-result' : ''}`} aria-label={showingResult ? `Resultado do dado: ${last?.value}` : 'Aguardando o próximo dado'}>{showingResult ? last?.value : room.phase === 'finished' ? '✓' : '?'}</div>
          {room.phase === 'finished' ? <p>{room.rolls.length} dados registrados. Os celulares e a TV completaram o teste.</p> : showingResult ? <p>O próximo jogador será chamado automaticamente.</p> : <p>{isHost ? 'O botão de jogar está liberado no celular desse jogador.' : myTurn ? 'Toque uma vez. O resultado vai aparecer aqui e na TV.' : `Aguarde ${active?.name} jogar. Seu botão libera na sua vez.`}</p>}
          {!isHost && room.phase === 'playing' && <button className="remote-roll-button" disabled={!canRoll} onClick={() => void act({ type: 'roll', turn: room.turn })}>{busy ? 'Registrando…' : showingResult ? 'Dado registrado' : myTurn ? 'Jogar dado' : 'Aguarde sua vez'}</button>}
          {last && !showingResult && <p className="remote-last">Último dado: <b>{last.playerName} tirou {last.value}</b></p>}
          {isHost && room.phase === 'playing' && <button className="remote-host-roll" disabled={!canRoll} onClick={() => void act({ type: 'roll', turn: room.turn })}>Rolar por {active?.name}</button>}
          {isHost && room.phase === 'finished' && <button className="remote-primary" disabled={busy} onClick={() => void act({ type: 'restart' })}>Repetir teste com os mesmos jogadores</button>}
        </section><RollHistory room={room} /></div>}
      </>}
      {shownError && <div className="remote-error" role="alert">{shownError}{actionError && <button onClick={dismissActionError} style={{ marginLeft: 12 }}>OK</button>}</div>}
      <footer className="remote-footer"><span>Partida salva automaticamente.</span><button onClick={otherRoom}>Abrir outra sala</button></footer>
    </>}
  </main>;
}
