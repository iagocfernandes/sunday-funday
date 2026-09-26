/**
 * Mede o valor dos poderes no motor real.
 * Não altera o catálogo. Rode com: npx tsx scripts/balance-powers.ts
 *
 * Política dos bots, igual para todos:
 * - caminho mais curto até a árvore da banana ativa;
 * - compra a banana sempre que aparece e há saldo;
 * - na loja, compra um poder aleatório se sobrar pelo menos 8 moedas;
 * - Iagugu: rouba banana se tiver o preço e a vítima tiver banana; senão rouba moedas de quem tem mais;
 * - usa o poder com regra curta (dado máximo, troca só se estiver atrás, muda a banana se um rival está mais perto);
 * - duelo: aposta 3 ou o máximo, vencedor 50/50;
 * - prova: ranking aleatório, sem empate.
 */
import { createGame, applyCommand, nextAutoCommand, activePlayer, ranking, winnersOf } from '../src/game/engine';
import { IAGUGU_GOLDEN_PRICE, ITEMS } from '../src/data/config';
import { DIGITAL_CARDS } from '../src/data/cards';
import type { Command, GameState, ItemId } from '../src/game/types';

const SHOP: ItemId[] = ['dadoDuplo', 'dadoCerteiro', 'trocaTroca', 'mudaBanana', 'preguicao', 'blindado'];
const LEGACY: ItemId[] = ['bananaTurbo', 'maoNoBolso', 'casca', 'escudo', 'reverse'];

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

interface Tally {
  games: number;
  wins: number;
  rankSum: number;
  goldenSum: number;
  coinSum: number;
  buys: Record<string, number>;
  uses: Record<string, number>;
  cards: Record<string, number>;
  iaguguVisits: number;
  iaguguCoin: number;
  iaguguGolden: number;
  bananasBought: number;
}

function emptyTally(): Tally {
  return {
    games: 0, wins: 0, rankSum: 0, goldenSum: 0, coinSum: 0,
    buys: {}, uses: {}, cards: {},
    iaguguVisits: 0, iaguguCoin: 0, iaguguGolden: 0, bananasBought: 0,
  };
}

