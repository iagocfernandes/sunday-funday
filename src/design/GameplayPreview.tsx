import {useEffect,useRef,useState} from 'react';
import {BoardPhone,BoardTv} from '../remote/BoardRemote';
import {createGame,applyCommand,nextAutoCommand} from '../game/engine';
import {DEFAULT_COLORS,DEFAULT_CONFIG} from '../data/config';
import type {Command,DomainEvent,GameState} from '../game/types';
import {HOST_AUDIO_CLIPS,selectHostAudioCue,type HostAudioClip} from '../presentation/hostAudioCues';
import {primeRecordedHostAudio} from '../presentation/useRecordedHostAudio';
import type {BoardPresentation,RemoteCommand,RemoteEvent,RoomReply} from '../remote/types';
import './gameplay-preview.css';

const MATCH='design-preview';
function fixture():GameState {
 const names=['Iago','Milena','Emiliano','Mari','Arthur','Fabi','Matheus','AR2','Bia','Lucas'];
 const state=createGame(names.map((name,i)=>({id:`p${i}`,name,color:DEFAULT_COLORS[i],symbol:'●',portrait:`/assets/characters/${['arthur','milena','arthur','mari'][i%4]}-v1.png`})),{rounds:10},{seed:71,shuffleOrder:false});
 state.phase='readyToRoll';state.pending=null;
 state.order.forEach((id,i)=>{state.players[id].nodeId=`m${i*3}`;state.players[id].common=28-i;state.players[id].golden=i%3;});
 state.players.p0.inventory=[{uid:'preview-double',itemId:'dadoDuplo'},{uid:'preview-swap',itemId:'trocaTroca'},{uid:'preview-slow',itemId:'preguicao'}];
 return state;
}

