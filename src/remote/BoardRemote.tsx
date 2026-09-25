import { useEffect, useMemo, useRef, useState } from 'react';
import { MiguelHostView } from '../components/MiguelHost';
import { useMiguelHost } from '../presentation/useMiguelHost';
import { useRecordedHostAudio, primeRecordedHostAudio } from '../presentation/useRecordedHostAudio';
import { HOST_AUDIO_CLIPS, type HostAudioClip } from '../presentation/hostAudioCues';
import { GameIcon } from '../components/GameIcon';
import { PlayerPortrait } from '../components/PlayerPortrait';
import { PowerArt } from '../components/PowerCard';
import { Board } from '../components/Board';
import { DecisionPanel } from '../components/DecisionPanel';
import { MinigamePanel } from '../components/MinigamePanel';
import { HistoryPanel, NextMinigame, Scoreboard } from '../components/Scoreboard';
import { CARDS_BY_ID } from '../data/cards';
import { ITEMS } from '../data/config';
import { activePlayer, ranking, statusText } from '../game/engine';
import type { Command, GameState } from '../game/types';
import { layoutBoardForRender } from '../presentation/boardLayout';
import { scenesFor, type Scene } from '../presentation/manifest';
import { useBoardMotion } from '../presentation/useBoardMotion';
import { useGameAudio } from '../presentation/useGameAudio';
import type { BoardView, RemoteCommand, RoomReply } from './types';

import { usePageScroll } from './usePageScroll';

type Act = (command: RemoteCommand) => Promise<boolean>;
/** Os componentes do jogo local recebem o estado público; semente/cursor nunca chegam ao cliente. */
const asState = (board: BoardView): GameState => ({ ...board.game, rngSeed: 0, rngCursor: 0 });

/** Cenas a partir do cursor de eventos: recarregar não repete cena, som ou prêmio. */
function useRemoteScenes(board: BoardView, state: GameState) {
  const [queue, setQueue] = useState<Scene[]>([]);
  const [current, setCurrent] = useState<Scene | null>(null);
  const seen = useRef<{ matchId: string; seq: number } | null>(null);
  useEffect(() => {
    const key = `sunday:remote:seen:${board.matchId}`;
    const latest = board.events.at(-1)?.seq ?? 0;
    if (seen.current?.matchId !== board.matchId) {
      let stored: number | null = null;
      try { const raw = sessionStorage.getItem(key); stored = raw === null ? null : Number(raw); } catch { /* sem armazenamento: não repete histórico */ }
      seen.current = { matchId: board.matchId, seq: stored ?? latest };
    }
    const fresh = board.events.filter(e => e.matchId === board.matchId && e.seq > seen.current!.seq);
    if (!fresh.length) return;
    seen.current.seq = latest;
    try { sessionStorage.setItem(key, String(latest)); } catch { /* ignorado */ }
    setQueue(q => [...q, ...fresh.flatMap(e => e.event.type==='cardResolved'?[]:e.event.type==='turnStarted'?[{id:`turn-${e.seq}`,level:'large' as const,title:`${state.players[e.event.playerId].name}, é sua vez!`,subtitle:'Prepare seu celular',presentationKey:'abertura',playerId:e.event.playerId,durationMs:1500}]:scenesFor(e.event, state))].slice(-6));
  }, [board.events, board.matchId, state]);
  useEffect(() => {
    if (current || !queue.length) return;
    setCurrent(queue[0]); setQueue(q => q.slice(1));
  }, [queue, current]);
  useEffect(() => {
    if (!current) return;
    // O servidor não espera a animação: a cena é só apresentação e dura pouco.
    const timer = setTimeout(() => setCurrent(null), Math.min(2400, Math.max(600, current.durationMs)));
    return () => clearTimeout(timer);
  }, [current]);
  return { scene: current, skip: () => setCurrent(null) };
}

