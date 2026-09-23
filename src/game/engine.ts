import { CARDS_BY_ID, findCardByCode } from '../data/cards';
import { DEFAULT_CONFIG, ITEMS, MINIGAMES, defaultMinigameOrder } from '../data/config';
import { createDefaultMap } from '../data/map';
import { intAt, newSeed, shuffle } from './rng';
import type {
  BoardMap,
  Command,
  CommandEnvelope,
  CommandResult,
  DomainEvent,
  GameConfig,
  GameState,
  ItemId,
  Phase,
  Player,
  PlayerItem,
} from './types';
import { SCHEMA_VERSION } from './types';

/* ------------------------------------------------------------------ */
/* Criação                                                             */
/* ------------------------------------------------------------------ */

export interface PlayerSeed {
  id: string;
  name: string;
  color: string;
  symbol: string;
  portrait: string;
}

export function createGame(
  seeds: PlayerSeed[],
  configOverrides: Partial<GameConfig> = {},
  options: { seed?: number; map?: BoardMap; shuffleOrder?: boolean } = {},
): GameState {
  const config: GameConfig = { ...DEFAULT_CONFIG, ...configOverrides };
  if (config.minigameOrder.length < config.rounds) {
    config.minigameOrder = defaultMinigameOrder(config.rounds);
  }
  const map = options.map ?? createDefaultMap();
  const rngSeed = options.seed ?? newSeed();

  const players: Record<string, Player> = {};
  for (const seed of seeds) {
    players[seed.id] = {
      ...seed,
      nodeId: map.startNodeId,
      common: config.startingCommon,
      golden: 0,
      inventory: [],
      stepHistory: [],
    };
  }

  const ids = seeds.map((s) => s.id);
  const order = options.shuffleOrder === false ? ids : shuffle(ids, rngSeed);

  const state: GameState = {
    schemaVersion: SCHEMA_VERSION,
    gameId: `sf-${rngSeed.toString(36)}-${Date.now().toString(36)}`,
    createdAt: Date.now(),
    config,
    map,
    phase: 'roundReady',
    round: 1,
    order,
    activeIndex: 0,
    players,
    dice: null,
    diceMultiplier: 1,
    movement: null,
    pending: null,
    itemWindow: null,
    pedestalNodeId: map.pedestalSpots[0],
    goldenBoughtThisTurn: false,
    activeItemsUsedThisTurn: 0,
    shopUsedNodes: [],
    minigame: null,
    results: [],
    history: [],
    revision: 0,
    rngSeed,
    rngCursor: 0,
    notice: null,
    finishedAt: null,
  };

  log(state, 'system', `Ordem sorteada: ${order.map((id) => players[id].name).join(' → ')}`);
  return state;
}

/* ------------------------------------------------------------------ */
/* Utilitários                                                         */
/* ------------------------------------------------------------------ */

export function activePlayer(state: GameState): Player | null {
  const id = state.order[state.activeIndex];
  return id ? state.players[id] : null;
}

export function minigameForRound(state: GameState, round: number) {
  const id = state.config.minigameOrder[round - 1] ?? MINIGAMES[0].id;
  return MINIGAMES.find((m) => m.id === id) ?? MINIGAMES[0];
}

/** Ordem do placar: douradas primeiro, depois moedas. */
export function ranking(state: GameState): Player[] {
  return Object.values(state.players).sort(
    (a, b) => b.golden - a.golden || b.common - a.common || a.name.localeCompare(b.name),
  );
}

export function winnersOf(state: GameState): string[] {
  const sorted = ranking(state);
  if (sorted.length === 0) return [];
  const top = sorted[0];
  return sorted
    .filter((p) => p.golden === top.golden && p.common === top.common)
    .map((p) => p.id);
}

export function usableActiveItems(state: GameState, player: Player): PlayerItem[] {
  if (state.activeItemsUsedThisTurn >= state.config.activeItemsPerTurn) return [];
  return player.inventory.filter((it) => ITEMS[it.itemId].usage === 'active');
}

export function defensiveItems(player: Player): PlayerItem[] {
  return player.inventory.filter((it) => ITEMS[it.itemId].usage === 'defensive');
}

function clone(state: GameState): GameState {
  return structuredClone(state);
}

function log(
  state: GameState,
  kind: GameState['history'][number]['kind'],
  text: string,
  playerId?: string,
) {
  state.history.push({
    id: `h${state.history.length}-${state.revision}`,
    round: state.round,
    playerId,
    text,
    kind,
  });
  if (state.history.length > 400) state.history.splice(0, state.history.length - 400);
}

function nextRandomInt(state: GameState, min: number, max: number): number {
  const value = intAt(state.rngSeed, state.rngCursor, min, max);
  state.rngCursor += 1;
  return value;
}

