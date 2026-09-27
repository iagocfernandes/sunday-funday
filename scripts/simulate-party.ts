/**
 * Distribuição de bananas numa festa de 10 jogadores e 10 rodadas.
 * Usa o motor e os preços atuais. Não altera regra nenhuma.
 *
 * npx tsx scripts/simulate-party.ts
 * PARTY_GAMES=10000 (padrão)
 *
 * Política, igual para todos:
 * - na bifurcação, o caminho mais curto até a banana; em 25% dos casos,
 *   o segundo caminho se ele não alongar mais que 4 passos;
 * - compra a banana sempre que o pedestal oferece;
 * - na loja, compra um poder que ajude a corrida só se não quebrar
 *   a reserva da primeira banana (abaixo de 20 moedas e ainda sem fruto,
 *   só entra seguro de até 4 moedas sobrando pelo menos 8);
 * - Iagugu: rouba banana de quem está à frente ou empatado, se tiver 50;
 *   senão leva até 10 moedas de quem tem mais;
 * - usa o poder se a banana está a mais de 3 passos, troca se está
 *   4 ou mais atrás, muda a banana se um rival à frente está mais perto;
 * - duelo aposta no máximo 5, vencedor 50/50;
 * - prova individual: ordem aleatória, sem empate (1º +20, 2º +6);
 * - prova em equipe: 80% um lado vence, 20% empate.
 */
import { createGame, applyCommand, nextAutoCommand, activePlayer, ranking, winnersOf } from '../src/game/engine';
import { IAGUGU_GOLDEN_PRICE, ITEMS } from '../src/data/config';
import type { Command, GameState, ItemId } from '../src/game/types';

const GAMES = Number(process.env.PARTY_GAMES ?? 10_000);
const OFFSET = Number(process.env.PARTY_OFFSET ?? 0);
const PLAYERS = 10;
const ROUNDS = 10;

function makeRng(seed: number) {
  let x = seed >>> 0;
  return () => {
    x = (Math.imul(1664525, x) + 1013904223) >>> 0;
    return x / 4294967296;
  };
}

function distToStop(state: GameState, from: string, stopId: string): number {
  const stop = state.map.stops?.find((s) => s.id === stopId);
  if (!stop) return 99;
  const seen = new Set<string>();
  const queue: Array<[string, number]> = [[from, 0]];
  while (queue.length) {
    const [id, d] = queue.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);
    const node = state.map.nodes[id];
    if (!node) continue;
    for (const next of node.next) {
      if (id === stop.from && next === stop.to) return d + 1;
      queue.push([next, d + 1]);
    }
  }
  return 99;
}

function bananaDist(state: GameState, from: string) {
  return distToStop(state, from, state.pedestalNodeId);
}

function apply(state: GameState, command: Command) {
  return applyCommand(state, { command, commandId: `s${state.revision}`, expectedRevision: state.revision });
}

function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.round(p * (sorted.length - 1))));
  return sorted[index];
}

interface GameStats {
  profile: string;
  zeros: number;
  ones: number;
  twos: number;
  threePlus: number;
  total: number;
  winnerBananas: number;
  winnerCoins: number;
  fullTie: number;
  bananaTieBrokenByCoins: number;
  maxBanana: number;
  meanCoins: number;
  buys: Record<string, number>;
  tree: number;
  iagugu: number;
  cardSteals: number;
  destroyed: number;
  board: Array<{ name: string; golden: number; common: number }>;
}

