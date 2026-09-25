import {describe,it,expect} from 'vitest';
import {createDefaultMap,createV4Map,validateMap} from '../data/map';
import {createGame,applyCommand} from './engine';
import {validateGameState} from '../persistence/validate';
import type {Command} from './types';
const seeds=['p0','p1'].map(id=>({id,name:id,color:'#abc',symbol:'X',portrait:'/x.png'}));
describe('48 casas sem mudar a ilha',()=>{
 it('aumenta a volta para 36–37 passos e preserva duas escolhas de rota',()=>{
  const m=createDefaultMap();expect(validateMap(m).ok).toBe(true);expect(Object.keys(m.nodes)).toHaveLength(48);
  expect(Object.values(m.nodes).filter(n=>n.next.length>1)).toHaveLength(2);
  const lengths=(id:string,n=0):number[]=>id===m.startNodeId&&n?[n]:m.nodes[id].next.flatMap(to=>lengths(to,n+1));
  expect(lengths(m.startNodeId).sort()).toEqual([36,36,37,37]);
  const counts=Object.values(m.nodes).reduce((a,n)=>(a[n.kind]=(a[n.kind]??0)+1,a),{} as Record<string,number>);
  expect(counts).toEqual({start:1,plus:14,minus:10,luck:10,unluck:10,duel:3});
 });
 it('visita e retoma todas as sete paradas nas novas arestas sem gastar passo extra',()=>{
  const map=createDefaultMap();for(const stop of map.stops!){
   let s=createGame(seeds,{}, {map,seed:12,shuffleOrder:false});s.players.p0.nodeId=stop.from;s.players.p0.common=100;s.phase='moving';s.movement={remaining:2,direction:'forward',activatesSpaces:true,traversed:[]};if(stop.kind==='tree')s.pedestalNodeId=stop.id;
   const run=(command:Command)=>{const r=applyCommand(s,{commandId:'t',expectedRevision:s.revision,command});expect(r.rejected).toBeUndefined();s=r.state;expect(validateGameState(s).ok).toBe(true);};
   run({type:'step'});expect(s.movement?.remaining).toBe(2);expect(s.movement?.transit?.stopId).toBe(stop.id);
   run({type:stop.kind==='tree'?'skipPedestal':stop.kind==='shop'?'skipShop':'skipIagugu'});
   run({type:'step'});expect(s.players.p0.nodeId).toBe(stop.to);expect(s.movement?.remaining).toBe(1);
  }
 });
 it('não reinterpreta uma partida antiga de 36 casas',()=>{const old=createGame(seeds,{}, {map:createV4Map(),shuffleOrder:false});const r=applyCommand(old,{commandId:'old',expectedRevision:old.revision,command:{type:'startRound'}});expect(r.state.map.id).toBe('ilha-dos-gorilas-v4');expect(Object.keys(r.state.map.nodes)).toHaveLength(36);});
});
