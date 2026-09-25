// @vitest-environment jsdom
import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createGame } from '../game/engine';
import { BoardPhone } from './BoardRemote';
import type { RoomReply } from './types';

afterEach(cleanup);
function fixture():RoomReply {
 const game=createGame([{id:'a',name:'Iago',color:'#fff',symbol:'A',portrait:'/a.png'},{id:'b',name:'Milena',color:'#aaa',symbol:'B',portrait:'/b.png'}],{}, {seed:1,shuffleOrder:false});
 game.phase='readyToRoll';game.pending=null;
 return {role:'player',playerId:'a',serverNow:100,room:{code:'TESTE',revision:1,mode:'board',phase:'playing',players:[],activePlayerId:'a',turn:1,round:1,rounds:10,diceMax:10,lastRoll:null,rolls:[],advanceAt:null,expiresAt:99999,board:{matchId:'m',game,paused:false,itemDeadline:null,pausedItemMs:null,events:[],presentation:{id:'cue',clip:'opening',durationMs:1000,expiresAt:1100,playerIds:[]}}}};
}
describe('celular durante fala gravada',()=>{
 it('bloqueia dado até servidor concluir a apresentação',()=>{
  const reply=fixture();const act=vi.fn();const view=render(<BoardPhone reply={reply} act={act} busy={false} online/>);
  expect(screen.getByText('AR2 está falando')).toBeTruthy();
  expect((screen.getByRole('button',{name:'Aguarde'}) as HTMLButtonElement).disabled).toBe(true);
  reply.room.board!.presentation=null;
  view.rerender(<BoardPhone reply={reply} act={act} busy={false} online/>);
  expect((screen.getByRole('button',{name:'Jogar dado'}) as HTMLButtonElement).disabled).toBe(false);
 });
 it('esconde decisões enquanto a TV apresenta o evento',()=>{
  const reply=fixture();reply.room.board!.game.pending={kind:'shop',playerId:'a',nodeId:'m0',items:['dadoDuplo']};
  render(<BoardPhone reply={reply} act={vi.fn()} busy={false} online/>);
  expect(screen.getByText('AR2 está falando')).toBeTruthy();
  expect(screen.queryByText('Dado Duplo')).toBeNull();
 });
});