function chooseShop(state: GameState, actorId: string, items: ItemId[]): ItemId | null {
  const actor = state.players[actorId];
  if (actor.inventory.length >= state.config.inventoryLimit) return null;
  const dist = bananaDist(state, actor.nodeId);
  const rivals = state.order.filter((id) => id !== actor.id).map((id) => ({
    dist: bananaDist(state, state.players[id].nodeId),
    golden: state.players[id].golden,
  }));
  const nearest = Math.min(...rivals.map((r) => r.dist));
  const rivalAheadCloser = rivals.some((r) => r.dist + 1 < dist && r.golden >= actor.golden);
  const owned = new Set(actor.inventory.map((item) => item.itemId));
  const ranked: ItemId[] = [];
  if (dist > 3 && !owned.has('dadoCerteiro')) ranked.push('dadoCerteiro');
  if (dist > 5 && !owned.has('dadoDuplo')) ranked.push('dadoDuplo');
  if (dist > nearest + 3 && !owned.has('trocaTroca')) ranked.push('trocaTroca');
  if (rivalAheadCloser && !owned.has('mudaBanana')) ranked.push('mudaBanana');
  if (nearest + 1 < dist && !owned.has('preguicao')) ranked.push('preguicao');
  if ((actor.golden > 0 || actor.common >= 20 + ITEMS.blindado.price) && !owned.has('blindado')) ranked.push('blindado');

  for (const id of ranked) {
    if (!items.includes(id)) continue;
    const price = ITEMS[id].price;
    const left = actor.common - price;
    const savingForFirst = actor.golden === 0 && left < 20;
    if (savingForFirst && price > 4) continue;
    if (savingForFirst && left < 8) continue;
    return id;
  }
  return null;
}

