import { CARDS_BY_ID } from '../data/cards';
import { validateMap } from '../data/map';
import type {
  CardCategory,
  GameState,
  ItemId,
  NodeKind,
  Phase,
} from '../game/types';
import { SCHEMA_VERSION } from '../game/types';

/**
 * Validação estrutural de um GameState vindo de fora do motor (arquivo
 * importado ou snapshot do localStorage). Usada tanto na importação quanto na
 * retomada: nada entra na partida sem passar por aqui.
 *
 * Toda leitura é defensiva — um objeto com formato inesperado devolve erro em
 * vez de lançar exceção em algum ponto distante do código.
 */

const PHASES = [
  'setup', 'roundReady', 'turnStart', 'itemWindow', 'awaitingItemChoice',
  'readyToRoll', 'moving', 'awaitingPath', 'awaitingInteraction',
  'resolvingSpace', 'turnEnd', 'minigameIntro', 'awaitingResults',
  'roundEnd', 'finished',
] as const satisfies readonly Phase[];

const ITEM_IDS = ['dadoDuplo', 'escudo', 'casca', 'reverse', 'dadoCerteiro', 'bananaTurbo', 'trocaTroca', 'maoNoBolso', 'mudaBanana', 'preguicao', 'blindado'] as const satisfies readonly ItemId[];

const NODE_KINDS = [
  'start', 'plus', 'minus', 'luck', 'unluck', 'shop', 'pedestal', 'thief', 'blank', 'duel',
] as const satisfies readonly NodeKind[];

const CARD_CATEGORIES = ['luck', 'unluck'] as const satisfies readonly CardCategory[];

const PENDING_KINDS = [
  'discardPower', 'iagugu', 'duelBet', 'duelResult', 'harvest', 'chooseDice', 'stealItem', 'path', 'shop', 'pedestal', 'cardCode', 'cardPreview', 'target', 'defense', 'itemChoice',
] as const;

/** Fases que obrigatoriamente têm (ou não têm) decisão pendente. */
const PHASES_REQUIRING_PENDING: readonly Phase[] = [
  'awaitingPath', 'awaitingInteraction', 'awaitingItemChoice',
];

export interface StateValidation {
  ok: boolean;
  errors: string[];
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isWholeNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value);
}