function play(
  players: number,
  seed: number,
  grant?: { id: ItemId; pay: number } | { golden: true; pay: number } | { steal: true; pay: number } | { victimGolden: true },
  shop: 'eager' | 'never' = 'never',
): Tally {
  const random = makeRng(seed ^ 0x9e3779b9);
  const pick = <T,>(list: T[]) => list[Math.floor(random() * list.length)]!;
  let state = createGame(
    Array.from({ length: players }, (_, i) => ({
      id: `p${i}`, name: `P${i}`, color: '#fff', symbol: 'o', portrait: '/x.png',
    })),
    { rounds: 8 },
    { seed, shuffleOrder: true },
  );
  const hero = state.players.p0;
  if (process.env.BALANCE_PURSE) hero.common = Number(process.env.BALANCE_PURSE);
  if (grant && 'id' in grant) {
    hero.inventory.push({ uid: 'grant', itemId: grant.id });
    hero.common = Math.max(0, hero.common - grant.pay);
  } else if (grant && 'golden' in grant) {
    hero.golden += 1;
    hero.common = Math.max(0, hero.common - grant.pay);
  } else if (grant && 'victimGolden' in grant) {
    state.players.p1.golden += 1;
  } else if (grant && 'steal' in grant) {
    state.players.p1.golden += 1;
    state.players.p1.golden -= 1;
    hero.golden += 1;
    hero.common = Math.max(0, hero.common - grant.pay);
  }
  const tally = emptyTally();
  const beforeCoins = () => Object.fromEntries(Object.values(state.players).map((p) => [p.id, p.common]));
  const beforeGolden = () => Object.fromEntries(Object.values(state.players).map((p) => [p.id, p.golden]));

  for (let step = 0; step < 12000 && state.phase !== 'finished'; step++) {
    let command: Command | null = null;
    const pending = state.pending;
    const actor = activePlayer(state);
    if (pending && actor) {
      switch (pending.kind) {
        case 'path': {
          const ranked = [...pending.options].sort((a, b) => bananaDist(state, a) - bananaDist(state, b) || a.localeCompare(b));
          const scenic = shop === 'eager' && ranked.length > 1 && random() < 0.35 ? ranked[1]! : ranked[0]!;
          command = { type: 'choosePath', nodeId: scenic };
          break;
        }
        case 'shop': {
          const affordable = shop === 'eager'
            ? pending.items.filter((id) => actor.common - ITEMS[id].price >= 8 && actor.inventory.length < 3)
            : [];
          if (affordable.length) {
            const itemId = pick(affordable);
            tally.buys[itemId] = (tally.buys[itemId] ?? 0) + 1;
            command = { type: 'buyItem', itemId };
          } else command = { type: 'skipShop' };
          break;
        }
        case 'pedestal':
          tally.bananasBought += 1;
          command = { type: 'buyGolden' };
          break;
        case 'cardPreview':
          tally.cards[pending.cardId] = (tally.cards[pending.cardId] ?? 0) + 1;
          command = { type: 'confirmCard' };
          break;
        case 'itemChoice': {
          const items = actor.inventory.filter((it) => ITEMS[it.itemId].usage === 'active');
          const mine = bananaDist(state, actor.nodeId);
          const rivals = state.order.filter((id) => id !== actor.id).map((id) => ({
            id, dist: bananaDist(state, state.players[id].nodeId), golden: state.players[id].golden,
          }));
          const nearest = [...rivals].sort((a, b) => a.dist - b.dist || b.golden - a.golden)[0];
          const chosen = items.find((it) => {
            if (it.itemId === 'dadoDuplo' || it.itemId === 'dadoCerteiro' || it.itemId === 'bananaTurbo') return mine > 1;
            if (it.itemId === 'preguicao' || it.itemId === 'casca' || it.itemId === 'maoNoBolso') return true;
            if (it.itemId === 'trocaTroca') return nearest ? mine > nearest.dist + 2 : false;
            if (it.itemId === 'mudaBanana') return nearest ? nearest.dist + 1 < mine : false;
            return false;
          });
          command = chosen ? { type: 'useItem', uid: chosen.uid } : { type: 'cancelItemChoice' };
          if (chosen) tally.uses[chosen.itemId] = (tally.uses[chosen.itemId] ?? 0) + 1;
          break;
        }
        case 'chooseDice':
          command = { type: 'chooseDice', value: state.config.diceMax };
          break;
        case 'stealItem': {
          const best = [...pending.candidates].sort((a, b) => state.players[b].golden - state.players[a].golden || state.players[b].inventory.length - state.players[a].inventory.length)[0]!;
          command = { type: 'stealItem', targetId: best };
          break;
        }
        case 'target': {
          const best = [...pending.candidates].sort((a, b) => {
            const pa = state.players[a]; const pb = state.players[b];
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
          tally.iaguguVisits += 1;
          const coinsBefore = beforeCoins();
          const goldenBefore = beforeGolden();
          const victims = state.order.filter((id) => id !== actor.id);
          const withBanana = victims.filter((id) => state.players[id].golden > 0).sort((a, b) => state.players[b].golden - state.players[a].golden);
          const withCoins = victims.filter((id) => state.players[id].common > 0).sort((a, b) => state.players[b].common - state.players[a].common);
          if (withBanana.length && actor.common >= IAGUGU_GOLDEN_PRICE) command = { type: 'rob', targetId: withBanana[0]!, currency: 'golden' };
          else if (withCoins.length) command = { type: 'rob', targetId: withCoins[0]!, currency: 'common' };
          else command = { type: 'skipIagugu' };
          const result = apply(state, command);
          if (command.type === 'rob' && !result.rejected) {
            const next = result.state;
            if (command.currency === 'golden' && next.players[actor.id].golden > goldenBefore[actor.id]) tally.iaguguGolden += 1;
            const gained = next.players[actor.id].common - (coinsBefore[actor.id] - (command.currency === 'golden' ? IAGUGU_GOLDEN_PRICE : 0));
            if (command.currency === 'common') tally.iaguguCoin += Math.max(0, next.players[actor.id].common - coinsBefore[actor.id]);
            void gained;
          }
          state = result.rejected ? state : result.state;
          state.history = [];
          continue;
        }
        case 'duelBet':
          command = { type: 'setDuelBet', amount: pending.maxBet > 0 ? Math.min(3, pending.maxBet) : 0 };
          break;
        case 'duelResult':
          command = { type: 'resolveDuel', winnerId: random() < 0.5 ? pending.playerId : pending.opponentId };
          break;
        case 'discardPower':
          command = { type: 'discardPower', uid: state.players[pending.playerId].inventory[0]!.uid };
          break;
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
        const order = [...state.order].sort(() => random() - 0.5);
        const gameTeams = state.minigame?.teams ?? [];
        command = state.minigame && gameTeams.length
          ? { type: 'submitResults', resultId: `r${state.round}`, format: 'teams', winningTeam: Math.floor(random() * gameTeams.length) }
          : { type: 'submitResults', resultId: `r${state.round}`, format: 'individual', ranking: order.map((id) => [id]) };
      } else if (state.phase === 'roundEnd') command = { type: 'nextRound' };
      else command = nextAutoCommand(state);
    }
    if (!command) throw new Error(`parado em ${state.phase} ${state.pending?.kind ?? ''}`);
    const result = apply(state, command);
    if (result.rejected) {
      if (command.type === 'buyItem' && state.pending?.kind === 'shop') command = { type: 'skipShop' };
      else if (command.type === 'useItem' && state.pending?.kind === 'itemChoice') command = { type: 'cancelItemChoice' };
      else throw new Error(`${command.type}: ${result.rejected}`);
      const retry = apply(state, command);
      if (retry.rejected) throw new Error(`${command.type}: ${retry.rejected}`);
      state = retry.state;
    } else state = result.state;
    state.history = [];
  }
  if (state.phase !== 'finished') throw new Error('limite de passos');
  const place = ranking(state).findIndex((p) => p.id === 'p0') + 1;
  tally.games = 1;
  tally.wins = winnersOf(state).includes('p0') ? 1 : 0;
  tally.rankSum = place;
  tally.goldenSum = state.players.p0.golden;
  tally.coinSum = state.players.p0.common;
  return tally;
}

function apply(state: GameState, command: Command) {
  return applyCommand(state, { command, commandId: `s${state.revision}`, expectedRevision: state.revision });
}

function merge(into: Tally, row: Tally) {
  into.games += row.games;
  into.wins += row.wins;
  into.rankSum += row.rankSum;
  into.goldenSum += row.goldenSum;
  into.coinSum += row.coinSum;
  into.iaguguVisits += row.iaguguVisits;
  into.iaguguCoin += row.iaguguCoin;
  into.iaguguGolden += row.iaguguGolden;
  into.bananasBought += row.bananasBought;
  for (const [k, v] of Object.entries(row.buys)) into.buys[k] = (into.buys[k] ?? 0) + v;
  for (const [k, v] of Object.entries(row.uses)) into.uses[k] = (into.uses[k] ?? 0) + v;
  for (const [k, v] of Object.entries(row.cards)) into.cards[k] = (into.cards[k] ?? 0) + v;
}

function summarize(label: string, tally: Tally) {
  const g = tally.games || 1;
  return {
    label,
    games: tally.games,
    win: +(tally.wins / g).toFixed(4),
    rank: +(tally.rankSum / g).toFixed(3),
    golden: +(tally.goldenSum / g).toFixed(3),
    coins: +(tally.coinSum / g).toFixed(2),
    bananasBought: +(tally.bananasBought / g).toFixed(3),
    iaguguVisits: +(tally.iaguguVisits / g).toFixed(3),
    iaguguCoinsStolen: +(tally.iaguguCoin / g).toFixed(2),
    iaguguGoldenSteals: +(tally.iaguguGolden / g).toFixed(3),
    buys: Object.fromEntries(Object.entries(tally.buys).map(([k, v]) => [k, +(v / g).toFixed(3)])),
    uses: Object.fromEntries(Object.entries(tally.uses).map(([k, v]) => [k, +(v / g).toFixed(3)])),
    cards: Object.fromEntries(Object.entries(tally.cards).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, +(v / g).toFixed(3)])),
  };
}