function play(seed: number): GameStats {
  const random = makeRng(seed ^ 0x9e3779b9);
  const shuffle = <T,>(list: T[]) => {
    const out = list.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  };
  let state = createGame(
    Array.from({ length: PLAYERS }, (_, i) => ({
      id: `p${i}`, name: `P${i + 1}`, color: '#fff', symbol: 'o', portrait: '/x.png',
    })),
    { rounds: ROUNDS },
    { seed, shuffleOrder: true },
  );
  const buys: Record<string, number> = {};
  let tree = 0;
  let iagugu = 0;
  let cardSteals = 0;
  let destroyed = 0;
  const goldenOf = () => state.order.map((id) => state.players[id].golden);
  const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

  for (let step = 0; step < 30000 && state.phase !== 'finished'; step++) {
    let command: Command | null = null;
    const pending = state.pending;
    const actor = activePlayer(state);
    if (pending && actor) {
      switch (pending.kind) {
        case 'path': {
          const ranked = [...pending.options].sort((a, b) => bananaDist(state, a) - bananaDist(state, b) || a.localeCompare(b));
          const scenic = ranked.length > 1 && bananaDist(state, ranked[1]!) <= bananaDist(state, ranked[0]!) + 4 && random() < 0.25;
          command = { type: 'choosePath', nodeId: scenic ? ranked[1]! : ranked[0]! };
          break;
        }
        case 'shop': {
          const itemId = chooseShop(state, actor.id, pending.items);
          if (itemId) {
            buys[itemId] = (buys[itemId] ?? 0) + 1;
            command = { type: 'buyItem', itemId };
          } else command = { type: 'skipShop' };
          break;
        }
        case 'pedestal':
          command = { type: 'buyGolden' };
          break;
        case 'cardPreview':
          command = { type: 'confirmCard' };
          break;
        case 'itemChoice': {
          const items = actor.inventory.filter((it) => ITEMS[it.itemId].usage === 'active');
          const mine = bananaDist(state, actor.nodeId);
          const rivals = state.order.filter((id) => id !== actor.id).map((id) => ({
            dist: bananaDist(state, state.players[id].nodeId),
            golden: state.players[id].golden,
          }));
          const nearest = [...rivals].sort((a, b) => a.dist - b.dist || b.golden - a.golden)[0];
          const chosen = items.find((it) => {
            if (it.itemId === 'dadoDuplo' || it.itemId === 'dadoCerteiro' || it.itemId === 'bananaTurbo') return mine > 3;
            if (it.itemId === 'preguicao') return nearest ? nearest.dist + 1 < mine : false;
            if (it.itemId === 'trocaTroca') return nearest ? mine > nearest.dist + 3 : false;
            if (it.itemId === 'mudaBanana') return nearest ? nearest.dist + 1 < mine && nearest.golden >= actor.golden : false;
            return false;
          });
          command = chosen ? { type: 'useItem', uid: chosen.uid } : { type: 'cancelItemChoice' };
          break;
        }
        case 'chooseDice':
          command = { type: 'chooseDice', value: state.config.diceMax };
          break;
        case 'stealItem': {
          const best = [...pending.candidates].sort((a, b) => state.players[b].golden - state.players[a].golden)[0]!;
          command = { type: 'stealItem', targetId: best };
          break;
        }
        case 'target': {
          const best = [...pending.candidates].sort((a, b) => {
            const pa = state.players[a];
            const pb = state.players[b];
            return pb.golden - pa.golden || bananaDist(state, pa.nodeId) - bananaDist(state, pb.nodeId) || pb.common - pa.common;
          })[0]!;
          command = { type: 'chooseTarget', targetId: best };
          break;
        }
        case 'defense': {
          const block = pending.options.find((o) => o.itemId === 'escudo') ?? pending.options.find((o) => o.itemId === 'reverse');
          command = block
            ? { type: 'resolveDefense', choice: block.itemId === 'escudo' ? 'block' : 'reverse', uid: block.uid }
            : { type: 'resolveDefense', choice: 'none' };
          break;
        }
        case 'iagugu': {
          const victims = state.order.filter((id) => id !== actor.id);
          const mark = victims
            .filter((id) => state.players[id].golden > 0 && state.players[id].golden >= actor.golden)
            .sort((a, b) => state.players[b].golden - state.players[a].golden || state.players[b].common - state.players[a].common);
          const rich = victims.filter((id) => state.players[id].common > 0).sort((a, b) => state.players[b].common - state.players[a].common);
          if (mark.length && actor.common >= IAGUGU_GOLDEN_PRICE) command = { type: 'rob', targetId: mark[0]!, currency: 'golden' };
          else if (rich.length) command = { type: 'rob', targetId: rich[0]!, currency: 'common' };
          else command = { type: 'skipIagugu' };
          break;
        }
        case 'duelBet':
          command = { type: 'setDuelBet', amount: pending.maxBet > 0 ? Math.min(5, pending.maxBet) : 0 };
          break;
        case 'duelResult':
          command = { type: 'resolveDuel', winnerId: random() < 0.5 ? pending.playerId : pending.opponentId };
          break;
        case 'discardPower': {
          const hand = [...state.players[pending.playerId].inventory].sort((a, b) => ITEMS[a.itemId].price - ITEMS[b.itemId].price);
          command = { type: 'discardPower', uid: hand[0]!.uid };
          break;
        }
        case 'harvest':
          command = { type: 'continueHarvest' };
          break;
        default:
          command = null;
      }
    }
    if (!command) {
      if (state.phase === 'roundReady') command = { type: 'startRound' };
      else if (state.phase === 'minigameIntro') command = { type: 'startMinigame' };
      else if (state.phase === 'awaitingResults') {
        const teams = state.minigame?.teams ?? [];
        if (teams.length) {
          const draw = random() < 0.2;
          const winningTeam = draw ? -1 : random() < 0.5 ? 0 : 1;
          command = { type: 'submitResults', resultId: `r${state.round}`, format: 'teams', winningTeam };
        } else {
          command = {
            type: 'submitResults',
            resultId: `r${state.round}`,
            format: 'individual',
            ranking: shuffle(state.order).map((id) => [id]),
          };
        }
      } else if (state.phase === 'roundEnd') command = { type: 'nextRound' };
      else command = nextAutoCommand(state);
    }
    if (!command) throw new Error(`parado em ${state.phase} ${state.pending?.kind ?? ''}`);
    const before = goldenOf();
    const beforeSum = sum(before);
    let result = apply(state, command);
    if (result.rejected) {
      if (command.type === 'buyItem' && state.pending?.kind === 'shop') command = { type: 'skipShop' };
      else if (command.type === 'useItem' && state.pending?.kind === 'itemChoice') command = { type: 'cancelItemChoice' };
      else throw new Error(`${command.type}: ${result.rejected}`);
      result = apply(state, command);
      if (result.rejected) throw new Error(`${command.type}: ${result.rejected}`);
    }
    state = result.state;
    state.history = [];
    const after = goldenOf();
    const afterSum = sum(after);
    if (command.type === 'buyGolden') tree += afterSum - beforeSum;
    else if (afterSum < beforeSum) destroyed += beforeSum - afterSum;
    else if (command.type === 'rob' && command.currency === 'golden') {
      const gained = after.some((value, index) => value > before[index]);
      if (gained) iagugu += 1;
    } else if (command.type === 'chooseTarget') {
      const gained = after.some((value, index) => value > before[index]);
      if (gained && afterSum === beforeSum) cardSteals += 1;
    }
  }
  if (state.phase !== 'finished') throw new Error('limite de passos');

  const counts = [0, 0, 0, 0];
  for (const id of state.order) {
    const golden = state.players[id].golden;
    if (golden <= 0) counts[0] += 1;
    else if (golden === 1) counts[1] += 1;
    else if (golden === 2) counts[2] += 1;
    else counts[3] += 1;
  }
  const board = ranking(state).map((p) => ({ name: p.name, golden: p.golden, common: p.common }));
  const topGolden = board[0]?.golden ?? 0;
  const leaders = board.filter((p) => p.golden === topGolden);
  const winners = winnersOf(state);
  const coins = board.reduce((total, p) => total + p.common, 0) / board.length;
  return {
    profile: `${counts[0]} com 0, ${counts[1]} com 1, ${counts[2]} com 2, ${counts[3]} com 3+`,
    zeros: counts[0],
    ones: counts[1],
    twos: counts[2],
    threePlus: counts[3],
    total: board.reduce((total, p) => total + p.golden, 0),
    winnerBananas: topGolden,
    winnerCoins: board[0]?.common ?? 0,
    fullTie: winners.length > 1 ? 1 : 0,
    bananaTieBrokenByCoins: leaders.length > 1 && winners.length === 1 ? 1 : 0,
    maxBanana: topGolden,
    meanCoins: coins,
    buys,
    tree,
    iagugu,
    cardSteals,
    destroyed,
    board,
  };
}