function removeItem(player: Player, uid: string): PlayerItem | null {
  const index = player.inventory.findIndex((it) => it.uid === uid);
  if (index < 0) return null;
  return player.inventory.splice(index, 1)[0];
}

function grantItem(state: GameState, player: Player, itemId: ItemId, events: DomainEvent[]): boolean {
  if (player.inventory.length >= state.config.inventoryLimit) {
    state.notice = `${player.name} está com o inventário cheio: o item não foi entregue.`;
    log(state, 'info', `${player.name} não recebeu ${ITEMS[itemId].name} (inventário cheio).`, player.id);
    return false;
  }
  player.inventory.push({ uid: `it-${state.revision}-${state.rngCursor}-${player.inventory.length}`, itemId });
  events.push({ type: 'itemGranted', playerId: player.id, itemId });
  log(state, 'card', `${player.name} recebeu ${ITEMS[itemId].name}.`, player.id);
  return true;
}

/** Saldo nunca fica negativo: perde no máximo o que existe. */
function changeCommon(
  state: GameState,
  player: Player,
  delta: number,
  reason: string,
  events: DomainEvent[],
): number {
  const applied = delta < 0 ? -Math.min(player.common, -delta) : delta;
  player.common += applied;
  if (applied !== 0) {
    events.push({ type: 'coinsChanged', playerId: player.id, delta: applied, reason });
    log(
      state,
      'money',
      `${player.name} ${applied > 0 ? 'ganhou' : 'perdeu'} ${Math.abs(applied)} moeda(s) — ${reason}.`,
      player.id,
    );
  }
  return applied;
}

function consumeSource(
  state: GameState,
  attacker: Player,
  source: { type: 'item'; uid: string } | { type: 'card'; cardId: string },
) {
  if (source.type === 'item') {
    const item = removeItem(attacker, source.uid);
    if (item) state.activeItemsUsedThisTurn += 1;
  }
}

/* ------------------------------------------------------------------ */
/* Movimento                                                           */
/* ------------------------------------------------------------------ */

function shopItemsAvailable(state: GameState, player: Player): ItemId[] {
  if (player.inventory.length >= state.config.inventoryLimit) return [];
  return state.config.shopItems.filter((id) => ITEMS[id].price <= player.common);
}

/**
 * Executa a chegada a um nó: decrementa o passo, ativa passagem/destino e
 * decide a próxima fase. Usado tanto pelo passo automático quanto pela
 * escolha de bifurcação.
 */
function arriveAt(state: GameState, player: Player, nodeId: string, events: DomainEvent[]) {
  const movement = state.movement!;
  if (movement.direction === 'forward') player.stepHistory.push(player.nodeId);
  player.nodeId = nodeId;
  movement.traversed.push(nodeId);
  movement.remaining -= 1;
  const landed = movement.remaining <= 0;

  if (!movement.activatesSpaces) {
    // Deslocamento forçado por carta não ativa nada (evita cadeias).
    state.phase = landed ? 'turnEnd' : 'moving';
    if (landed) {
      state.movement = null;
      events.push({ type: 'movementFinished', playerId: player.id, nodeId });
    }
    return;
  }

  const node = state.map.nodes[nodeId];

  // Loja e pedestal ativam por PASSAGEM ou chegada.
  if (node.kind === 'shop') {
    const available = shopItemsAvailable(state, player);
    if (available.length === 0) {
      state.notice =
        player.inventory.length >= state.config.inventoryLimit
          ? `${player.name} passou pela loja com o inventário cheio.`
          : `${player.name} passou pela loja sem saldo para nenhum item.`;
    } else {
      state.pending = { kind: 'shop', playerId: player.id, nodeId, items: available };
      state.phase = 'awaitingInteraction';
      return;
    }
  } else if (nodeId === state.pedestalNodeId) {
    if (state.goldenBoughtThisTurn) {
      state.notice = `${player.name} já comprou uma banana dourada neste turno.`;
    } else if (player.common < state.config.goldenPrice) {
      state.notice = `${player.name} passou pelo pedestal sem as ${state.config.goldenPrice} moedas.`;
    } else {
      state.pending = {
        kind: 'pedestal',
        playerId: player.id,
        nodeId,
        price: state.config.goldenPrice,
      };
      state.phase = 'awaitingInteraction';
      return;
    }
  }

  if (landed) {
    state.movement = null;
    events.push({ type: 'movementFinished', playerId: player.id, nodeId });
    state.phase = 'resolvingSpace';
  } else {
    state.phase = 'moving';
  }
}

