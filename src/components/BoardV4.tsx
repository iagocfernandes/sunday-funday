import { useId } from 'react';
import type { GameState, NodeKind } from '../game/types';
import { boardMotionFrame, type BoardMotionTarget } from '../presentation/useBoardMotion';
import { displayPortrait } from '../presentation/portrait';
import { LivingIsland } from './LivingIsland';

const colors: Partial<Record<NodeKind,string>>={start:'#c3962e',plus:'#347bb8',minus:'#ba3530',luck:'#448550',unluck:'#745092',duel:'#ad542b'};
const labels: Partial<Record<NodeKind,string>>={start:'Início: +10 por volta',plus:'+3 moedas',minus:'−3 moedas',luck:'Sorte',unluck:'Azar',duel:'Duelo'};
function Symbol({kind}:{kind:NodeKind}) {
  if(kind==='unluck') return <g fill="#fff6da"><path d="M-6 1a3 3 0 0 1 0-6 4 4 0 0 1 7-1 3 3 0 0 1 4 5H-6Z"/><path d="M0 0h4L0 4h3l-6 5 2-5h-3Z"/></g>;
  if(kind==='luck') return <g fill="#fff6da"><circle cx="-3" cy="-3" r="3.5"/><circle cx="3" cy="-3" r="3.5"/><circle cx="-3" cy="3" r="3.5"/><circle cx="3" cy="3" r="3.5"/></g>;
  if(kind==='duel') return <g stroke="#fff6da" strokeWidth="2.3" strokeLinecap="round"><path d="M-6-6L6 6M6-6L-6 6M-6 2L-2 6M2 6L6 2"/></g>;
  if(kind==='start') return <g stroke="#fff6da" strokeWidth="1.5" fill="#fff6da"><path d="M-4 7V-7M-3-7Q1-9 6-5L3 0Q0-3-3-1Z"/></g>;
  return <g stroke="#fff6da" strokeWidth="3" strokeLinecap="round"><path d="M-6 0H6"/>{kind==='plus'&&<path d="M0-6V6"/>}</g>;
}
export function BoardV4({state,highlightNodes=[],onNodeClick,living=false,paused=false}:{state:GameState;highlightNodes?:string[];onNodeClick?:(id:string)=>void;living?:boolean;paused?:boolean}) {
  const uid=useId().replace(/:/g,''); const active=state.order[state.activeIndex];
  const motion=boardMotionFrame(state);
  const clip=`${uid}-portrait`,rim=`${uid}-rim`,shine=`${uid}-shine`;
  const at=(x:number,y:number)=>`${x*1000} ${y*563}`;
  return <svg viewBox="0 0 1000 563" className="island-board" style={{width:'100%',height:'100%'}} role="group" aria-label={`Ilha dos gorilas: ${Object.keys(state.map.nodes).length} casas e paradas entre casas`}>
    <defs>
      <linearGradient id={rim} x2="0" y2="1"><stop stopColor="#fff1cf"/><stop offset=".55" stopColor="#d4ba83"/><stop offset="1" stopColor="#9d7b4d"/></linearGradient>
      <linearGradient id={shine} x2="0" y2="1"><stop stopColor="#fff" stopOpacity=".28"/><stop offset="1" stopColor="#000" stopOpacity=".12"/></linearGradient>
      <clipPath id={clip}><circle r="13"/></clipPath>
    </defs>
    <image href="/assets/board/ilha-v4-2x.webp" width="1000" height="563"/>
    {living&&<LivingIsland paused={paused}/>}
    {state.map.stops?.map(stop=>{
      const activeTree=stop.kind==='tree'&&stop.id===state.pedestalNodeId;
      const visiting=state.movement?.transit?.stopId===stop.id;
      return <g key={stop.id} data-stop={stop.id} transform={`translate(${at(stop.x,stop.y)})`} role="img" aria-label={`${stop.name}: parada sem gasto de passo${activeTree?', banana disponível':''}`}>
        <title>{`${stop.name} · não gasta passo`}</title>
        {(activeTree||visiting)&&<ellipse rx="11" ry="8" fill="#ffdc6e" opacity=".35"/>}
        <ellipse cy="2" rx="7" ry="4.5" fill="#35291c" opacity=".35"/>
        <ellipse rx="6.5" ry="4" fill={activeTree?'#f9d66c':'#b9ad8f'} stroke="#e6d7b7" strokeWidth="1"/>
        {activeTree&&<text y="-1" fontSize="12" textAnchor="middle">🍌</text>}
        {visiting&&<text y="-16" fontSize="9" textAnchor="middle" fill="#fff5d3" stroke="#263329" strokeWidth="3" paintOrder="stroke">{stop.name}</text>}
      </g>;
    })}
    {state.map.stops?.filter(s=>s.id===state.pedestalNodeId).map(s=><g key={s.id} transform={`translate(${at(s.artX??s.x,s.artY??s.y)})`} pointerEvents="none"><ellipse rx="18" ry="15" fill="#ffcf45" opacity=".3"/><text textAnchor="middle" y="5" fontSize="25">🍌</text><text y="22" textAnchor="middle" fontSize="8" fill="#ffe69c" stroke="#283427" strokeWidth="3" paintOrder="stroke">20 moedas</text></g>)}
    {Object.values(state.map.nodes).map(node=>{
      const highlighted=highlightNodes.includes(node.id); const clickable=highlighted&&!!onNodeClick;
      return <g key={node.id} data-board-node={node.id} data-kind={node.kind} transform={`translate(${at(node.x,node.y)})`} role={clickable?'button':'img'} aria-label={`${labels[node.kind]??node.kind}, casa ${node.id}`} tabIndex={clickable?0:undefined} onClick={clickable?()=>onNodeClick(node.id):undefined} onKeyDown={e=>{if(clickable&&(e.key==='Enter'||e.key===' ')){e.preventDefault();onNodeClick(node.id)}}} style={{cursor:clickable?'pointer':'default'}}>
        <title>{labels[node.kind]}</title>
        {highlighted&&<ellipse rx="20" ry="15" stroke="#fff2a2" strokeWidth="3" fill="#ffe675" fillOpacity=".2" className="board-choice"/>}
        <ellipse cy="5" rx="14" ry="8.5" fill="#251b12" opacity=".38"/>
        <path d="M-13 0V3.7A13 8.5 0 0 0 13 3.7V0Z" fill="#90704b" stroke="#755b3e" strokeWidth=".6"/>
        <ellipse rx="13" ry="8.5" fill={`url(#${rim})`} stroke="#e9d8ae" strokeWidth=".7"/>
        <ellipse cy="-.5" rx="10.8" ry="6.8" fill={colors[node.kind]??'#756957'} stroke="#eee1bf" strokeWidth=".6"/>
        <ellipse cy="-.5" rx="10.8" ry="6.8" fill={`url(#${shine})`}/>
        <g transform="translate(0 -.5) scale(.8 .61)"><Symbol kind={node.kind}/></g>
        {node.kind==='start'&&<text x="-15" y="17" textAnchor="end" fontSize="8" fontWeight="800" fill="#ffe5a2" stroke="#293526" strokeWidth="3" paintOrder="stroke">INÍCIO +10</text>}
      </g>;
    })}
    {[...state.order].sort((a,b)=>Number(a===active)-Number(b===active)).map(id=>{
      const player=state.players[id], node=state.map.nodes[player.nodeId];
      const group=state.order.filter(p=>state.players[p].nodeId===player.nodeId);
      const peers=group.filter(p=>p!==active); const index=peers.indexOf(id);
      const crowded=group.length>3;const isActive=id===active;
      const stop=isActive?state.map.stops?.find(s=>s.id===state.movement?.transit?.stopId):undefined;
      const p=stop??node;
      const ox=stop||group.length===1||isActive?0:crowded?((index%5)-2)*29:((index+1)*28);
      const oy=stop||group.length===1||isActive?0:crowded?32+Math.floor(index/5)*30:8;
      const portrait=displayPortrait(player.portrait)!;
      const official=/assets\/characters\/(arthur|mari|milena)-v1\.png$/.exec(portrait)?.[1];
      const portraitX=official==='arthur'?-32:official?-29:-13;
      const playerMotion=motion?.playerId===id?motion:null;
      const point=(target:BoardMotionTarget)=>target.kind==='node'?state.map.nodes[target.id]:state.map.stops?.find(item=>item.id===target.id);
      const from=playerMotion?point(playerMotion.from):null,to=playerMotion?point(playerMotion.to):null;
      const dx=from&&to?(from.x-to.x)*1000:0,dy=from&&to?(from.y-to.y)*563:0;
      const between=playerMotion?.from.kind==='node'&&playerMotion.to.kind==='node'
        ? state.map.stops?.find(item=>(item.from===playerMotion.from.id&&item.to===playerMotion.to.id)||(item.to===playerMotion.from.id&&item.from===playerMotion.to.id))
        : undefined;
      const sx=between&&to?(between.x-to.x)*1000:0,sy=between&&to?(between.y-to.y)*563:0;
      const arc=playerMotion&&playerMotion.phase==='jump'&&playerMotion.animate&&from&&to&&Math.hypot(dx,dy)>0
        ? between
          ? `M ${dx} ${dy} Q ${(dx+sx)*.5} ${(dy+sy)*.5-18} ${sx} ${sy} Q ${sx*.5} ${sy*.5-18} 0 0`
          : `M ${dx} ${dy} Q ${dx*.5} ${dy*.5-24} 0 0`
        : null;
      const motionDuration=playerMotion?.jumpMs??0;
      return <g key={id} className="board-piece board-piece-presented" style={{transition:'none'}} data-motion-phase={playerMotion?.phase} transform={`translate(${p.x*1000+ox} ${p.y*563+oy-20}) scale(${crowded && !isActive ? .75 : 1})`}>
        <g key={playerMotion?.key??'still'}>
        {arc&&<animateMotion path={arc} dur={`${motionDuration}ms`} fill="freeze" calcMode="paced"/>}
        <ellipse cy="19" rx="12" ry="5" fill={isActive?'#ffdd6c':'#17271b'} opacity=".8"/>
        <circle r="15" fill={player.color} stroke={isActive?'#fff4c4':'#243a2a'} strokeWidth={isActive?3:2}/>
        <g clipPath={`url(#${clip})`}><image href={portrait} x={portraitX} y={official?-14:-13} width={official?58:26} height={official?87:26} preserveAspectRatio="xMidYMin slice"/></g>
        <text y="31" textAnchor="middle" fontSize="9" fontWeight="800" fill="#fff2d0" stroke="#243526" strokeWidth="3" paintOrder="stroke">{player.name}</text>
        </g>
      </g>;
    })}
    <g data-board-legend="true" transform="translate(280 548)"><rect x="-12" y="-12" width="440" height="23" rx="11" fill="#17362c" opacity=".92"/>{(['plus','minus','luck','unluck','duel'] as NodeKind[]).map((kind,i)=><g key={kind} transform={`translate(${i*85} 0)`}><circle r="7" fill={colors[kind]}/><g transform="scale(.65)"><Symbol kind={kind}/></g><text x="12" y="3" fill="#ffefd0" fontSize="9">{labels[kind]}</text></g>)}</g>
  </svg>;
}