const profiles = new Map<string, number>();
const zeroHist = new Map<number, number>();
const totalHist = new Map<number, number>();
const winnerBananaHist = new Map<number, number>();
const winnerCoinHist = new Map<number, number>();
let fullTies = 0;
let coinBreaks = 0;
let nobodyPastOne = 0;
let zeroSum = 0;
let coinSum = 0;
let treeSum = 0;
let iaguguSum = 0;
let cardSum = 0;
let destroyedSum = 0;
const buySum: Record<string, number> = {};
const sampleByProfile = new Map<string, GameStats>();
const started = Date.now();

for (let n = 0; n < GAMES; n++) {
  const i = OFFSET + n;
  const game = play(10001 + i * 7919);
  profiles.set(game.profile, (profiles.get(game.profile) ?? 0) + 1);
  zeroHist.set(game.zeros, (zeroHist.get(game.zeros) ?? 0) + 1);
  totalHist.set(game.total, (totalHist.get(game.total) ?? 0) + 1);
  winnerBananaHist.set(game.winnerBananas, (winnerBananaHist.get(game.winnerBananas) ?? 0) + 1);
  winnerCoinHist.set(game.winnerCoins, (winnerCoinHist.get(game.winnerCoins) ?? 0) + 1);
  fullTies += game.fullTie;
  coinBreaks += game.bananaTieBrokenByCoins;
  if (game.maxBanana <= 1) nobodyPastOne += 1;
  zeroSum += game.zeros;
  coinSum += game.meanCoins;
  treeSum += game.tree;
  iaguguSum += game.iagugu;
  cardSum += game.cardSteals;
  destroyedSum += game.destroyed;
  for (const [id, count] of Object.entries(game.buys)) buySum[id] = (buySum[id] ?? 0) + count;
  if (!sampleByProfile.has(game.profile)) sampleByProfile.set(game.profile, game);
  if ((i + 1) % 500 === 0) {
    const top = [...profiles.entries()].sort((a, b) => b[1] - a[1])[0];
    console.error(`progress ${n + 1}/${GAMES} offset ${OFFSET} ${((Date.now() - started) / 1000).toFixed(0)}s líder ${top?.[0]} ${top ? ((100 * top[1]) / (n + 1)).toFixed(1) : 0}%`);
  }
}