/** Depois de resolver uma interação: volta a andar ou encerra o turno. */
function resumeAfterInteraction(state: GameState, player: Player, events: DomainEvent[]) {
  state.pending = null;
  if (state.movement && state.movement.remaining > 0) {
    state.phase = 'moving';
    return;
  }
  if (state.movement) {
    events.push({ type: 'movementFinished', playerId: player.id, nodeId: player.nodeId });
    state.movement = null;
    state.phase = 'resolvingSpace';
    return;
  }
  state.phase = 'turnEnd';
}

/* ------------------------------------------------------------------ */
/* Ataque                                                              */
/* ------------------------------------------------------------------ */

function startAttack(
  state: GameState,
  attacker: Player,
  target: Player,
  amount: number,
  source: { type: 'item'; uid: string } | { type: 'card'; cardId: string },
  resume: 'readyToRoll' | 'turnEnd',
  events: DomainEvent[],
) {
  const blockable = source.type === 'item' ? true : CARDS_BY_ID[source.cardId].blockable;
  const reversible = source.type === 'item' ? true : CARDS_BY_ID[source.cardId].reversible;
  const options = defensiveItems(target).filter((it) =>
    it.itemId === 'escudo' ? blockable : reversible,
  );

  if (options.length === 0) {
    // Ataque sem defesa possível não pede confirmação de defesa inexistente.
    consumeSource(state, attacker, source);
    changeCommon(state, target, -amount, `ataque de ${attacker.name}`, events);
    events.push({ type: 'attackResolved', attackerId: attacker.id, targetId: target.id, amount });
    state.pending = null;
    state.phase = resume;
    return;
  }

  state.pending = {
    kind: 'defense',
    attackerId: attacker.id,
    targetId: target.id,
    amount,
    options,
    blockable,
    reversible,
    source,
    resume,
  };
  state.phase = 'awaitingInteraction';
}

/* ------------------------------------------------------------------ */
/* Minigame                                                            */
/* ------------------------------------------------------------------ */

export function autoTeams(ids: string[]): string[][] {
  // Duas equipes equilibradas. Número ímpar: a primeira equipe fica com um a mais.
  const half = Math.ceil(ids.length / 2);
  return [ids.slice(0, half), ids.slice(half)];
}

function computeIndividualAwards(state: GameState, ranking: string[][]): Record<string, number> {
  const { first, second, others } = state.config.rewards.individual;
  const awards: Record<string, number> = {};
  let position = 1;
  for (const tier of ranking) {
    const prize = position === 1 ? first : position === 2 ? second : others;
    for (const id of tier) awards[id] = prize;
    position += tier.length; // 1º, 1º, 3º
  }
  // Quem não foi classificado recebe o prêmio de participação.
  for (const id of state.order) if (!(id in awards)) awards[id] = others;
  return awards;
}

function computeTeamAwards(
  state: GameState,
  teams: string[][],
  winningTeam: number,
): Record<string, number> {
  const { winner, loser, draw } = state.config.rewards.teams;
  const awards: Record<string, number> = {};
  teams.forEach((team, index) => {
    const prize = winningTeam < 0 ? draw : index === winningTeam ? winner : loser;
    for (const id of team) awards[id] = prize;
  });
  for (const id of state.order) if (!(id in awards)) awards[id] = loser;
  return awards;
}

/* ------------------------------------------------------------------ */
/* Reducer                                                             */
/* ------------------------------------------------------------------ */

function reject(state: GameState, reason: string): CommandResult {
  return { state, events: [], rejected: reason };
}

export function applyCommand(state: GameState, envelope: CommandEnvelope): CommandResult {
  if (envelope.expectedRevision !== state.revision) {
    return reject(state, `Revisão esperada ${envelope.expectedRevision}, atual ${state.revision}.`);
  }
  const result = reduce(state, envelope.command);
  if (result.rejected) return result;
  result.state.revision = state.revision + 1;
  return result;
}

