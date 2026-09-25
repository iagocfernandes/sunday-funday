import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { WebSocket } from 'ws';
const base = process.env.TEST_REMOTE_URL || 'http://localhost:5178';
const code = Array.from(randomBytes(6), x => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[x % 32]).join('');
const tokens = [randomBytes(32).toString('hex'), randomBytes(32).toString('hex'), randomBytes(32).toString('hex')];
async function call(token, body) {
  const res = await fetch(`${base}/api/room?room=${code}`, {method:body?'POST':'GET',headers:{Authorization:`Bearer ${token}`,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
  const result=await res.json();return {status:res.status,result};
}
const command=(type,extra={})=>({type:'command',code,commandId:randomUUID(),command:{type,...extra}});
assert.equal((await call(tokens[0],{type:'create',code})).status,200);
const one=await call(tokens[1],command('join',{name:'Teste Iago'}));assert.equal(one.status,200);
const two=await call(tokens[2],command('join',{name:'Teste Milena'}));assert.equal(two.status,200);
const started=await call(tokens[0],command('start'));assert.equal(started.status,200);
const turn=started.result.room.turn;
assert.equal((await call(tokens[2],command('roll',{turn}))).status,403);
const received=[];
const ws=new WebSocket(`${base.replace(/^http/,'ws')}/api/socket`);
await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(new Error('WebSocket handshake timeout')),12000);ws.on('open',()=>ws.send(JSON.stringify({room:code,token:tokens[0]})));ws.on('message',raw=>{const msg=JSON.parse(raw);if(msg.type==='state'){received.push(msg);clearTimeout(timeout);resolve();}});ws.on('error',reject);});
const action=command('roll',{turn});
const results=await Promise.all([call(tokens[1],action),call(tokens[1],action)]);
assert(results.every(r=>r.status===200));assert.equal(results[0].result.room.lastRoll.value,results[1].result.room.lastRoll.value);
assert.equal(results[0].result.room.rolls.length,1);
await new Promise(r=>setTimeout(r,3700));
const after=await call(tokens[1]);assert.equal(after.result.room.rolls.length,1);assert.equal(after.result.room.activePlayerId,two.result.playerId);
assert(received.some(r=>r.room.lastRoll?.id===action.commandId),'TV must receive roll via websocket');ws.close();
const reconnected=await call(tokens[1]);assert.equal(reconnected.result.room.lastRoll.id,action.commandId);
console.log(JSON.stringify({ok:true,code,checks:['create','join two players','host starts','wrong player rejected','websocket delivers TV update','duplicate request has one roll','automatic next player','reload preserves result'],dice:after.result.room.lastRoll.value}));
