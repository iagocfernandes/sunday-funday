import {describe,it,expect} from 'vitest';
import {startBoard,advanceBoard,applyToBoard,pauseBoard,resumeBoard} from './board';
import {CARD_REVEAL_MS} from '../src/data/cards';
import {validPortrait} from './portrait';
describe('eventos automáticos no servidor',()=>{
 it('aguarda leitura, pausa congela, aplica uma vez sem clique e para numa escolha real',()=>{
  const b=startBoard([{id:'p0',name:'Iago'},{id:'p1',name:'Milena'}],12,'m',0,1000);b.game.activeIndex=b.game.order.indexOf('p0');
  b.game.phase='resolvingSpace';b.game.players.p0.nodeId=Object.values(b.game.map.nodes).find(n=>n.kind==='unluck')!.id;b.game.cardDecks={unluck:['MA07']};b.game.players.p0.golden=2;
  expect(applyToBoard(b,{type:'resolveSpace'},1000,false)).toBeNull();advanceBoard(b,1000+CARD_REVEAL_MS-1);expect(b.game.players.p0.golden).toBe(2);
  pauseBoard(b,2000);advanceBoard(b,30000);expect(b.game.players.p0.golden).toBe(2);resumeBoard(b,30000);advanceBoard(b,30000+CARD_REVEAL_MS);expect(b.game.players.p0.golden).toBe(1);advanceBoard(b,30000+CARD_REVEAL_MS);expect(b.game.players.p0.golden).toBe(1);
 });
 it('migra catálogo de sala antiga sem modificar mapa nem inventários',()=>{const b=startBoard([{id:'p0',name:'Iago'},{id:'p1',name:'Milena'}],12,'m',0,1000);delete b.game.catalogVersion;b.presentation=null;b.game.phase='readyToRoll';b.game.config.shopItems=['bananaTurbo'];b.game.players.p0.inventory=[{uid:'legacy',itemId:'bananaTurbo'}];const map=JSON.stringify(b.game.map);advanceBoard(b,1000);expect(b.game.config.shopItems).toContain('blindado');expect(b.game.players.p0.inventory[0].itemId).toBe('bananaTurbo');expect(JSON.stringify(b.game.map)).toBe(map);});
 it('rejeita URL externa, SVG, imagem inválida e dados excessivos',()=>{for(const value of ['https://example.com/p.jpg','data:image/svg+xml;base64,abcd','data:image/jpeg;base64,YWJj','a'.repeat(15000)])expect(validPortrait(value)).toBe(false);});
});