function decisionSummary(state: GameState): {title:string; detail:string} | null {
  const p=state.pending; if(!p) return null;
  const actor=state.players[p.kind==='defense'?p.targetId:p.playerId]?.name??'Jogador';
  switch(p.kind){
    case 'path': return {title:`${actor}, escolha seu caminho`,detail:'As duas saídas estão iluminadas no mapa. Escolha pelo celular.'};
    case 'shop': return {title:`${actor} chegou à loja`,detail:'Comprar um poder ou continuar? A escolha está no celular.'};
    case 'pedestal': return {title:'A banana dourada está aqui!',detail:`${actor} pode colher por ${p.price} moedas. A parada não gasta passos.`};
    case 'harvest': return {title:`${actor} conquistou uma banana!`,detail:`A próxima está na ${state.map.stops?.find(s=>s.id===p.nextTreeId)?.name??'nova árvore'}. O caminho continua automaticamente.`};
    case 'iagugu': return {title:`${actor} encontrou o Iagugu`,detail:'Escolha a vítima no celular. Moedas: grátis · Banana dourada: 40 moedas.'};
    case 'duelBet':return {title:`Duelo! ${actor} × ${state.players[p.opponentId].name}`,detail:`${actor} escolhe a aposta no celular: até ${p.maxBet} moedas.`};
    case 'duelResult':return {title:`${actor} × ${state.players[p.opponentId].name}`,detail:`${p.allIn?'TUDO OU NADA: todas as moedas do perdedor.':`Duelo presencial valendo ${p.bet} moedas.`} O anfitrião registra o resultado.`};
    case 'cardPreview': {const card=CARDS_BY_ID[p.cardId];return {title:`${p.category==='luck'?'Sorte':'Azar'} · ${card?.title??'Evento'}`,detail:`${actor}: ${card?.description??'Confirme no celular.'}`};}
    case 'itemChoice':return {title:`${actor}, vai usar um poder?`,detail:'Escolha no celular ou siga para o dado.'};
    default:return {title:statusText(state,false),detail:`${actor} decide pelo celular.`};
  }
}