function isNonNegativeInt(value: unknown): value is number {
  return isWholeNumber(value) && value >= 0;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

/**
 * Valida um estado desconhecido. Devolve todos os erros encontrados para que a
 * mensagem ao anfitrião seja específica.
 */
export function validateGameState(value: unknown): StateValidation {
  const errors: string[] = [];
  const fail = (message: string) => {
    errors.push(message);
    return { ok: false, errors };
  };

  try {
    if (!isObject(value)) return fail('O estado não é um objeto.');
    const state = value as unknown as GameState;

    /* ---------- identidade e schema ---------- */
    if (!isNonEmptyString(state.gameId)) errors.push('gameId ausente ou inválido.');
    if (!isNonNegativeInt(state.revision)) errors.push('revision precisa ser inteiro não negativo.');
    if (!isNonNegativeInt(state.rngCursor)) errors.push('rngCursor precisa ser inteiro não negativo.');
    if (!isWholeNumber(state.rngSeed)) errors.push('rngSeed precisa ser um inteiro finito.');
    if (state.schemaVersion !== undefined && !isNonNegativeInt(state.schemaVersion)) {
      errors.push('schemaVersion inválido.');
    }
    if (isNonNegativeInt(state.schemaVersion) && state.schemaVersion > SCHEMA_VERSION) {
      return fail(`Estado da versão ${state.schemaVersion}; este app lê até ${SCHEMA_VERSION}.`);
    }
    if (!(PHASES as readonly string[]).includes(state.phase)) {
      return fail(`Fase desconhecida: ${String(state.phase)}.`);
    }

    /* ---------- configuração ---------- */
    const config = state.config as unknown;
    if (!isObject(config)) {
      return fail('Configuração ausente.');
    }
    const numericConfig: Array<[keyof GameState['config'], (v: unknown) => boolean]> = [
      ['rounds', (v) => isWholeNumber(v) && v >= 1],
      ['diceMin', (v) => isWholeNumber(v) && v >= 1],
      ['diceMax', (v) => isWholeNumber(v) && v >= 1],
      ['startingCommon', isNonNegativeInt],
      ['goldenPrice', (v) => isWholeNumber(v) && v >= 1],
      ['plusAmount', isNonNegativeInt],
      ['minusAmount', isNonNegativeInt],
      ['inventoryLimit', (v) => isWholeNumber(v) && v >= 0],
      ['activeItemsPerTurn', (v) => isWholeNumber(v) && v >= 0],
      ['itemWindowMs', (v) => isWholeNumber(v) && v >= 0],
    ];
    for (const [key, check] of numericConfig) {
      if (!check((config as Record<string, unknown>)[key])) {
        errors.push(`config.${String(key)} inválido.`);
      }
    }
    if (state.config.diceMax < state.config.diceMin) errors.push('config: diceMax menor que diceMin.');
    if (!isObject(state.config.rewards)) {
      errors.push('config.rewards ausente.');
    } else {
      const { individual, teams } = state.config.rewards;
      for (const [label, group, keys] of [
        ['individual', individual, ['first', 'second', 'others']],
        ['teams', teams, ['winner', 'loser', 'draw']],
      ] as const) {
        if (!isObject(group)) {
          errors.push(`config.rewards.${label} ausente.`);
          continue;
        }
        for (const key of keys) {
          if (!isNonNegativeInt((group as Record<string, unknown>)[key])) {
            errors.push(`config.rewards.${label}.${key} inválido.`);
          }
        }
      }
    }
    if (!Array.isArray(state.config.shopItems)) {
      errors.push('config.shopItems precisa ser uma lista.');
    } else {
      for (const id of state.config.shopItems) {
        if (!(ITEM_IDS as readonly string[]).includes(id)) errors.push(`Item desconhecido na loja: ${String(id)}.`);
      }
    }
    if (!Array.isArray(state.config.minigameOrder)) errors.push('config.minigameOrder precisa ser uma lista.');

    /* ---------- mapa ---------- */
    if (!isObject(state.map) || !isObject((state.map as unknown as Record<string, unknown>).nodes)) {
      return fail('Mapa ausente ou sem casas.');
    }
    const nodeIds = Object.keys(state.map.nodes);
    if (nodeIds.length === 0) return fail('Mapa sem casas.');
    for (const id of nodeIds) {
      const node = (state.map.nodes as Record<string, unknown>)[id];
      if (!isObject(node)) {
        errors.push(`Casa ${id} não é um objeto.`);
        continue;
      }
      if (node.id !== id) errors.push(`Casa ${id} tem id divergente.`);
      if (!(NODE_KINDS as readonly string[]).includes(node.kind as string)) {
        errors.push(`Casa ${id} tem tipo desconhecido: ${String(node.kind)}.`);
      }
      if (typeof node.x !== 'number' || !Number.isFinite(node.x)) errors.push(`Casa ${id} sem coordenada x.`);
      if (typeof node.y !== 'number' || !Number.isFinite(node.y)) errors.push(`Casa ${id} sem coordenada y.`);
      if (!Array.isArray(node.next)) errors.push(`Casa ${id} sem lista de saídas.`);
    }
    if (errors.length > 0) return { ok: false, errors };

    if (!isNonEmptyString(state.map.startNodeId) || !state.map.nodes[state.map.startNodeId]) {
      errors.push('Casa inicial do mapa inexistente.');
    }
    if (!Array.isArray(state.map.pedestalSpots)) {
      errors.push('map.pedestalSpots precisa ser uma lista.');
    }
    const mapCheck = validateMap(state.map);
    if (!mapCheck.ok) errors.push(`Mapa inválido: ${mapCheck.errors[0]}`);
    if (!isNonEmptyString(state.pedestalNodeId) || !state.map.pedestalSpots.includes(state.pedestalNodeId)) {
      errors.push('Pedestal em casa inexistente.');
    }

    /* ---------- jogadores e ordem ---------- */
    if (!isObject(state.players)) return fail('Lista de jogadores ausente.');
    if (!Array.isArray(state.order) || state.order.length === 0) return fail('Ordem de jogadores vazia.');
    if (new Set(state.order).size !== state.order.length) errors.push('Ordem de jogadores tem repetições.');
    for (const id of state.order) {
      if (!isObject((state.players as Record<string, unknown>)[id])) {
        errors.push(`Jogador ${String(id)} referenciado mas ausente.`);
      }
    }
    if (!isWholeNumber(state.activeIndex) || state.activeIndex < 0 || state.activeIndex >= state.order.length) {
      errors.push('activeIndex fora da ordem de jogadores.');
    }
    if (!isWholeNumber(state.round) || state.round < 1) errors.push('round inválido.');
    if (isWholeNumber(state.round) && isWholeNumber(state.config?.rounds) && state.round > state.config.rounds) {
      errors.push('round maior que o total de rodadas.');
    }

    const seenItemUids = new Set<string>();
    for (const [id, raw] of Object.entries(state.players)) {
      if (!isObject(raw)) {
        errors.push(`Jogador ${id} não é um objeto.`);
        continue;
      }
      const player = raw as unknown as GameState['players'][string];
      if (player.id !== id) errors.push(`Jogador ${id} tem id divergente.`);
      if (!isNonEmptyString(player.name)) errors.push(`Jogador ${id} sem nome.`);
      // Saldo inválido inclui fracionário, NaN, infinito e negativo.
      if (!isNonNegativeInt(player.common)) errors.push(`Saldo de moedas inválido em ${id}.`);
      if (!isNonNegativeInt(player.golden)) errors.push(`Saldo de bananas de ouro inválido em ${id}.`);
      if (!isNonEmptyString(player.nodeId) || !state.map.nodes[player.nodeId]) {
        errors.push(`Jogador ${player.name ?? id} está numa casa inexistente.`);
      }
      if (!Array.isArray(player.inventory)) {
        errors.push(`Inventário de ${id} inválido.`);
      } else {
        if (isWholeNumber(state.config?.inventoryLimit) && player.inventory.length > state.config.inventoryLimit) {
          errors.push(`Inventário de ${id} acima do limite configurado.`);
        }
        for (const item of player.inventory) {
          if (!isObject(item)) {
            errors.push(`Item inválido no inventário de ${id}.`);
            continue;
          }
          if (!(ITEM_IDS as readonly string[]).includes(item.itemId as string)) {
            errors.push(`Item desconhecido em ${id}: ${String(item.itemId)}.`);
          }
          if (!isNonEmptyString(item.uid)) {
            errors.push(`Item sem identificador em ${id}.`);
          } else if (seenItemUids.has(item.uid)) {
            errors.push(`Identificador de item repetido: ${item.uid}.`);
          } else {
            seenItemUids.add(item.uid);
          }
        }
      }
      if (!Array.isArray(player.stepHistory)) {
        errors.push(`Histórico de passos de ${id} inválido.`);
      } else {
        for (const step of player.stepHistory) {
          if (!isNonEmptyString(step) || !state.map.nodes[step]) {
            errors.push(`Histórico de passos de ${id} aponta para casa inexistente.`);
            break;
          }
        }
      }
    }

    /* ---------- dado, movimento e decisão pendente ---------- */
    if (state.dice !== null && state.dice !== undefined && !isWholeNumber(state.dice)) {
      errors.push('Valor do dado inválido.');
    }
    if (state.diceMultiplier !== undefined && (!isWholeNumber(state.diceMultiplier) || state.diceMultiplier < 1)) {
      errors.push('Multiplicador do dado inválido.');
    }
    if (state.movement !== null && state.movement !== undefined) {
      const movement = state.movement as unknown;
      if (!isObject(movement)) {
        errors.push('Movimento em curso inválido.');
      } else {
        if (!isNonNegativeInt(movement.remaining)) errors.push('Passos restantes inválidos.');
        if (!Array.isArray(movement.traversed)) errors.push('Percurso do movimento inválido.');
        if (typeof movement.activatesSpaces !== 'boolean') errors.push('Movimento sem indicação de ativação de casas.');
        if (movement.direction !== 'forward' && movement.direction !== 'back') {
          errors.push('Direção de movimento inválida.');
        }
      }
    }

    if (state.movement?.transit) {
      const t = state.movement.transit;
      const stop = state.map.stops?.find(s => s.id === t.stopId);
      const actor = state.players[state.order[state.activeIndex]];
      if (!stop || stop.from !== actor?.nodeId || stop.to !== t.to || state.movement.direction !== 'forward' || (!state.movement.activatesSpaces && !(state.movement.teleport===true&&stop.kind==='tree')) || state.movement.remaining < 1) errors.push('Travessia pendente inválida.');
      if (state.pending && !['shop', 'pedestal', 'harvest','iagugu'].includes(state.pending.kind)) errors.push('Travessia incompatível com a decisão.');
      if ((state.pending?.kind === 'shop' || state.pending?.kind === 'pedestal') && state.pending.nodeId !== t.stopId) errors.push('Decisão aponta para outra parada.');
    }
    if (state.cardDecks !== undefined) {
      if (!isObject(state.cardDecks)) errors.push('Baralhos inválidos.');
      else for (const category of ['luck', 'unluck'] as const) {
        const deck = state.cardDecks[category];
        if (deck !== undefined && (!Array.isArray(deck) || deck.some(id => typeof id !== 'string' || CARDS_BY_ID[id]?.category !== category) || deck.some(id=>deck.filter(x=>x===id).length>(CARDS_BY_ID[id]?.weight??1)))) errors.push('Baralho digital inválido.');
      }
    }
    if (state.diceBonus !== undefined && state.diceBonus !== 5) errors.push('Bônus de dado inválido.');
    if (state.chosenDice !== undefined && (!isWholeNumber(state.chosenDice) || state.chosenDice < state.config.diceMin || state.chosenDice > state.config.diceMax)) errors.push('Dado escolhido inválido.');

    const pendingErrors = validatePending(state);
    errors.push(...pendingErrors);

    if (state.pending && !PHASES_REQUIRING_PENDING.includes(state.phase)) {
      errors.push(`A fase ${state.phase} não pode ter decisão pendente.`);
    }
    if (!state.pending && PHASES_REQUIRING_PENDING.includes(state.phase)) {
      errors.push(`A fase ${state.phase} exige uma decisão pendente.`);
    }

    /* ---------- janela de item ---------- */
    if (state.itemWindow !== null && state.itemWindow !== undefined) {
      const window = state.itemWindow as unknown;
      if (!isObject(window)) {
        errors.push('Janela de item inválida.');
      } else {
        if (!isNonEmptyString(window.playerId) || !state.players[window.playerId as string]) {
          errors.push('Janela de item aponta para jogador inexistente.');
        }
        if (!isNonNegativeInt(window.remainingMs)) errors.push('Tempo restante da janela de item inválido.');
      }
    }

    /* ---------- prova e resultados ---------- */
    if (state.minigame !== null && state.minigame !== undefined) {
      const minigame = state.minigame as unknown;
      if (!isObject(minigame)) {
        errors.push('Prova ativa inválida.');
      } else {
        if (!isNonEmptyString(minigame.minigameId)) errors.push('Prova ativa sem identificador.');
        if (typeof minigame.applied !== 'boolean') errors.push('Prova ativa sem marca de premiação.');
        if (!Array.isArray(minigame.teams)) {
          errors.push('Equipes da prova inválidas.');
        } else {
          const flat: string[] = [];
          for (const team of minigame.teams as unknown[]) {
            if (!Array.isArray(team)) {
              errors.push('Equipe da prova não é uma lista.');
              continue;
            }
            for (const id of team) {
              if (!isNonEmptyString(id) || !state.players[id]) {
                errors.push(`Equipe da prova cita jogador inexistente: ${String(id)}.`);
              } else {
                flat.push(id);
              }
            }
          }
          if (new Set(flat).size !== flat.length) errors.push('Jogador repetido nas equipes da prova.');
        }
      }
    }
    if (!Array.isArray(state.results)) {
      errors.push('Lista de resultados inválida.');
    } else {
      for (const result of state.results as unknown[]) {
        if (!isObject(result)) {
          errors.push('Resultado de prova inválido.');
          continue;
        }
        if (!isWholeNumber(result.round)) errors.push('Resultado de prova sem rodada.');
        if (!isObject(result.awards)) {
          errors.push('Resultado de prova sem premiação.');
          continue;
        }
        for (const [id, amount] of Object.entries(result.awards)) {
          if (!state.players[id]) errors.push(`Premiação registrada para jogador inexistente: ${id}.`);
          if (!isNonNegativeInt(amount)) errors.push(`Premiação inválida para ${id}.`);
        }
      }
    }
    if (!Array.isArray(state.history)) errors.push('Histórico inválido.');

    return { ok: errors.length === 0, errors };
  } catch (error) {
    // Nenhuma estrutura malformada deve escapar como exceção.
    return { ok: false, errors: [`Estado ilegível: ${(error as Error).message}`] };
  }
}

function validatePending(state: GameState): string[] {
  const pending = state.pending as unknown;
  if (pending === null || pending === undefined) return [];
  if (!isObject(pending)) return ['Decisão pendente inválida.'];

  const errors: string[] = [];
  const kind = pending.kind as string;
  if (!(PENDING_KINDS as readonly string[]).includes(kind)) {
    return [`Decisão pendente de tipo desconhecido: ${String(kind)}.`];
  }

  const requirePlayer = (id: unknown, label: string) => {
    if (!isNonEmptyString(id) || !state.players[id]) {
      errors.push(`${label} da decisão pendente aponta para jogador inexistente.`);
    }
  };
  const requireNode = (id: unknown, label: string) => {
    if (!isNonEmptyString(id) || !(state.map.nodes[id] || state.map.stops?.some(s => s.id === id))) {
      errors.push(`${label} da decisão pendente aponta para casa inexistente.`);
    }
  };

  switch (kind) {
    case 'discardPower':
      requirePlayer(pending.playerId,'Jogador');
      if(!isObject(pending.incoming)||!isNonEmptyString(pending.incoming.uid)||!(ITEM_IDS as readonly unknown[]).includes(pending.incoming.itemId))errors.push('Poder recebido inválido.');
      break;
    case 'iagugu':
      requirePlayer(pending.playerId, 'Jogador');
      if (pending.playerId!==state.order[state.activeIndex] || state.movement?.transit?.stopId!==pending.nodeId || !state.map.stops?.some(s=>s.id===pending.nodeId&&s.kind==='iagugu')) errors.push('Visita ao Iagugu inválida.');
      break;
    case 'duelBet': case 'duelResult': {
      requirePlayer(pending.playerId,'Jogador'); requirePlayer(pending.opponentId,'Adversário');
      if(pending.playerId===pending.opponentId || pending.playerId!==state.order[state.activeIndex] || state.movement) errors.push('Participantes do duelo inválidos.');
      const value=kind==='duelBet'?pending.maxBet:pending.bet;
      if(!isNonNegativeInt(value)) errors.push('Aposta inválida.');
      else if(typeof pending.playerId==='string' && typeof pending.opponentId==='string' && value>Math.min(state.players[pending.playerId]?.common??-1,state.players[pending.opponentId]?.common??-1)) errors.push('Aposta maior que o saldo.');
      if(pending.allIn!==true && typeof pending.playerId==='string' && state.map.nodes[state.players[pending.playerId]?.nodeId]?.kind!=='duel') errors.push('Duelo fora de uma casa de duelo.');
      break;
    }

    case 'harvest':
      requirePlayer(pending.playerId, 'Jogador');
      if (!state.map.stops?.some(s => s.id === pending.treeId && s.kind === 'tree') || !state.map.stops?.some(s => s.id === pending.nextTreeId && s.kind === 'tree') || pending.nextTreeId !== state.pedestalNodeId || pending.treeId === pending.nextTreeId || !state.goldenBoughtThisTurn || state.movement?.transit?.stopId !== pending.treeId) errors.push('Colheita pendente inválida.');
      break;
    case 'chooseDice': case 'stealItem': {
      requirePlayer(pending.playerId, 'Jogador');
      const player = typeof pending.playerId === 'string' ? state.players[pending.playerId] : undefined;
      if (!player?.inventory.some(i => i.uid === pending.uid && i.itemId === (kind === 'chooseDice' ? 'dadoCerteiro' : 'maoNoBolso'))) errors.push('Poder pendente inválido.');
      if (kind === 'stealItem' && (!Array.isArray(pending.candidates) || !pending.candidates.length || pending.candidates.some(id => typeof id !== 'string' || id === pending.playerId || !state.players[id]?.inventory.length))) errors.push('Alvos de roubo inválidos.');
      break;
    }
    case 'path':
      requirePlayer(pending.playerId, 'Jogador');
      if (!Array.isArray(pending.options) || pending.options.length < 2) {
        errors.push('Bifurcação pendente sem opções suficientes.');
      } else {
        for (const option of pending.options) requireNode(option, 'Caminho');
      }
      break;
    case 'shop':
      requirePlayer(pending.playerId, 'Jogador');
      if (state.map.stops && (state.movement?.transit?.stopId !== pending.nodeId || !state.map.stops.some(s => s.id === pending.nodeId && s.kind === 'shop'))) errors.push('Visita à loja inválida.');
      requireNode(pending.nodeId, 'Loja');
      if (!Array.isArray(pending.items) || pending.items.length === 0) {
        errors.push('Loja pendente sem itens.');
      } else {
        for (const id of pending.items) {
          if (!(ITEM_IDS as readonly string[]).includes(id as string)) {
            errors.push(`Loja pendente com item desconhecido: ${String(id)}.`);
          }
        }
      }
      break;
    case 'pedestal':
      requirePlayer(pending.playerId, 'Jogador');
      if (state.map.stops && (state.movement?.transit?.stopId !== pending.nodeId || pending.nodeId !== state.pedestalNodeId)) errors.push('Visita à árvore inválida.');
      requireNode(pending.nodeId, 'Pedestal');
      if (!isNonNegativeInt(pending.price)) errors.push('Preço pendente da banana de ouro inválido.');
      break;
    case 'cardCode':
      requirePlayer(pending.playerId, 'Jogador');
      if (!(CARD_CATEGORIES as readonly string[]).includes(pending.category as string)) {
        errors.push('Baralho pendente desconhecido.');
      }
      break;
    case 'cardPreview':
      requirePlayer(pending.playerId, 'Jogador');
      if (!isNonEmptyString(pending.cardId)) errors.push('Prévia de carta sem identificador.');
      if (!(CARD_CATEGORIES as readonly string[]).includes(pending.category as string)) {
        errors.push('Baralho da prévia de carta desconhecido.');
      }
      break;
    case 'target': {
      requirePlayer(pending.playerId, 'Jogador');
      if (!isNonNegativeInt(pending.amount)) errors.push('Valor do ataque pendente inválido.');
      if (!Array.isArray(pending.candidates) || pending.candidates.length === 0) {
        errors.push('Ataque pendente sem alvos possíveis.');
      } else {
        for (const id of pending.candidates) requirePlayer(id, 'Alvo');
      }
      if (pending.resume !== 'readyToRoll' && pending.resume !== 'turnEnd') {
        errors.push('Retomada do ataque pendente inválida.');
      }
      if (!validateAttackSource(state, pending.source)) errors.push('Origem do ataque pendente inválida.');
      break;
    }
    case 'defense': {
      requirePlayer(pending.attackerId, 'Atacante');
      requirePlayer(pending.targetId, 'Alvo');
      if (!isNonNegativeInt(pending.amount)) errors.push('Valor da defesa pendente inválido.');
      if (!Array.isArray(pending.options) || pending.options.length === 0) {
        errors.push('Defesa pendente sem itens disponíveis.');
      } else if (isNonEmptyString(pending.targetId) && state.players[pending.targetId]) {
        const owned = new Set(state.players[pending.targetId].inventory.map((it) => it.uid));
        for (const option of pending.options as unknown[]) {
          if (!isObject(option) || !isNonEmptyString(option.uid) || !owned.has(option.uid)) {
            errors.push('Defesa pendente cita item que o alvo não possui.');
            break;
          }
        }
      }
      if (pending.resume !== 'readyToRoll' && pending.resume !== 'turnEnd') {
        errors.push('Retomada da defesa pendente inválida.');
      }
      if (!validateAttackSource(state, pending.source)) errors.push('Origem da defesa pendente inválida.');
      break;
    }
    case 'itemChoice':
      requirePlayer(pending.playerId, 'Jogador');
      break;
  }
  return errors;
}

function validateAttackSource(state: GameState, source: unknown): boolean {
  if (!isObject(source)) return false;
  if (source.type === 'card') return isNonEmptyString(source.cardId);
  if (source.type === 'item') {
    if (!isNonEmptyString(source.uid)) return false;
    // O item da origem precisa existir em algum inventário até ser consumido.
    return Object.values(state.players).some((player) =>
      player.inventory.some((item) => item.uid === source.uid),
    );
  }
  return false;
}