const games = Number(process.env.BALANCE_GAMES ?? 300);
const players = Number(process.env.BALANCE_PLAYERS ?? 8);
const started = Date.now();

if (process.env.BALANCE_FOCUS === 'anchor' || process.env.BALANCE_FOCUS === 'prices' || process.env.BALANCE_FOCUS === 'spread') {
  const purseBase = batch('base', undefined, 'never');
  const rows = process.env.BALANCE_FOCUS === 'anchor'
    ? [
        purseBase,
        batch('banana-paga-20', { golden: true, pay: 20 }, 'never', purseBase),
        batch('vitima-ja-tem-banana', { victimGolden: true }, 'never', purseBase),
        batch('iagugu-30', { steal: true, pay: 30 }, 'never', purseBase),
        batch('iagugu-40', { steal: true, pay: 40 }, 'never', purseBase),
        batch('iagugu-50', { steal: true, pay: 50 }, 'never', purseBase),
      ]
    : process.env.BALANCE_FOCUS === 'spread'
      ? [
          purseBase,
          ...SHOP.map((id) => batch(`${id}-gratis`, { id, pay: 0 }, 'never', purseBase)),
        ]
      : [
          purseBase,
          batch('duplo-6', { id: 'dadoDuplo', pay: 6 }, 'never', purseBase),
          batch('duplo-8', { id: 'dadoDuplo', pay: 8 }, 'never', purseBase),
          batch('certo-7', { id: 'dadoCerteiro', pay: 7 }, 'never', purseBase),
          batch('certo-8', { id: 'dadoCerteiro', pay: 8 }, 'never', purseBase),
          batch('troca-8', { id: 'trocaTroca', pay: 8 }, 'never', purseBase),
          batch('troca-10', { id: 'trocaTroca', pay: 10 }, 'never', purseBase),
          batch('preguica-4', { id: 'preguicao', pay: 4 }, 'never', purseBase),
          batch('muda-4', { id: 'mudaBanana', pay: 4 }, 'never', purseBase),
          batch('blindado-3', { id: 'blindado', pay: 3 }, 'never', purseBase),
        ];
  console.log(JSON.stringify({ seconds: +((Date.now() - started) / 1000).toFixed(1), games, players, purse: process.env.BALANCE_PURSE ?? 'inicial', rows: rows.map((row) => ({ label: row.label, dWin: 'dWin' in row ? row.dWin : 0, dRank: 'dRank' in row ? row.dRank : 0, dGolden: 'dGolden' in row ? row.dGolden : 0, dCoins: 'dCoins' in row ? row.dCoins : 0, equiv: 'equivCoins' in row ? row.equivCoins : 0, win: row.win })) }, null, 2));
  process.exit(0);
}

