// Integração do modo tabuleiro contra a API real (banco real). Sala de QA isolada, com expiração.
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { WebSocket } from 'ws';
const base = process.env.TEST_REMOTE_URL || 'http://localhost:5173';
const code = Array.from(randomBytes(6), x => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[x % 32]).join('');
const [host, t1, t2] = [0, 1, 2].map(() => randomBytes(32).toString('hex'));
const CODES = { luck: 'S01', unluck: 'A01' };
async function call(token, body) {
  const res = await fetch(`${base}/api/room?room=${code}`, { method: body ? 'POST' : 'GET', headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, result: await res.json() };
}
const cmd = (command, commandId = randomUUID()) => ({ type: 'command', code, commandId, command });
const ok = async (token, body) => { const r = await call(token, body); assert.equal(r.status, 200, JSON.stringify(r.result)); return r.result; };
const game = r => r.room.board.game;
const hostGame = (r, command) => ok(host, cmd({ type: 'game', matchId: r.room.board.matchId, revision: game(r).revision, command }));
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function waitStable() {
  for (let i = 0; i < 60; i++) {
    const r = await ok(host); const g = game(r);
    if (g.phase !== 'itemWindow' && (g.pending || ['readyToRoll', 'roundReady', 'minigameIntro', 'awaitingResults', 'awaitingPath', 'awaitingItemChoice'].includes(g.phase))) return r;
    await sleep(1000);
  }
  throw new Error('board did not settle');
}
const checks = [];
await ok(host, { type: 'create', code, mode: 'board' });
const one = await ok(t1, cmd({ type: 'join', name: 'QA Iago' }));
const two = await ok(t2, cmd({ type: 'join', name: 'QA Emiliano' }));
const tokenOf = id => (id === one.playerId ? t1 : t2);
let r = await ok(host, cmd({ type: 'start' }));
assert.equal(game(r).map.id, 'ilha-dos-gorilas-v5'); assert.equal(Object.keys(game(r).map.nodes).length, 48); checks.push('new room uses 48 spaces'); assert.equal(game(r).catalogVersion,2); assert(game(r).config.shopItems.includes('blindado')); checks.push('Milena catalog and powers active');
assert.equal(r.room.mode, 'board'); checks.push('create board room, two joins, host starts');
assert(!JSON.stringify(r).match(/rngSeed|rngCursor|hostHash|credentials|accepted/)); checks.push('no private fields in reply');
r = await hostGame(r, { type: 'startRound' });
const ws = new WebSocket(`${base.replace(/^http/, 'ws')}/api/socket`);
const tvUpdates = [];
await new Promise((resolve, reject) => { const t = setTimeout(() => reject(new Error('ws timeout')), 12000); ws.on('open', () => ws.send(JSON.stringify({ room: code, token: host }))); ws.on('message', raw => { const m = JSON.parse(raw); if (m.type === 'state') { tvUpdates.push(m); clearTimeout(t); resolve(); } }); ws.on('error', reject); });
r = await waitStable();
assert.equal(game(r).phase, 'readyToRoll'); checks.push('automation stops at the dice');
const activeId = game(r).order[game(r).activeIndex];
const otherToken = activeId === one.playerId ? t2 : t1;
const roll = { type: 'roll', turn: r.room.turn, matchId: r.room.board.matchId };
assert.equal((await call(otherToken, cmd(roll))).status, 403); checks.push('other player direct request rejected');
assert.equal((await call(tokenOf(activeId), cmd({ type: 'game', matchId: r.room.board.matchId, revision: game(r).revision, command: { type: 'rollDice' } }))).status, 403); checks.push('generic player rollDice command rejected');
const same = cmd(roll);
const results = await Promise.all([call(tokenOf(activeId), same), call(tokenOf(activeId), same), call(tokenOf(activeId), cmd(roll))]);
assert(results.filter(x => x.status === 200).length >= 2, JSON.stringify(results.map(x=>({status:x.status,error:x.result.error}))));
await sleep(1500);
r = await ok(host);
const diceEvents = r.room.board.events.filter(e => e.event.type === 'diceRolled');
assert.equal(diceEvents.length, 1); checks.push('duplicate + concurrent clicks: one dice');
assert(tvUpdates.some(u => u.room.board?.events.some(e => e.event.type === 'diceRolled')), 'TV must receive dice via websocket'); checks.push('websocket delivers dice to TV');
const phone = await ok(tokenOf(activeId));
assert.equal(phone.room.board.events.filter(e => e.event.type === 'diceRolled')[0].seq, diceEvents[0].seq); checks.push('phone reload sees same dice');
// Completa a rodada: decisões e dados pelos jogadores; resultado presencial pelo anfitrião.
for (let guard = 0; guard < 80; guard++) {
  r = await waitStable(); const g = game(r);
  if (['minigameIntro','awaitingResults'].includes(g.phase)) break;
  const p = g.pending;
  if(p?.kind==='cardPreview'||p?.kind==='harvest'){await sleep(1000);continue;}
  if (p) {
    const c = p.kind === 'discardPower'?{type:'discardPower',uid:g.players[p.playerId].inventory[0].uid}:p.kind === 'iagugu' ? {type:'skipIagugu'} : p.kind === 'duelBet' ? {type:'setDuelBet',amount:Math.min(1,p.maxBet)} : p.kind === 'duelResult' ? {type:'resolveDuel',winnerId:null} : p.kind === 'path' ? { type: 'choosePath', nodeId: p.options[0] } : p.kind === 'shop' ? { type: 'skipShop' } : p.kind === 'pedestal' ? { type: 'buyGolden' }
      : p.kind === 'cardCode' ? { type: 'submitCardCode', code: CODES[p.category] } : p.kind === 'cardPreview' ? { type: 'confirmCard' } : p.kind === 'target' ? { type: 'chooseTarget', targetId: p.candidates[0] }
      : p.kind === 'harvest' ? { type: 'continueHarvest' } : p.kind === 'chooseDice' ? { type: 'chooseDice', value: 5 } : p.kind === 'stealItem' ? { type: 'stealItem', targetId: p.candidates[0] }
      : p.kind === 'defense' ? { type: 'resolveDefense', choice: 'none' } : { type: 'cancelItemChoice' };
    await ok(p.kind==='duelResult'?host:tokenOf(p.kind==='defense'?p.targetId:p.playerId),cmd({type:'game',matchId:r.room.board.matchId,revision:g.revision,command:c}));
  } else if (g.phase === 'readyToRoll') await ok(tokenOf(g.order[g.activeIndex]), cmd({ type: 'roll', turn: r.room.turn, matchId: r.room.board.matchId }));
}
assert(['minigameIntro','awaitingResults'].includes(game(r).phase)); checks.push('full round of turns reaches the minigame');
if(game(r).phase==='minigameIntro') r = await hostGame(r, { type: 'startMinigame' });
const g = game(r);
const submit = g.minigame.teams.length ? { type: 'submitResults', resultId: 'qa-1', format: 'teams', winningTeam: 0 } : { type: 'submitResults', resultId: 'qa-1', format: 'individual', ranking: [[g.order[0]], [g.order[1]]] };
r = await hostGame(r, submit);
assert.equal(game(r).phase, 'roundEnd');
assert.equal((await call(host, cmd({ type: 'game', matchId: r.room.board.matchId, revision: game(r).revision, command: submit }))).status, 409); checks.push('result applied once');
r = await hostGame(r, { type: 'nextRound' });
assert.equal(game(r).phase, 'roundReady'); assert.equal(r.room.round, 2); checks.push('next round can start');
ws.close();
console.log(JSON.stringify({ ok: true, base, code, checks }));