function fromHist(hist: Map<number, number>): number[] {
  const values: number[] = [];
  for (const [value, count] of [...hist.entries()].sort((a, b) => a[0] - b[0])) {
    for (let i = 0; i < count; i++) values.push(value);
  }
  return values;
}
const totalList = fromHist(totalHist);
const winnerCoinList = fromHist(winnerCoinHist);
const mean = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length;
const pct = (count: number) => +((100 * count) / GAMES).toFixed(2);

const topProfiles = [...profiles.entries()]
  .sort((a, b) => b[1] - a[1])
  .map(([profile, count]) => ({ profile, games: count, pct: pct(count) }));

console.log(JSON.stringify({
  seconds: +((Date.now() - started) / 1000).toFixed(1),
  games: GAMES,
  players: PLAYERS,
  rounds: ROUNDS,
  prices: Object.fromEntries([...Object.values(ITEMS), { id: 'banana', price: 20 }, { id: 'iaguguBanana', price: IAGUGU_GOLDEN_PRICE }].map((item) => [item.id, item.price])),
  profiles: topProfiles,
  profileCount: profiles.size,
  totals: {
    mean: +mean(totalList).toFixed(2),
    median: percentile(totalList, 0.5),
    p10: percentile(totalList, 0.1),
    p90: percentile(totalList, 0.9),
    min: totalList[0],
    max: totalList[totalList.length - 1],
    hist: Object.fromEntries([...totalHist.entries()].sort((a, b) => a[0] - b[0])),
  },
  winnerBananas: [...winnerBananaHist.entries()].sort((a, b) => a[0] - b[0]).map(([bananas, count]) => ({ bananas, pct: pct(count) })),
  fullTiePct: pct(fullTies),
  bananaTieBrokenByCoinsPct: pct(coinBreaks),
  nobodyPastOnePct: pct(nobodyPastOne),
  zeros: {
    mean: +(zeroSum / GAMES).toFixed(2),
    distribution: [...zeroHist.entries()].sort((a, b) => a[0] - b[0]).map(([people, count]) => ({ people, pct: pct(count) })),
  },
  coins: {
    winnerMean: +mean(winnerCoinList).toFixed(1),
    winnerMedian: percentile(winnerCoinList, 0.5),
    winnerP10: percentile(winnerCoinList, 0.1),
    winnerP90: percentile(winnerCoinList, 0.9),
    tableMean: +(coinSum / GAMES).toFixed(1),
    winnerHist: Object.fromEntries([...winnerCoinHist.entries()].sort((a, b) => a[0] - b[0])),
  },
  buysPerGame: Object.fromEntries(Object.entries(buySum).sort((a, b) => b[1] - a[1]).map(([id, count]) => [id, +(count / GAMES).toFixed(2)])),
  bananas: {
    treePerGame: +(treeSum / GAMES).toFixed(2),
    iaguguTransfersPerGame: +(iaguguSum / GAMES).toFixed(2),
    cardTransfersPerGame: +(cardSum / GAMES).toFixed(2),
    destroyedPerGame: +(destroyedSum / GAMES).toFixed(2),
  },
  samples: Object.fromEntries([...sampleByProfile.entries()].map(([profile, game]) => [profile, {
    total: game.total,
    tree: game.tree,
    iagugu: game.iagugu,
    cardSteals: game.cardSteals,
    destroyed: game.destroyed,
    buys: game.buys,
    board: game.board,
  }])),
}, null, 2));