export function BoardTv({ reply, act, busy, joinUrl }: { reply: RoomReply; act: Act; busy: boolean; clockOffset: number; joinUrl: string }) {
  const board=reply.room.board!;
  const state=useMemo(()=>asState(board),[board.game]);
  const visualState=useMemo(()=>({...state,map:layoutBoardForRender(state.map)}),[state]);
  const motion=useBoardMotion(board.matchId,visualState,{paused:board.paused});
  const player=activePlayer(state);
  const [hostDecision,setHostDecision]=useState(false);
  const [drawer,setDrawer]=useState(false);
  const [camera,setCamera]=useState(true);
  const [living,setLiving]=useState(true);
  const [hostEnabled,setHostEnabled]=useState(true);
  const [voiceEnabled,setVoiceEnabled]=useState(true);
  const [narrating,setNarrating]=useState(false);
  const miguel=useMiguelHost({board,state,enabled:hostEnabled,paused:board.paused});
  const [landingKey,setLandingKey]=useState<string>();
  useEffect(()=>{if(motion.frame?.phase==='land')setLandingKey(current=>current===motion.frame?.key?current:motion.frame?.key)},[motion.frame?.key,motion.frame?.phase]);
  const audio=useGameAudio({board,state,paused:board.paused,stepKey:landingKey,visualSteps:true,ambientMusic:true,ducked:narrating});
  const presentation=board.presentation;
  const clip=presentation?HOST_AUDIO_CLIPS[presentation.clip as HostAudioClip]:null;
  const voice=useRecordedHostAudio(presentation&&clip?{id:presentation.id,src:clip.src,durationMs:presentation.durationMs}:null,{
    enabled:voiceEnabled,paused:board.paused,muted:audio.muted,
    onComplete:id=>{void act({type:'finishPresentation',matchId:board.matchId,presentationId:id});},
  });
  useEffect(()=>setNarrating(voice.speaking),[voice.speaking]);
  const reveal=state.pending?.kind==='cardPreview'?state.pending:null;
  const card=reveal?CARDS_BY_ID[reveal.cardId]:null;
  const {scene}=useRemoteScenes(board,state);
  const dispatch=(command:Command)=>act({type:'game',matchId:board.matchId,revision:state.revision,command});
  const adminDispatch=(command:Command)=>{void dispatch(command);return true;};
  const summary=decisionSummary(state),sorted=ranking(state);
  const pathOptions=state.pending?.kind==='path'?state.pending.options:[];
  useEffect(()=>setHostDecision(false),[state.pending?.kind,state.phase]);
  useEffect(()=>{const close=(e:KeyboardEvent)=>{if(e.key==='Escape'){setDrawer(false);setHostDecision(false)}};window.addEventListener('keydown',close);return()=>window.removeEventListener('keydown',close)},[]);
  const title=board.paused?'Partida pausada':summary?.title??(state.phase==='readyToRoll'?`${player?.name}, é sua vez!`:statusText(state,false));
  const detail=board.paused?'O anfitrião pode retomar quando todos estiverem prontos.':summary?.detail??(state.phase==='readyToRoll'?'Jogue o dado no celular.':state.phase==='moving'?`${state.movement?.remaining??0} passos restantes`:'Acompanhe a partida no mapa.');
  return <div className="tv-stage">
    <MiguelHostView reaction={miguel} enabled={hostEnabled&&!drawer&&!hostDecision&&!presentation} className={reveal?'miguel-during-card':undefined}/>
    <div className={`tv-map ${camera?'tv-camera':''}`} style={camera&&motion.focus?{transform:`scale(1.04) translate(${(0.5-motion.focus.x)*3}%, ${(0.5-motion.focus.y)*3}%)`}:undefined}><Board state={motion.state} living={living} paused={board.paused} highlightNodes={pathOptions} onNodeClick={hostDecision?nodeId=>void dispatch({type:'choosePath',nodeId}):undefined}/></div>
    <header className="tv-hud-top">
      <div className="tv-active"><PlayerPortrait src={player?.portrait} className="tv-active-portrait"/><div><small>VEZ DE</small><strong>{player?.name??'—'}</strong><span><GameIcon kind="banana"/> {player?.golden??0} <i>·</i> <GameIcon kind="coin"/> {player?.common??0}</span></div><div className="tv-die" aria-label={`Dado: ${state.dice??'aguardando'}`}>{state.dice??'?'}</div></div>
      <div className="tv-top-actions"><div className="tv-round"><small>RODADA</small><strong>{state.round}<span> / {state.config.rounds}</span></strong></div><button aria-label={board.paused?'Retomar partida':'Pausar partida'} disabled={busy||state.phase==='finished'} onClick={()=>void act({type:board.paused?'resume':'pause',matchId:board.matchId})}>{board.paused?'▶ Retomar':'Ⅱ Pausar'}</button><button onClick={()=>setDrawer(true)} aria-label="Abrir menu da partida">☰ Menu</button></div>
    </header>
    {card&&reveal&&<div className={`tv-card-reveal ${card.category}`} role="status" aria-live="polite"><article key={`${state.revision}-${card.id}`} className="tv-reveal-card"><span className="tv-card-category"><GameIcon kind={card.category}/>{card.category==='luck'?' SORTE':' AZAR'}{card.weight===1?' · SUPER RARA':''}</span><div className="tv-card-person"><PlayerPortrait src={state.players[reveal.playerId].portrait}/><span>{state.players[reveal.playerId].name}</span></div><h1>{card.title}</h1><p>{card.description}</p><small>{card.targetRule==='otherPlayer'?'Em seguida, escolha um jogador no celular':'O efeito será aplicado automaticamente'}</small><div className="tv-card-progress" style={{animationPlayState:board.paused||!!presentation?'paused':'running'}}/></article></div>}
    {scene&&!reveal&&!drawer&&!presentation&&<div className={scene.level==='small'?'tv-event':'tv-event-splash'} role="status">{scene.playerId&&scene.level!=='small'&&<PlayerPortrait src={state.players[scene.playerId]?.portrait} className="tv-scene-portrait"/>}<strong>{scene.title}</strong>{scene.subtitle&&<span>{scene.subtitle}</span>}</div>}
    <div className="tv-bottom-hud">
      <section className={`tv-prompt ${state.pending?'has-choice':''}`} aria-live="polite"><div><strong>{title}</strong><p>{detail}</p></div>
        {state.pending&&!['cardPreview','harvest'].includes(state.pending.kind)&&<button disabled={busy||board.paused||!!presentation} onClick={()=>setHostDecision(true)}>{state.pending.kind==='duelResult'?'Registrar resultado':'Ajudar jogador'}</button>}
        {!state.pending&&state.phase==='readyToRoll'&&<span className="tv-phone-cue">📱 No celular</span>}
      </section>
      <div className="tv-players" aria-label="Placar da partida">{sorted.map((p,i)=><div key={p.id} className={`tv-player ${p.id===player?.id?'is-active':''}`} style={{borderColor:p.id===player?.id?p.color:undefined}}><span className="tv-rank">{i+1}º</span><PlayerPortrait src={p.portrait} className="tv-player-portrait"/><div><strong>{p.name}</strong><span><GameIcon kind="banana"/> {p.golden} <i>·</i> <GameIcon kind="coin"/> {p.common}</span></div></div>)}</div>
    </div>
    {state.phase==='readyToRoll'&&!state.pending&&!drawer&&!hostDecision&&!presentation&&<button className="tv-quick-roll" disabled={busy||board.paused} aria-label={`Rolar dado por ${player?.name??'jogador'}`} title="Rolar pelo jogador da vez" onClick={()=>void act({type:'roll',turn:reply.room.turn,matchId:board.matchId})}><span aria-hidden="true">⚄</span><strong>{busy?'Enviando…':'Rolar dado'}</strong><small>Por {player?.name}</small></button>}
    {hostDecision&&state.pending&&<div className="tv-modal-shade"><section className="tv-dialog" role="dialog" aria-label="Controle do anfitrião" aria-modal="true"><button className="tv-close" onClick={()=>setHostDecision(false)} autoFocus>Fechar ✕</button><fieldset disabled={busy||board.paused||!!presentation}><DecisionPanel state={state} dispatch={dispatch}/></fieldset></section></div>}
    {drawer&&<div className="tv-modal-shade"><aside className="tv-drawer" role="dialog" aria-label="Menu da partida" aria-modal="true"><button className="tv-close" onClick={()=>setDrawer(false)} autoFocus>Voltar ao mapa ✕</button><h2>Partida · {reply.room.code}</h2><button aria-pressed={camera} onClick={()=>setCamera(!camera)}>Câmera suave: {camera?'ligada':'desligada'}</button><button aria-pressed={living} onClick={()=>setLiving(!living)}>Ilha viva: {living?'ligada':'desligada'}</button><h3>AR2, o anfitrião</h3><button aria-pressed={hostEnabled} onClick={()=>setHostEnabled(!hostEnabled)}>Comentários do AR2: {hostEnabled?'ligados':'desligados'}</button><button aria-pressed={voiceEnabled} onClick={()=>{primeRecordedHostAudio();setVoiceEnabled(!voiceEnabled)}}>Voz gravada do AR2: {voiceEnabled?'ligada':'desligada'}</button><small>As falas pausam a ação e retomam automaticamente.</small><h3>Áudio da TV</h3>{!audio.supported?<p>Áudio não disponível neste navegador.</p>:!audio.enabled?<button onClick={()=>void audio.enable()}>Ativar áudio</button>:<><button aria-pressed={audio.muted} onClick={audio.toggleMute}>{audio.muted?'Ativar som':'Silenciar tudo'}</button><button aria-pressed={audio.musicEnabled} onClick={audio.toggleMusic}>Música ambiente: {audio.musicEnabled?'ligada':'desligada'}</button><label style={{display:'grid',gap:6,margin:'12px 0'}}>Volume da música<input type="range" min="0" max="1" step="0.05" value={audio.musicVolume} onChange={event=>audio.setMusicVolume(Number(event.currentTarget.value))}/></label><label style={{display:'grid',gap:6,margin:'12px 0'}}>Volume dos efeitos<input type="range" min="0" max="1" step="0.05" value={audio.effectsVolume} onChange={event=>audio.setEffectsVolume(Number(event.currentTarget.value))}/></label></>}<p>Link dos jogadores</p><a href={joinUrl} target="_blank" rel="noreferrer">{joinUrl}</a><Scoreboard state={state}/><NextMinigame state={state}/><h3>Poderes de {player?.name}</h3><p>{player?.inventory.map(i=>ITEMS[i.itemId].name).join(' · ')||'Nenhum poder na mão.'}</p>
      {state.phase==='readyToRoll'&&!state.pending&&<button disabled={busy||board.paused||!!presentation} onClick={()=>void act({type:'roll',turn:reply.room.turn,matchId:board.matchId})}>Rolar por {player?.name}</button>}
      {state.phase==='itemWindow'&&<button disabled={busy||board.paused||!!presentation} onClick={()=>void dispatch({type:'requestItemChoice'})}>Escolher poder pelo anfitrião</button>}
      {state.phase==='roundReady'&&<button disabled={busy||board.paused||!!presentation} onClick={()=>void dispatch({type:'startRound'})}>Iniciar rodada</button>}
      {state.notice&&<p>{state.notice}</p>}<HistoryPanel state={state}/></aside></div>}
    {!presentation&&(state.phase==='minigameIntro'||state.phase==='awaitingResults')&&<MinigamePanel state={state} dispatch={adminDispatch}/>}
    {state.phase==='roundEnd'&&<div className="tv-round-summary"><h2>Rodada {state.round} concluída</h2><p>Confira o placar. A próxima etapa começa automaticamente.</p></div>}
    {!presentation&&state.phase==='finished'&&<div className="tv-modal-shade"><section className="tv-dialog"><h1>🏆 {sorted[0]?.name}</h1><p>Partida encerrada</p><Standings state={state}/><button disabled={busy} onClick={()=>void act({type:'restart'})}>Nova partida com os mesmos jogadores</button></section></div>}
    {presentation&&clip&&!drawer&&<section className="ar2-announcement" role="dialog" aria-modal="true" aria-label="AR2 anuncia" key={presentation.id}>
      <div className="ar2-announcement-card">
        <MiguelHostView enabled reaction={{messageId:presentation.id,text:null,visible:false,mood:clip.mood,dismiss:voice.skip}} className="ar2-announcement-host"/>
        <small>AR2 NO COMANDO</small><h1>{clip.text}</h1>
        <div className="ar2-announcement-players">{presentation.playerIds.map(id=>state.players[id]&&<div key={id}><PlayerPortrait src={state.players[id].portrait}/><strong>{state.players[id].name}</strong></div>)}</div>
        <p>{board.paused?'Partida pausada':voice.speaking?'Acompanhe a fala. O jogo continua automaticamente.':'Retomando a partida…'}</p>
        <button onClick={()=>{void act({type:'finishPresentation',matchId:board.matchId,presentationId:presentation.id});}} disabled={busy}>Pular fala →</button> <button onClick={()=>void act({type:board.paused?'resume':'pause',matchId:board.matchId})} disabled={busy}>{board.paused?'Retomar':'Pausar'}</button>
      </div>
    </section>}
  </div>;
}