function reduce(prev: GameState, command: Command): CommandResult {
  const state = clone(prev);
  const events: DomainEvent[] = [];
  const player = activePlayer(state);
  const cfg = state.config;

  switch (command.type) {
    case 'dismissNotice': {
      if (!prev.notice) return reject(prev, 'Sem aviso.');
      state.notice = null;
      return { state, events };
    }

    case 'startRound': {
      if (state.phase !== 'roundReady') return reject(prev, 'Fase não permite iniciar rodada.');
      state.phase = 'turnStart';
      state.activeIndex = 0;
      events.push({ type: 'roundStarted', round: state.round });
      log(state, 'system', `Rodada ${state.round} iniciada.`);
      return { state, events };
    }

    case 'beginTurn': {
      if (state.phase !== 'turnStart') return reject(prev, 'Fase não permite iniciar turno.');
      if (!player) return reject(prev, 'Sem jogador ativo.');
      state.dice = null;
      state.diceMultiplier = 1;
      state.goldenBoughtThisTurn = false;
      state.activeItemsUsedThisTurn = 0;
      state.notice = null;
      events.push({ type: 'turnStarted', playerId: player.id });
      log(state, 'info', `Vez de ${player.name}.`, player.id);

      if (usableActiveItems(state, player).length > 0) {
        state.phase = 'itemWindow';
        state.itemWindow = { playerId: player.id, remainingMs: cfg.itemWindowMs };
      } else {
        state.phase = 'readyToRoll';
        state.itemWindow = null;
      }
      return { state, events };
    }

    case 'openItemWindow':
      return reject(prev, 'Janela de item é aberta pelo início do turno.');

    case 'itemWindowExpired': {
      if (state.phase !== 'itemWindow') return reject(prev, 'Janela de item não está aberta.');
      state.itemWindow = null;
      state.phase = 'readyToRoll';
      return { state, events };
    }

    case 'requestItemChoice': {
      if (state.phase !== 'itemWindow') return reject(prev, 'Janela de item não está aberta.');
      if (!player) return reject(prev, 'Sem jogador ativo.');
      state.itemWindow = null; // prazo suspenso
      state.phase = 'awaitingItemChoice';
      state.pending = { kind: 'itemChoice', playerId: player.id };
      return { state, events };
    }

    case 'cancelItemChoice': {
      if (state.phase !== 'awaitingItemChoice') return reject(prev, 'Não há escolha de item.');
      // Cancelar = não usar item. Não reinicia a janela.
      state.pending = null;
      state.phase = 'readyToRoll';
      return { state, events };
    }

    case 'useItem': {
      if (state.phase !== 'awaitingItemChoice') return reject(prev, 'Não há escolha de item.');
      if (!player) return reject(prev, 'Sem jogador ativo.');
      if (state.activeItemsUsedThisTurn >= cfg.activeItemsPerTurn) {
        return reject(prev, 'Limite de itens ativos no turno.');
      }
      const item = player.inventory.find((it) => it.uid === command.uid);
      if (!item) return reject(prev, 'Item não está no inventário.');
      if (ITEMS[item.itemId].usage !== 'active') return reject(prev, 'Item não é utilizável agora.');

      if (item.itemId === 'dadoDuplo') {
        removeItem(player, item.uid);
        state.activeItemsUsedThisTurn += 1;
        state.diceMultiplier = 2;
        state.pending = null;
        state.phase = 'readyToRoll';
        events.push({ type: 'itemUsed', playerId: player.id, itemId: 'dadoDuplo' });
        log(state, 'card', `${player.name} usou Dado duplo.`, player.id);
        return { state, events };
      }

      // Casca: precisa de alvo. O item só é consumido na resolução.
      const candidates = state.order.filter((id) => id !== player.id);
      if (candidates.length === 0) return reject(prev, 'Não há alvo possível.');
      events.push({ type: 'itemUsed', playerId: player.id, itemId: item.itemId });
      state.pending = {
        kind: 'target',
        playerId: player.id,
        source: { type: 'item', uid: item.uid },
        candidates,
        amount: 3,
        resume: 'readyToRoll',
      };
      state.phase = 'awaitingInteraction';
      return { state, events };
    }

    case 'rollDice': {
      if (state.phase !== 'readyToRoll') return reject(prev, 'Fase não permite rolar dado.');
      if (state.pending) return reject(prev, 'Há decisão pendente.');
      if (!player) return reject(prev, 'Sem jogador ativo.');
      const raw = nextRandomInt(state, cfg.diceMin, cfg.diceMax);
      const doubled = state.diceMultiplier > 1;
      const value = raw * state.diceMultiplier;
      state.dice = value;
      state.diceMultiplier = 1;
      state.itemWindow = null;
      state.movement = { remaining: value, traversed: [], activatesSpaces: true, direction: 'forward' };
      state.phase = 'moving';
      events.push({ type: 'diceRolled', playerId: player.id, value, doubled });
      log(state, 'info', `${player.name} tirou ${value}${doubled ? ' (dado duplo)' : ''}.`, player.id);
      return { state, events };
    }

    case 'step': {
      if (state.phase !== 'moving' || !state.movement) return reject(prev, 'Não há movimento em curso.');
      if (!player) return reject(prev, 'Sem jogador ativo.');
      const movement = state.movement;

      if (movement.direction === 'back') {
        const back = player.stepHistory.pop();
        if (!back) {
          // Sem histórico suficiente: para no início.
          player.nodeId = state.map.startNodeId;
          state.movement = null;
          state.phase = 'turnEnd';
          events.push({ type: 'movementFinished', playerId: player.id, nodeId: player.nodeId });
          return { state, events };
        }
        player.nodeId = back;
        movement.traversed.push(back);
        movement.remaining -= 1;
        if (movement.remaining <= 0) {
          state.movement = null;
          state.phase = 'turnEnd';
          events.push({ type: 'movementFinished', playerId: player.id, nodeId: player.nodeId });
        }
        return { state, events };
      }

      const exits = state.map.nodes[player.nodeId].next;
      if (exits.length > 1) {
        state.pending = { kind: 'path', playerId: player.id, options: exits };
        state.phase = 'awaitingPath';
        return { state, events };
      }
      arriveAt(state, player, exits[0], events);
      return { state, events };
    }

    case 'choosePath': {
      if (state.phase !== 'awaitingPath' || state.pending?.kind !== 'path') {
        return reject(prev, 'Não há bifurcação pendente.');
      }
      if (!player) return reject(prev, 'Sem jogador ativo.');
      if (!state.pending.options.includes(command.nodeId)) return reject(prev, 'Caminho inválido.');
      state.pending = null;
      log(state, 'info', `${player.name} escolheu um caminho.`, player.id);
      arriveAt(state, player, command.nodeId, events);
      return { state, events };
    }

    case 'buyItem': {
      if (state.pending?.kind !== 'shop') return reject(prev, 'Não há loja aberta.');
      const buyer = state.players[state.pending.playerId];
      if (!state.pending.items.includes(command.itemId)) return reject(prev, 'Item indisponível.');
      const def = ITEMS[command.itemId];
      if (buyer.common < def.price) return reject(prev, 'Saldo insuficiente.');
      if (buyer.inventory.length >= cfg.inventoryLimit) return reject(prev, 'Inventário cheio.');
      // Atômico: debita e entrega.
      buyer.common -= def.price;
      buyer.inventory.push({ uid: `it-${state.revision}-${buyer.inventory.length}`, itemId: def.id });
      events.push({ type: 'coinsChanged', playerId: buyer.id, delta: -def.price, reason: 'compra na loja' });
      events.push({ type: 'itemGranted', playerId: buyer.id, itemId: def.id });
      log(state, 'card', `${buyer.name} comprou ${def.name} por ${def.price}.`, buyer.id);
      resumeAfterInteraction(state, buyer, events);
      return { state, events };
    }

    case 'skipShop': {
      if (state.pending?.kind !== 'shop') return reject(prev, 'Não há loja aberta.');
      const shopper = state.players[state.pending.playerId];
      log(state, 'info', `${shopper.name} passou pela loja sem comprar.`, shopper.id);
      resumeAfterInteraction(state, shopper, events);
      return { state, events };
    }

    case 'buyGolden': {
      if (state.pending?.kind !== 'pedestal') return reject(prev, 'Não há pedestal aberto.');
      const buyer = state.players[state.pending.playerId];
      if (state.goldenBoughtThisTurn) return reject(prev, 'Já comprou dourada neste turno.');
      if (buyer.common < state.pending.price) return reject(prev, 'Saldo insuficiente.');
      buyer.common -= state.pending.price;
      buyer.golden += 1;
      state.goldenBoughtThisTurn = true;
      events.push({ type: 'coinsChanged', playerId: buyer.id, delta: -state.pending.price, reason: 'banana dourada' });
      events.push({ type: 'goldenBananaPurchased', playerId: buyer.id });
      log(state, 'golden', `${buyer.name} conquistou uma BANANA DOURADA!`, buyer.id);

      // Realoca o pedestal, excluindo o local atual.
      const spots = state.map.pedestalSpots.filter((id) => id !== state.pedestalNodeId);
      if (spots.length > 0) {
        const pick = spots[nextRandomInt(state, 0, spots.length - 1)];
        state.pedestalNodeId = pick;
        log(state, 'system', `O pedestal foi realocado para ${pick}.`);
      }
      resumeAfterInteraction(state, buyer, events);
      return { state, events };
    }

    case 'skipPedestal': {
      if (state.pending?.kind !== 'pedestal') return reject(prev, 'Não há pedestal aberto.');
      const who = state.players[state.pending.playerId];
      log(state, 'info', `${who.name} não comprou a banana dourada.`, who.id);
      resumeAfterInteraction(state, who, events);
      return { state, events };
    }

    case 'submitCardCode': {
      if (state.pending?.kind !== 'cardCode') return reject(prev, 'Não há carta pendente.');
      const card = findCardByCode(command.code);
      if (!card) return reject(prev, 'Código não encontrado.');
      if (card.category !== state.pending.category) {
        return reject(prev, 'A carta é de outro baralho.');
      }
      state.pending = {
        kind: 'cardPreview',
        playerId: state.pending.playerId,
        cardId: card.id,
        category: card.category,
      };
      return { state, events };
    }

    case 'cancelCard': {
      if (state.pending?.kind !== 'cardPreview') return reject(prev, 'Não há prévia de carta.');
      state.pending = { kind: 'cardCode', playerId: state.pending.playerId, category: state.pending.category };
      return { state, events };
    }

    case 'confirmCard': {
      if (state.pending?.kind !== 'cardPreview') return reject(prev, 'Não há prévia de carta.');
      const holder = state.players[state.pending.playerId];
      const card = CARDS_BY_ID[state.pending.cardId];
      state.pending = null;
      events.push({ type: 'cardResolved', playerId: holder.id, cardId: card.id });
      log(state, 'card', `${holder.name}: ${card.title}.`, holder.id);

      switch (card.effectType) {
        case 'gainCommon':
          changeCommon(state, holder, card.amount, card.title, events);
          state.phase = 'turnEnd';
          break;
        case 'loseCommon':
          changeCommon(state, holder, -card.amount, card.title, events);
          state.phase = 'turnEnd';
          break;
        case 'grantItem':
          if (card.grantsItem) grantItem(state, holder, card.grantsItem, events);
          state.phase = 'turnEnd';
          break;
        case 'moveBack':
          state.movement = {
            remaining: card.amount,
            traversed: [],
            activatesSpaces: false,
            direction: 'back',
          };
          state.phase = 'moving';
          break;
        case 'attackCommon': {
          const candidates = state.order.filter((id) => id !== holder.id);
          if (candidates.length === 0) {
            state.phase = 'turnEnd';
            break;
          }
          state.pending = {
            kind: 'target',
            playerId: holder.id,
            source: { type: 'card', cardId: card.id },
            candidates,
            amount: card.amount,
            resume: 'turnEnd',
          };
          state.phase = 'awaitingInteraction';
          break;
        }
      }
      return { state, events };
    }

    case 'chooseTarget': {
      if (state.pending?.kind !== 'target') return reject(prev, 'Não há escolha de alvo.');
      if (!state.pending.candidates.includes(command.targetId)) return reject(prev, 'Alvo inválido.');
      const attacker = state.players[state.pending.playerId];
      const target = state.players[command.targetId];
      const { amount, source, resume } = state.pending;
      state.pending = null;
      startAttack(state, attacker, target, amount, source, resume, events);
      return { state, events };
    }

    case 'cancelTarget': {
      if (state.pending?.kind !== 'target') return reject(prev, 'Não há escolha de alvo.');
      const { resume, source, playerId } = state.pending;
      state.pending = null;
      if (source.type === 'card') {
        // A carta já foi revelada: sem alvo escolhido, nada acontece.
        log(state, 'info', `${state.players[playerId].name} não escolheu alvo.`, playerId);
      }
      state.phase = resume;
      return { state, events };
    }

    case 'resolveDefense': {
      if (state.pending?.kind !== 'defense') return reject(prev, 'Não há defesa pendente.');
      const { attackerId, targetId, amount, source, resume, options } = state.pending;
      const attacker = state.players[attackerId];
      const target = state.players[targetId];

      if (command.choice !== 'none') {
        const uid = command.uid;
        const chosen = options.find((it) => it.uid === uid);
        if (!chosen) return reject(prev, 'Item de defesa inválido.');
        const expected = command.choice === 'block' ? 'escudo' : 'reverse';
        if (chosen.itemId !== expected) return reject(prev, 'Item não faz essa defesa.');
        // Atômico: consome defesa e origem do ataque.
        removeItem(target, chosen.uid);
        consumeSource(state, attacker, source);
        if (command.choice === 'block') {
          events.push({ type: 'attackBlocked', attackerId, targetId });
          log(state, 'card', `${target.name} bloqueou o ataque de ${attacker.name} com Escudo.`, target.id);
        } else {
          // Reverse não inicia cadeia: o atacante não pode defender.
          changeCommon(state, attacker, -amount, `reverse de ${target.name}`, events);
          events.push({ type: 'attackReversed', attackerId, targetId, amount });
          log(state, 'card', `${target.name} devolveu o ataque para ${attacker.name}.`, target.id);
        }
      } else {
        consumeSource(state, attacker, source);
        changeCommon(state, target, -amount, `ataque de ${attacker.name}`, events);
        events.push({ type: 'attackResolved', attackerId, targetId, amount });
      }

      state.pending = null;
      state.phase = resume;
      return { state, events };
    }

    case 'resolveSpace': {
      if (state.phase !== 'resolvingSpace') return reject(prev, 'Não há casa para resolver.');
      if (!player) return reject(prev, 'Sem jogador ativo.');
      const node = state.map.nodes[player.nodeId];
      switch (node.kind) {
        case 'plus':
          changeCommon(state, player, cfg.plusAmount, 'casa boa', events);
          state.phase = 'turnEnd';
          break;
        case 'minus':
          changeCommon(state, player, -cfg.minusAmount, 'casa ruim', events);
          state.phase = 'turnEnd';
          break;
        case 'luck':
        case 'unluck':
          state.pending = {
            kind: 'cardCode',
            playerId: player.id,
            category: node.kind === 'luck' ? 'luck' : 'unluck',
          };
          state.phase = 'awaitingInteraction';
          break;
        case 'thief':
          if (!cfg.thiefEnabled) {
            state.notice = 'O esconderijo do ladrão está desativado nesta configuração.';
          }
          state.phase = 'turnEnd';
          break;
        default:
          state.phase = 'turnEnd';
      }
      return { state, events };
    }

    case 'endTurn': {
      if (state.phase !== 'turnEnd') return reject(prev, 'Turno não está pronto para encerrar.');
      if (!player) return reject(prev, 'Sem jogador ativo.');
      events.push({ type: 'turnEnded', playerId: player.id });
      state.dice = null;
      state.movement = null;
      state.pending = null;
      state.itemWindow = null;
      state.diceMultiplier = 1;

      if (state.activeIndex + 1 < state.order.length) {
        state.activeIndex += 1;
        state.phase = 'turnStart';
        return { state, events };
      }

      // Todos jogaram: exatamente um minigame por rodada.
      const game = minigameForRound(state, state.round);
      state.minigame = {
        minigameId: game.id,
        teams: game.format === 'teams' ? autoTeams(state.order) : [],
        applied: false,
      };
      state.phase = 'minigameIntro';
      events.push({ type: 'minigameStarted', minigameId: game.id });
      log(state, 'minigame', `Fim dos turnos da rodada ${state.round}. Prova: ${game.name}.`);
      return { state, events };
    }

    case 'startMinigame': {
      if (state.phase !== 'minigameIntro') return reject(prev, 'Não há prova para iniciar.');
      state.phase = 'awaitingResults';
      return { state, events };
    }

    case 'setTeams': {
      if (state.phase !== 'awaitingResults' && state.phase !== 'minigameIntro') {
        return reject(prev, 'Fase não permite montar equipes.');
      }
      if (!state.minigame) return reject(prev, 'Sem prova ativa.');
      const flat = command.teams.flat();
      if (new Set(flat).size !== flat.length) return reject(prev, 'Jogador repetido em equipes.');
      for (const id of flat) if (!state.players[id]) return reject(prev, 'Jogador inexistente.');
      state.minigame.teams = command.teams;
      return { state, events };
    }

    case 'submitResults': {
      if (state.phase !== 'awaitingResults') return reject(prev, 'Não há prova aguardando resultado.');
      if (!state.minigame) return reject(prev, 'Sem prova ativa.');
      // Confirmar duas vezes não duplica recompensa.
      if (state.minigame.applied) return reject(prev, 'Resultado já aplicado.');

      const game = MINIGAMES.find((m) => m.id === state.minigame!.minigameId)!;
      let awards: Record<string, number>;
      let detail: string;

      if (command.format === 'teams') {
        const teams = state.minigame.teams;
        if (teams.length < 2) return reject(prev, 'Defina as equipes antes de confirmar.');
        const winningTeam = command.winningTeam ?? -1;
        awards = computeTeamAwards(state, teams, winningTeam);
        detail =
          winningTeam < 0
            ? 'Empate entre as equipes.'
            : `Equipe ${winningTeam + 1} venceu.`;
      } else {
        const rank = command.ranking ?? [];
        if (rank.flat().length === 0) return reject(prev, 'Informe ao menos uma colocação.');
        const flat = rank.flat();
        if (new Set(flat).size !== flat.length) return reject(prev, 'Jogador repetido na classificação.');
        awards = computeIndividualAwards(state, rank);
        detail = rank
          .map((tier, i) => `${i + 1}º: ${tier.map((id) => state.players[id].name).join(', ')}`)
          .join(' | ');
      }

      // Premiação aplicada em uma única operação.
      for (const [id, amount] of Object.entries(awards)) {
        const p = state.players[id];
        if (!p || amount === 0) continue;
        p.common += amount;
        events.push({ type: 'coinsChanged', playerId: id, delta: amount, reason: game.name });
      }
      state.minigame.applied = true;
      state.minigame.appliedResultId = command.resultId;
      state.results.push({
        round: state.round,
        minigameId: game.id,
        format: command.format,
        awards,
        detail,
      });

      const best = Math.max(...Object.values(awards));
      const winners = Object.entries(awards)
        .filter(([, v]) => v === best)
        .map(([id]) => id);
      events.push({ type: 'minigameCompleted', minigameId: game.id, winners });
      log(state, 'minigame', `${game.name}: ${detail}`);

      state.phase = 'roundEnd';
      events.push({ type: 'roundEnded', round: state.round });
      return { state, events };
    }

    case 'nextRound': {
      if (state.phase !== 'roundEnd') return reject(prev, 'A rodada ainda não terminou.');
      state.minigame = null;
      if (state.round >= cfg.rounds) {
        state.phase = 'finished';
        state.finishedAt = Date.now();
        const winners = winnersOf(state);
        events.push({ type: 'gameCompleted', winners });
        log(state, 'system', `Partida encerrada. Campeão(ões): ${winners.map((id) => state.players[id].name).join(', ')}.`);
        return { state, events };
      }
      state.round += 1;
      state.activeIndex = 0;
      state.phase = 'roundReady';
      return { state, events };
    }

    case 'manualAdjust': {
      const target = state.players[command.playerId];
      if (!target) return reject(prev, 'Jogador inexistente.');
      if (!command.reason.trim()) return reject(prev, 'Informe o motivo da correção.');
      const before = `${target.common}/${target.golden}`;
      target.common = Math.max(0, Math.round(command.common));
      target.golden = Math.max(0, Math.round(command.golden));
      log(
        state,
        'manual',
        `Correção manual em ${target.name}: ${before} → ${target.common}/${target.golden}. Motivo: ${command.reason.trim()}`,
        target.id,
      );
      return { state, events };
    }
  }
}