function batch(label: string, grant: Parameters<typeof play>[2], shop: 'eager' | 'never', base?: ReturnType<typeof summarize>) {
  const tally = emptyTally();
  for (let i = 0; i < games; i++) merge(tally, play(players, 10001 + i * 7919, grant, shop));
  const sum = summarize(label, tally);
  if (!base) return sum;
  return {
    ...sum,
    dWin: +((sum.win - base.win) * 100).toFixed(2),
    dRank: +(base.rank - sum.rank).toFixed(3),
    dGolden: +(sum.golden - base.golden).toFixed(3),
    dCoins: +(sum.coins - base.coins).toFixed(2),
    equivCoins: +(20 * (sum.golden - base.golden) + (sum.coins - base.coins)).toFixed(2),
  };
}

const frequency = batch(`freq-${players}p`, undefined, 'eager');
const base = batch(`base-${players}p`, undefined, 'never');
const value = [
  batch('banana-gratis', { golden: true, pay: 0 }, 'never', base),
  batch('banana-paga-20', { golden: true, pay: 20 }, 'never', base),
  batch('vitima-ja-tem-banana', { victimGolden: true }, 'never', base),
  batch('iagugu-roubo-banana-40', { steal: true, pay: 40 }, 'never', base),
  ...[...SHOP, ...LEGACY].map((id) => batch(`${id}-gratis`, { id, pay: 0 }, 'never', base)),
  ...SHOP.map((id) => batch(`${id}-pago-${ITEMS[id].price}`, { id, pay: ITEMS[id].price }, 'never', base)),
];

const weights = DIGITAL_CARDS.map((c) => ({ id: c.id, title: c.title, weight: c.weight ?? 1, category: c.category }));
console.log(JSON.stringify({
  seconds: +((Date.now() - started) / 1000).toFixed(1),
  games,
  prices: Object.fromEntries(Object.values(ITEMS).map((it) => [it.id, it.price])),
  cardWeights: weights,
  frequency,
  base,
  value,
}, null, 2));