/** Isolated fixture: real TV/phone components and engine; never contacts a room. */
export function GameplayPreview(){
 const [state,setState]=useState(fixture),[events,setEvents]=useState<RemoteEvent[]>([]);
 const [presentation,setPresentation]=useState<BoardPresentation|null>(null);
 const [paused,setPaused]=useState(false),[phone,setPhone]=useState(false),[error,setError]=useState('');
 const current=useRef(state);current.current=state;
 const presentationRef=useRef<BoardPresentation|null>(null);presentationRef.current=presentation;
 const presentationPauseStarted=useRef<number|null>(null);
 const presentationSeq=useRef(0);
 const seq=useRef(0);
 function startPresentation(cue:{clip:HostAudioClip;durationMs:number;playerIds:string[]}){
  const id=`preview-presentation-${++presentationSeq.current}`;
  setPresentation({id,clip:cue.clip,durationMs:cue.durationMs,expiresAt:Date.now()+cue.durationMs,playerIds:cue.playerIds});
 }
 function commit(next:GameState,nextEvents:DomainEvent[]){
  const previous=current.current;
  current.current=next;setState(next);setError('');
  if(nextEvents.length)setEvents(old=>[...old,...nextEvents.map(event=>({seq:++seq.current,matchId:MATCH,event,byHost:false}))].slice(-60));
  const cue=selectHostAudioCue(previous,next,nextEvents);
  if(cue)startPresentation(cue);
 }
 function run(command:Command){
  if(presentationRef.current)return false;
  const s=current.current;const result=applyCommand(s,{commandId:crypto.randomUUID(),expectedRevision:s.revision,command});
  if(result.rejected){setError(result.rejected);return false;}
  commit(result.state,result.events);return true;
 }
 async function act(command:RemoteCommand){
  if(command.type==='pause'||command.type==='resume'){setPaused(command.type==='pause');return true;}
  if(command.type==='finishPresentation'){
   setPresentation(active=>active?.id===command.presentationId?null:active);return true;
  }
  if(command.type==='game')return run(command.command);
  if(command.type==='roll')return run({type:'rollDice'});
  return false;
 }
 useEffect(()=>{
  if(paused||presentation||state.phase==='readyToRoll'||state.phase==='itemWindow')return;
  const command=nextAutoCommand(state);if(!command)return;
  const timer=setTimeout(()=>run(command),state.pending?.kind==='cardPreview'?7000:state.pending?.kind==='harvest'?3000:550);
  return()=>clearTimeout(timer);
 },[state,paused,presentation]);
 useEffect(()=>{
  if(!presentation){presentationPauseStarted.current=null;return;}
  if(paused){if(presentationPauseStarted.current===null)presentationPauseStarted.current=Date.now();return;}
  if(presentationPauseStarted.current!==null){
   const elapsed=Date.now()-presentationPauseStarted.current;presentationPauseStarted.current=null;
   if(elapsed>0)setPresentation(active=>active?.id===presentation.id?{...active,expiresAt:active.expiresAt+elapsed}:active);
   return;
  }
  const delay=Math.max(0,presentation.expiresAt-Date.now());
  const timer=setTimeout(()=>setPresentation(active=>active?.id===presentation.id?null:active),delay);
  return()=>clearTimeout(timer);
 },[presentation,paused]);
 function testAudio(clip:HostAudioClip){
  void primeRecordedHostAudio();
  const metadata=HOST_AUDIO_CLIPS[clip];
  const playerIds=clip==='champion'?['p0']:clip==='bananaBought'||clip==='bananaStolen'?['p0']:[];
  startPresentation({clip,durationMs:metadata.durationMs,playerIds});
 }
 function scenario(kind:'reset'|'move'|'shop'|'luck'|'unluck'|'duel'|'sober'|'nextRound'|'win'|'negativePower'){
  const next=kind==='nextRound'?structuredClone(current.current):fixture();next.revision=current.current.revision+1;
  const demoEvents:DomainEvent[]=[];
  if(kind==='nextRound'){next.round+=1;next.pending=null;next.phase='readyToRoll';demoEvents.push({type:'roundStarted',round:next.round});}
  if(kind==='sober'){next.players.p7.tasks=[{cardId:'MA02',untilRound:next.round+2}];demoEvents.push({type:'cardResolved',playerId:'p7',cardId:'MA02'});}
  if(kind==='win')demoEvents.push({type:'minigameCompleted',minigameId:'beerpong',winners:['p0','p1']});
  if(kind==='negativePower')demoEvents.push({type:'itemGranted',playerId:'p0',itemId:'preguicao'});
  if(kind==='move'){
   // Simulate three canonical steps arriving in one network update.
   next.players.p0.nodeId='m3';next.players.p0.stepHistory=['m0','m1','m2'];next.dice=3;
  } else if(kind==='shop'){
   next.phase='awaitingInteraction';next.pending={kind:'shop',playerId:'p0',nodeId:'m0',items:DEFAULT_CONFIG.shopItems};
  } else if(kind==='luck'||kind==='unluck'){
   next.phase='awaitingInteraction';next.pending={kind:'cardPreview',playerId:'p0',cardId:kind==='luck'?'MS02':'MA03',category:kind};
  } else if(kind==='duel'){
   next.phase='awaitingInteraction';next.pending={kind:'duelBet',playerId:'p0',opponentId:'p1',maxBet:27};
  }
  setPaused(false);commit(next,demoEvents);
 }
 const reply:RoomReply={role:phone?'player':'host',playerId:'p0',serverNow:Date.now(),room:{code:'PREVIA',revision:state.revision,mode:'board',phase:'playing',players:state.order.map(id=>state.players[id]),activePlayerId:state.order[state.activeIndex],turn:state.activeIndex+1,round:state.round,rounds:10,diceMax:10,lastRoll:null,rolls:[],advanceAt:null,expiresAt:Date.now()+3600000,board:{matchId:MATCH,game:state,paused,itemDeadline:null,pausedItemMs:null,presentation,events}}};
 return <section className="gameplay-preview">
  <div className="preview-controls"><button aria-pressed={!phone} onClick={()=>setPhone(false)}>TV · 10 jogadores</button><button aria-pressed={phone} onClick={()=>setPhone(true)}>Celular</button><button onClick={()=>scenario('reset')}>Reiniciar prévia</button><button onClick={()=>scenario('move')}>Simular 3 passos</button><button onClick={()=>scenario('shop')}>Loja</button><button onClick={()=>scenario('luck')}>Sorte</button><button onClick={()=>scenario('unluck')}>Azar</button><button onClick={()=>scenario('duel')}>Duelo</button></div>
  <div className="preview-controls"><button onClick={()=>scenario('win')}>AR2: vitória</button><button onClick={()=>scenario('negativePower')}>AR2: poder de ataque</button><button onClick={()=>scenario('sober')}>Fique sóbrio · AR2</button><button onClick={()=>scenario('nextRound')}>Avançar uma rodada</button></div>
  <div className="preview-controls"><strong>Testar áudio:</strong>{(Object.keys(HOST_AUDIO_CLIPS) as HostAudioClip[]).map(clip=><button key={clip} onClick={()=>testAudio(clip)}>{HOST_AUDIO_CLIPS[clip].text}</button>)}</div>
  <p className="preview-help">Prévia isolada com 10 jogadores. No menu da TV, ative a nova trilha e compare a ilha viva. Teste o AR2 triste por duas rodadas com AR2. Para repetir os saltos, reinicie a prévia.</p>
  {error&&<p role="alert">{error}</p>}
  {phone?<div className="preview-phone remote-shell remote-app"><header className="remote-brand">SUNDAY FUNDAY</header><BoardPhone reply={reply} act={act} busy={false} online/></div>:<div className="preview-tv"><BoardTv reply={reply} act={act} busy={false} clockOffset={0} joinUrl={`${location.origin}/design/`}/></div>}
 </section>;
}