function Standings({ state }: { state: GameState }) {
  return <div className="card-panel" style={{ maxWidth: 820, marginTop: '0.6rem' }}>
    <h3>Classificação (douradas primeiro, depois moedas)</h3>
    <div className="reward-preview">{ranking(state).map((p, i) => <span key={p.id} className="reward-chip">{i + 1}º {p.name} — <GameIcon kind="banana"/> {p.golden} · <GameIcon kind="coin"/> {p.common}</span>)}</div>
  </div>;
}

function phoneStatus(state: GameState, board: BoardView, me: string | null): { title: string; detail: string } {
  const active = activePlayer(state);
  const mine = active?.id === me;
  const p = state.pending;
  if (board.presentation) return {title:'AR2 está falando',detail:'Acompanhe a TV. Seus controles voltam automaticamente ao final da fala.'};
  if (state.phase === 'finished') return { title: 'Partida encerrada', detail: 'Veja o resultado final na TV.' };
  if (board.paused) return { title: 'Jogo pausado', detail: 'O anfitrião pausou a partida. Aguarde.' };
  if (state.phase === 'roundReady') return { title: `Rodada ${state.round}`, detail: state.map.stops ? 'A rodada começa automaticamente. Acompanhe a TV.' : 'Aguardando o anfitrião iniciar a rodada na TV.' };
  if (state.phase === 'minigameIntro' || state.phase === 'awaitingResults') return { title: 'Prova presencial', detail: 'Siga as instruções do anfitrião. O resultado é registrado na TV.' };
  if (state.phase === 'roundEnd') return { title: `Rodada ${state.round} concluída`, detail: 'Confira o placar na TV.' };
  if(p?.kind==='cardPreview')return {title:CARDS_BY_ID[p.cardId].title,detail:CARDS_BY_ID[p.cardId].description+' Acompanhe a TV; o efeito é automático.'};
  if(p?.kind==='harvest')return {title:'Banana colhida!',detail:'O caminho continua automaticamente.'};
  if (p && (('playerId' in p && p.playerId === me) || (p.kind === 'defense' && p.targetId === me))) return { title: 'Sua escolha', detail: 'Decida abaixo. Todos acompanham na TV.' };
  if (mine && (state.phase === 'itemWindow' || state.phase === 'awaitingItemChoice')) return { title: 'Seu poder', detail: 'Use um poder ou siga para o dado.' };
  if (mine && state.phase === 'readyToRoll') return { title: 'É a sua vez!', detail: 'Toque uma vez. O resultado aparece aqui e na TV.' };
  if (mine && state.dice !== null) return { title: `Você tirou ${state.dice}`, detail: 'Acompanhe o movimento na TV.' };
  if (p) return { title: 'Aguardando uma escolha', detail: `${state.players[p.kind === 'defense' ? p.targetId : p.playerId]?.name ?? 'O jogador'} está decidindo no celular.` };
  return { title: `Vez de ${active?.name ?? '—'}`, detail: 'Seu botão libera na sua vez.' };
}

