// Run: bundle with esbuild for Node, then execute the bundle.
// Offline planning simulation; does not modify the application catalog or saves.
import { createGame, applyCommand, nextAutoCommand, activePlayer, usableActiveItems } from '../src/game/engine';
import { CARDS, CARDS_BY_ID } from '../src/data/cards';
import { MINIGAMES } from '../src/data/config';
import type { CardDef, Command } from '../src/game/types';

const original = structuredClone(CARDS);
const proposed: CardDef[] = [
  ...original.filter(c => ['S01', 'S02', 'S03', 'A01', 'A02'].includes(c.id)),
  ...[
    ['S04', 'luck', 'gainCommon', 3], ['S05', 'luck', 'gainCommon', 8],
    ['S06', 'luck', 'grantItem', 0], ['A04', 'unluck', 'loseCommon', 2],
    ['A05', 'unluck', 'loseCommon', 5], ['A06', 'unluck', 'moveBack', 2],
    ['A07', 'unluck', 'moveBack', 5],
  ].map(([id, category, effectType, amount]) => ({
    ...original[0], id, code: id, category, effectType, amount,
    ...(id === 'S06' ? { grantsItem: 'dadoDuplo' } : {}),
  } as CardDef)),
];

function simulate(count: number, seed: number, policy: string, catalog: CardDef[], rounds = 8) {
  let randomState = seed ^ 0xabcdef;
  const random = () => { randomState = (Math.imul(1664525, randomState) + 1013904223) >>> 0; return randomState / 4294967296; };
  const pick = <T,>(a: T[]) => a[Math.floor(random() * a.length)];
  const shuffle = <T,>(a: T[]) => { const b = [...a]; for(let i=b.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[b[i],b[j]]=[b[j],b[i]];} return b; };
  const piles: Record<string, string[]> = { luck: [], unluck: [] };
  function draw(category: string) {
    if (!piles[category].length) piles[category] = shuffle(catalog.filter(c => c.category === category).flatMap(c => [c.code,c.code]));
    return piles[category].pop()!;
  }
  let state = createGame(Array.from({length:count},(_,i)=>({id:`p${i}`,name:`P${i}`,color:'#fff',symbol:'o',portrait:''})), {rounds}, {seed,shuffleOrder:false});
  const byRound: number[] = [];
  function distance(from: string, to: string) {
    const q: [string,number][] = [[from,0]], seen = new Set<string>();
    while(q.length){const [id,d]=q.shift()!;if(id===to)return d;if(seen.has(id))continue;seen.add(id);for(const next of state.map.nodes[id].next)q.push([next,d+1]);}
    return Infinity;
  }
  for(let steps=0; steps<10000;steps++){
    if(state.phase==='finished')return {total:Object.values(state.players).reduce((a,p)=>a+p.golden,0),maxPlayer:Math.max(...Object.values(state.players).map(p=>p.golden)),byRound};
    let cmd: Command | null = null;
    const p = state.pending;
    if(p){
      switch(p.kind){
        case 'path': cmd={type:'choosePath',nodeId:policy==='save-seek'?[...p.options].sort((a,b)=>distance(a,state.pedestalNodeId)-distance(b,state.pedestalNodeId))[0]:pick(p.options)};break;
        case 'shop':cmd=policy==='shop-random'?{type:'buyItem',itemId:pick(p.items)}:{type:'skipShop'};break;
        case 'pedestal':cmd={type:'buyGolden'};break;
        case 'cardCode':cmd={type:'submitCardCode',code:draw(p.category)};break;
        case 'cardPreview':cmd={type:'confirmCard'};break;
        case 'target':cmd={type:'chooseTarget',targetId:pick(p.candidates)};break;
        case 'defense': { const option=pick(p.options);cmd=option?{type:'resolveDefense',choice:option.itemId==='escudo'?'block':'reverse',uid:option.uid}:{type:'resolveDefense',choice:'none'};break; }
        case 'itemChoice': {const item=usableActiveItems(state,activePlayer(state)!)[0];cmd=item?{type:'useItem',uid:item.uid}:{type:'cancelItemChoice'};break;}
      }
    }else if(state.phase==='itemWindow')cmd={type:'requestItemChoice'};
    else if(state.phase==='roundReady')cmd={type:'startRound'};
    else if(state.phase==='minigameIntro')cmd={type:'startMinigame'};
    else if(state.phase==='awaitingResults'){
      const game=MINIGAMES.find(g=>g.id===state.minigame!.minigameId)!;
      cmd=game.format==='teams'?{type:'submitResults',resultId:`r${state.round}`,format:'teams',winningTeam:Math.floor(random()*2)}:{type:'submitResults',resultId:`r${state.round}`,format:'individual',ranking:shuffle(state.order).map(id=>[id])};
    }else if(state.phase==='roundEnd'){
      byRound.push(Object.values(state.players).reduce((a,p)=>a+p.golden,0));cmd={type:'nextRound'};
    }else cmd=nextAutoCommand(state);
    if(!cmd)throw new Error(`Stuck ${state.phase}`);
    const result=applyCommand(state,{command:cmd,commandId:`s${state.revision}`,expectedRevision:state.revision});
    if(result.rejected)throw new Error(`${cmd.type}: ${result.rejected}`);
    state=result.state;
    // History does not drive rules. Omit logs to make thousands of clones cheaper.
    state.history=[];
  }
  throw new Error('Step limit');
}

const results=[];
for(const [name,catalog] of [['current',original],['proposed',proposed]] as const){
  CARDS.splice(0,CARDS.length,...catalog);
  for(const key of Object.keys(CARDS_BY_ID))delete CARDS_BY_ID[key];
  for(const c of catalog)CARDS_BY_ID[c.id]=c;
  for(const policy of ['shop-random','save-seek'])for(const count of [8,9,10]){
    const runs=Array.from({length:100},(_,i)=>simulate(count,10001+i*7919,policy,catalog));
    const sorted=runs.map(r=>r.total).sort((a,b)=>a-b);
    const mean=sorted.reduce((a,b)=>a+b,0)/runs.length;
    results.push({catalog:name,policy,players:count,runs:runs.length,meanTotal:mean,meanPerPlayer:mean/count,p95Total:sorted[94],minTotal:sorted[0],maxTotal:sorted.at(-1),maxIndividual:Math.max(...runs.map(r=>r.maxPlayer)),roundMeans:Array.from({length:8},(_,i)=>runs.reduce((a,r)=>a+r.byRound[i],0)/runs.length)});
  }
}
console.log(JSON.stringify({assumptions:{rounds:8,goldenPrice:20,startingCoins:10,dice:'1–10',shopStock:'unlimited, current engine',minigames:'default sequence, random winners, no ties',cards:'two copies each, reshuffled when exhausted',policies:{'shop-random':'random paths; buy an affordable item at every shop','save-seek':'skip shops; choose shortest path to current pedestal'},seeds:'10001 + i * 7919, i=0..99',note:'Modeled behavior, not measured human play. Proposed catalog only changed in simulation memory.'},results},null,2));