/* ------------------------------------------------------------------ */
/* Automação (puro): qual é o próximo comando automático permitido?    */
/* ------------------------------------------------------------------ */

export function nextAutoCommand(state: GameState): Command | null {
  if (state.pending) return null;
  switch (state.phase) {
    case 'turnStart':
      return { type: 'beginTurn' };
    case 'readyToRoll':
      return { type: 'rollDice' };
    case 'moving':
      return { type: 'step' };
    case 'resolvingSpace':
      return { type: 'resolveSpace' };
    case 'turnEnd':
      return { type: 'endTurn' };
    default:
      return null;
  }
}

/** Fases que esperam uma ação humana e nunca expiram. */
export const DECISION_PHASES: Phase[] = [
  'roundReady',
  'awaitingItemChoice',
  'awaitingPath',
  'awaitingInteraction',
  'minigameIntro',
  'awaitingResults',
  'roundEnd',
  'finished',
];

export function isDecisionPhase(state: GameState): boolean {
  return DECISION_PHASES.includes(state.phase);
}

/** Texto legível do estado, para a barra de status. */
export function statusText(state: GameState, manualPaused: boolean): string {
  const player = activePlayer(state);
  const name = player?.name ?? '—';
  if (manualPaused) return 'Pausado pelo anfitrião';
  switch (state.phase) {
    case 'roundReady':
      return `Pronto para iniciar a rodada ${state.round}`;
    case 'turnStart':
      return `Anunciando ${name}`;
    case 'itemWindow':
      return `${name} pode usar um item`;
    case 'awaitingItemChoice':
      return `${name} escolhe o item`;
    case 'readyToRoll':
      return `Rolando o dado de ${name}`;
    case 'moving':
      return `${name} se desloca`;
    case 'awaitingPath':
      return `${name} decide: qual caminho?`;
    case 'awaitingInteraction':
      switch (state.pending?.kind) {
        case 'shop':
          return `${name} decide: comprar ou passar (loja)`;
        case 'pedestal':
          return `${name} decide: comprar a banana dourada?`;
        case 'cardCode':
          return `${name}: informe o código da carta física`;
        case 'cardPreview':
          return `${name}: confirme a carta`;
        case 'target':
          return `${name} escolhe o alvo`;
        case 'defense':
          return `Defesa pendente`;
        default:
          return 'Decisão pendente';
      }
    case 'resolvingSpace':
      return `Resolvendo a casa de ${name}`;
    case 'turnEnd':
      return `Encerrando o turno de ${name}`;
    case 'minigameIntro':
      return 'Prova presencial da rodada';
    case 'awaitingResults':
      return 'Aguardando resultado do minigame';
    case 'roundEnd':
      return `Rodada ${state.round} concluída`;
    case 'finished':
      return 'Partida encerrada';
    default:
      return 'Rodada em andamento';
  }
}