export function BoardPhone({ reply, act, busy, online }: { reply: RoomReply; act: Act; busy: boolean; online: boolean }) {
  usePageScroll(true);
  const board = reply.room.board!;
  const state = asState(board);
  const me = reply.playerId ? state.players[reply.playerId] : null;
  const active = activePlayer(state);
  const myTurn = !!me && active?.id === me.id;
  const canRoll = myTurn && state.phase === 'readyToRoll' && !state.pending && !board.paused && !board.presentation && !busy && online;
  const status = phoneStatus(state, board, me?.id ?? null);
  const place = me ? ranking(state).findIndex(p => p.id === me.id) + 1 : 0;
  const showDice = state.dice !== null;
  const pending = state.pending;
  const ownsDecision = !board.presentation && !!pending && !['cardPreview','harvest'].includes(pending.kind) && (pending.kind === 'defense' ? pending.targetId : pending.playerId) === me?.id;
  const dispatch = (command: Command) => act({ type: 'game', matchId: board.matchId, revision: state.revision, command });
  return <div className="remote-play-layout">
    <section className={`remote-stage ${myTurn ? 'is-my-turn' : ''}`}>
      {me && <div className="remote-wallet" aria-label="Seu saldo">
        <span><b><GameIcon kind="coin"/> {me.common}</b><small>moedas</small></span>
        <span><b><GameIcon kind="banana"/> {me.golden}</b><small>douradas</small></span>
        <span><b>{place}º</b><small>no placar</small></span>
      </div>}
      <div className="remote-eyebrow">{myTurn ? 'SUA VEZ' : `VEZ DE ${active?.name?.toUpperCase() ?? '—'}`}</div>
      {!ownsDecision && <h1>{status.title}</h1>}
      {!ownsDecision && <div className={`remote-die ${showDice ? 'remote-die-result' : ''}`} aria-label={showDice ? `Dado: ${state.dice}` : 'Aguardando o dado'}>{showDice ? state.dice : state.phase === 'finished' ? '✓' : '?'}</div>}
      {!ownsDecision && <p>{status.detail}</p>}
      {ownsDecision && <fieldset className="phone-decision" disabled={busy || !online || board.paused || !!board.presentation}>
        <DecisionPanel state={state} dispatch={dispatch} canResolveDuel={false} />
      </fieldset>}
      {myTurn && state.phase === 'itemWindow' && <fieldset disabled={busy || !online || board.paused || !!board.presentation}><button onClick={() => void dispatch({ type: 'requestItemChoice' })}>Usar poder</button><button onClick={() => void dispatch({ type: 'itemWindowExpired' })}>Seguir para o dado</button></fieldset>}
      {!ownsDecision && <button className="remote-roll-button" disabled={!canRoll} onClick={() => void act({ type: 'roll', turn: reply.room.turn, matchId: board.matchId })}>
        {busy ? 'Enviando…' : !online ? 'Sem conexão…' : canRoll ? 'Jogar dado' : myTurn ? 'Aguarde' : 'Aguarde sua vez'}
      </button>}
      {me?.slowNextRoll&&<p className="remote-last">🦥 Seu próximo dado ficará entre 1 e 3.</p>}
      {me?.tasks?.filter(t=>t.untilRound>state.round).map(t=><p className="remote-task" key={`${t.cardId}-${t.untilRound}`}><b>{CARDS_BY_ID[t.cardId].title}</b><span>{CARDS_BY_ID[t.cardId].description}</span><small>Até o início da rodada {t.untilRound}</small></p>)}
      {me && me.inventory.length > 0 && <section className="phone-powers"><h2>Seus poderes · {me.inventory.length}/3</h2><div className="phone-powers-list">{me.inventory.map(it=><article className="phone-power" key={it.uid}><PowerArt itemId={it.itemId}/><strong>{ITEMS[it.itemId].name}</strong><small>{ITEMS[it.itemId].usage==='defensive'?'Automático':'Antes do dado'}</small></article>)}</div></section>}
    </section>
    <details className="remote-history phone-score"><summary>Ver placar completo</summary><ol>{ranking(state).map((p, i) => <li key={p.id}><span><b>{i + 1}º {p.name}</b>{p.id === me?.id && <small>você</small>}</span><strong style={{ fontSize: 18 }}><GameIcon kind="banana"/> {p.golden} · <GameIcon kind="coin"/> {p.common}</strong></li>)}</ol></details>
  </div>;
}
