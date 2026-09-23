import { describe, expect, it } from 'vitest';
import { CARDS_BY_ID } from '../data/cards';
import { ITEMS } from '../data/config';
import { createDefaultMap, validateMap } from '../data/map';
import {
  activePlayer,
  applyCommand,
  createGame,
  nextAutoCommand,
  ranking,
  type PlayerSeed,
} from './engine';
import type { Command, GameState } from './types';

function seeds(count: number): PlayerSeed[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `p${i}`,
    name: `G${i}`,
    color: '#fff',
    symbol: '★',
    portrait: 'x.png',
  }));
}

function game(count = 8, overrides = {}): GameState {
  return createGame(seeds(count), { rounds: 2, ...overrides }, { seed: 1234, shuffleOrder: false });
}

/** Aplica um comando e falha o teste se for rejeitado. */
function run(state: GameState, command: Command): GameState {
  const result = applyCommand(state, {
    commandId: `t-${state.revision}`,
    expectedRevision: state.revision,
    command,
  });
  if (result.rejected) throw new Error(`Comando ${command.type} rejeitado: ${result.rejected}`);
  return result.state;
}

function tryRun(state: GameState, command: Command) {
  return applyCommand(state, {
    commandId: `t-${state.revision}`,
    expectedRevision: state.revision,
    command,
  });
}

/** Avança automaticamente, resolvendo decisões com uma estratégia simples. */
function autoplay(state: GameState, maxSteps = 4000): GameState {
  let steps = 0;
  while (steps++ < maxSteps) {
    if (state.pending) {
      state = resolvePending(state);
      continue;
    }
    const command = nextAutoCommand(state);
    if (!command) return state;
    state = run(state, command);
  }
  throw new Error('autoplay não convergiu');
}

function resolvePending(state: GameState): GameState {
  const pending = state.pending!;
  switch (pending.kind) {
    case 'path':
      return run(state, { type: 'choosePath', nodeId: pending.options[0] });
    case 'shop':
      return run(state, { type: 'skipShop' });
    case 'pedestal':
      return run(state, { type: 'buyGolden' });
    case 'cardCode':
      return run(state, { type: 'submitCardCode', code: pending.category === 'luck' ? 'S01' : 'A01' });
    case 'cardPreview':
      return run(state, { type: 'confirmCard' });
    case 'target':
      return run(state, { type: 'chooseTarget', targetId: pending.candidates[0] });
    case 'defense':
      return run(state, { type: 'resolveDefense', choice: 'none' });
    case 'itemChoice':
      return run(state, { type: 'cancelItemChoice' });
  }
}

describe('mapa', () => {
  it('tem 36 casas, duas bifurcações e grafo válido', () => {
    const map = createDefaultMap();
    expect(Object.keys(map.nodes)).toHaveLength(36);
    const forks = Object.values(map.nodes).filter((n) => n.next.length > 1);
    expect(forks).toHaveLength(2);
    expect(validateMap(map).ok).toBe(true);
  });

  it('detecta grafo inválido', () => {
    const map = createDefaultMap();
    map.nodes.m0.next = ['inexistente'];
    expect(validateMap(map).ok).toBe(false);
  });
});

describe('sequência de turnos', () => {
  it('conduz 8 turnos e chega a exatamente um minigame', () => {
    let state = run(game(8), { type: 'startRound' });
    state = autoplay(state);
    expect(state.phase).toBe('minigameIntro');
    expect(state.activeIndex).toBe(7);
    expect(state.minigame).not.toBeNull();
    expect(state.results).toHaveLength(0);
  });

  it('funciona igual com 10 participantes', () => {
    let state = run(game(10), { type: 'startRound' });
    state = autoplay(state);
    expect(state.phase).toBe('minigameIntro');
    expect(state.activeIndex).toBe(9);
  });

  it('a próxima rodada exige clique explícito', () => {
    let state = run(game(8), { type: 'startRound' });
    state = autoplay(state);
    state = run(state, { type: 'startMinigame' });
    state = run(state, { type: 'submitResults', resultId: 'r1', format: 'teams', winningTeam: 0 });
    expect(state.phase).toBe('roundEnd');
    // Nenhum comando automático avança a partir daqui.
    expect(nextAutoCommand(state)).toBeNull();
    state = run(state, { type: 'nextRound' });
    expect(state.phase).toBe('roundReady');
    expect(state.round).toBe(2);
  });
});

describe('dado e movimento', () => {
  it('rola uma única vez e conta exatamente os passos', () => {
    let state = run(game(2), { type: 'startRound' });
    state = run(state, { type: 'beginTurn' });
    state = run(state, { type: 'rollDice' });
    const dice = state.dice!;
    expect(dice).toBeGreaterThanOrEqual(1);
    expect(dice).toBeLessThanOrEqual(10);
    // Rolar de novo é rejeitado.
    expect(tryRun(state, { type: 'rollDice' }).rejected).toBeTruthy();

    let moved = 0;
    while (state.phase === 'moving' || state.phase === 'awaitingPath') {
      if (state.phase === 'awaitingPath') {
        state = resolvePending(state);
      } else {
        state = run(state, { type: 'step' });
      }
      moved = state.players.p0.stepHistory.length;
    }
    expect(moved).toBe(dice);
  });

  it('bifurcação pausa e nunca escolhe sozinha', () => {
    let state = game(2);
    state.players.p0.nodeId = 'm4'; // nó com duas saídas
    state = run(state, { type: 'startRound' });
    state = run(state, { type: 'beginTurn' });
    state = run(state, { type: 'rollDice' });
    state = run(state, { type: 'step' });
    expect(state.phase).toBe('awaitingPath');
    expect(nextAutoCommand(state)).toBeNull();
    expect(state.pending).toMatchObject({ kind: 'path', options: ['m5', 'a0'] });
    state = run(state, { type: 'choosePath', nodeId: 'a0' });
    expect(state.players.p0.nodeId).toBe('a0');
  });

  it('casa boa e casa ruim aplicam o valor configurado', () => {
    let state = game(2);
    state.players.p0.nodeId = 'm0';
    state.phase = 'resolvingSpace';
    const target = Object.values(state.map.nodes).find((n) => n.kind === 'plus')!;
    state.players.p0.nodeId = target.id;
    const before = state.players.p0.common;
    state = run(state, { type: 'resolveSpace' });
    expect(state.players.p0.common).toBe(before + state.config.plusAmount);
  });

  it('saldo nunca fica negativo', () => {
    let state = game(2);
    state.players.p0.common = 1;
    const minus = Object.values(state.map.nodes).find((n) => n.kind === 'minus')!;
    state.players.p0.nodeId = minus.id;
    state.phase = 'resolvingSpace';
    state = run(state, { type: 'resolveSpace' });
    expect(state.players.p0.common).toBe(0);
  });
});

describe('janela de item', () => {
  it('não abre para quem não tem item utilizável', () => {
    let state = run(game(2), { type: 'startRound' });
    state = run(state, { type: 'beginTurn' });
    expect(state.phase).toBe('readyToRoll');
    expect(state.itemWindow).toBeNull();
  });

  it('não abre para quem só tem item defensivo', () => {
    let state = game(2);
    state.players.p0.inventory = [{ uid: 'a', itemId: 'escudo' }];
    state = run(state, { type: 'startRound' });
    state = run(state, { type: 'beginTurn' });
    expect(state.phase).toBe('readyToRoll');
  });

  it('abre para item ativo e Usar carta suspende o prazo', () => {
    let state = game(2);
    state.players.p0.inventory = [{ uid: 'a', itemId: 'dadoDuplo' }];
    state = run(state, { type: 'startRound' });
    state = run(state, { type: 'beginTurn' });
    expect(state.phase).toBe('itemWindow');
    expect(state.itemWindow?.remainingMs).toBe(5000);
    state = run(state, { type: 'requestItemChoice' });
    expect(state.phase).toBe('awaitingItemChoice');
    expect(state.itemWindow).toBeNull();
    // Decisão aberta não expira: nada automático acontece.
    expect(nextAutoCommand(state)).toBeNull();
  });

  it('cancelar a escolha segue para o dado sem reiniciar a janela', () => {
    let state = game(2);
    state.players.p0.inventory = [{ uid: 'a', itemId: 'casca' }];
    state = run(state, { type: 'startRound' });
    state = run(state, { type: 'beginTurn' });
    state = run(state, { type: 'requestItemChoice' });
    state = run(state, { type: 'cancelItemChoice' });
    expect(state.phase).toBe('readyToRoll');
    expect(state.itemWindow).toBeNull();
    expect(state.players.p0.inventory).toHaveLength(1);
  });

  it('uso tardio é rejeitado depois que a fase mudou para rolagem', () => {
    let state = game(2);
    state.players.p0.inventory = [{ uid: 'a', itemId: 'dadoDuplo' }];
    state = run(state, { type: 'startRound' });
    state = run(state, { type: 'beginTurn' });
    state = run(state, { type: 'itemWindowExpired' });
    expect(state.phase).toBe('readyToRoll');
    expect(tryRun(state, { type: 'requestItemChoice' }).rejected).toBeTruthy();
  });

  it('dado duplo dobra o resultado e é consumido uma vez', () => {
    let state = game(2);
    state.players.p0.inventory = [{ uid: 'a', itemId: 'dadoDuplo' }];
    state = run(state, { type: 'startRound' });
    state = run(state, { type: 'beginTurn' });
    state = run(state, { type: 'requestItemChoice' });
    state = run(state, { type: 'useItem', uid: 'a' });
    expect(state.diceMultiplier).toBe(2);
    expect(state.players.p0.inventory).toHaveLength(0);
    state = run(state, { type: 'rollDice' });
    expect(state.dice! % 2).toBe(0);
    expect(state.diceMultiplier).toBe(1);
  });
});

describe('loja e pedestal', () => {
  it('compra debita e entrega atomicamente', () => {
    let state = game(2);
    state.pending = { kind: 'shop', playerId: 'p0', nodeId: 'm6', items: ['escudo'] };
    state.phase = 'awaitingInteraction';
    state = run(state, { type: 'buyItem', itemId: 'escudo' });
    expect(state.players.p0.common).toBe(10 - ITEMS.escudo.price);
    expect(state.players.p0.inventory).toHaveLength(1);
  });

  it('recusa compra com inventário cheio', () => {
    let state = game(2);
    state.players.p0.inventory = [
      { uid: '1', itemId: 'escudo' }, { uid: '2', itemId: 'escudo' }, { uid: '3', itemId: 'escudo' },
    ];
    state.pending = { kind: 'shop', playerId: 'p0', nodeId: 'm6', items: ['escudo'] };
    state.phase = 'awaitingInteraction';
    expect(tryRun(state, { type: 'buyItem', itemId: 'escudo' }).rejected).toBeTruthy();
  });

  it('cancelar não cobra', () => {
    let state = game(2);
    state.pending = { kind: 'shop', playerId: 'p0', nodeId: 'm6', items: ['escudo'] };
    state.phase = 'awaitingInteraction';
    state = run(state, { type: 'skipShop' });
    expect(state.players.p0.common).toBe(10);
  });

  it('loja e pedestal ativam por passagem, não só na chegada', () => {
    let state = game(2);
    state.players.p0.nodeId = 'm5'; // casa anterior à loja (m6)
    state.players.p0.common = 40;
    state = run(state, { type: 'startRound' });
    state = run(state, { type: 'beginTurn' });
    state = run(state, { type: 'rollDice' });
    const dice = state.dice!;
    state = run(state, { type: 'step' });
    expect(state.pending?.kind).toBe('shop');
    expect(state.movement!.remaining).toBe(dice - 1);
  });

  it('compra da dourada realoca o pedestal e limita a uma por turno', () => {
    let state = game(2);
    state.players.p0.common = 60;
    const original = state.pedestalNodeId;
    state.pending = { kind: 'pedestal', playerId: 'p0', nodeId: original, price: 20 };
    state.phase = 'awaitingInteraction';
    state = run(state, { type: 'buyGolden' });
    expect(state.players.p0.golden).toBe(1);
    expect(state.players.p0.common).toBe(40);
    expect(state.pedestalNodeId).not.toBe(original);
    expect(state.goldenBoughtThisTurn).toBe(true);

    state.pending = { kind: 'pedestal', playerId: 'p0', nodeId: state.pedestalNodeId, price: 20 };
    state.phase = 'awaitingInteraction';
    expect(tryRun(state, { type: 'buyGolden' }).rejected).toBeTruthy();
  });

  it('pedestal sem saldo vira aviso e não modal', () => {
    let state = game(2);
    state.players.p0.common = 3;
    state.players.p0.nodeId = previousOf(state, state.pedestalNodeId);
    state = run(state, { type: 'startRound' });
    state = run(state, { type: 'beginTurn' });
    state = run(state, { type: 'rollDice' });
    state = run(state, { type: 'step' });
    expect(state.pending).toBeNull();
    expect(state.notice).toContain('pedestal');
  });
});

function previousOf(state: GameState, nodeId: string): string {
  return Object.values(state.map.nodes).find((n) => n.next[0] === nodeId)!.id;
}

describe('cartas físicas', () => {
  it('aceita código válido, mostra prévia e aplica uma vez', () => {
    let state = game(2);
    state.pending = { kind: 'cardCode', playerId: 'p0', category: 'luck' };
    state.phase = 'awaitingInteraction';
    expect(tryRun(state, { type: 'submitCardCode', code: 'ZZZ' }).rejected).toBeTruthy();
    // Carta do baralho errado é recusada.
    expect(tryRun(state, { type: 'submitCardCode', code: 'A01' }).rejected).toBeTruthy();
    state = run(state, { type: 'submitCardCode', code: 's01' });
    expect(state.pending).toMatchObject({ kind: 'cardPreview', cardId: 'S01' });
    state = run(state, { type: 'confirmCard' });
    expect(state.players.p0.common).toBe(10 + CARDS_BY_ID.S01.amount);
    // Confirmar de novo não faz nada.
    expect(tryRun(state, { type: 'confirmCard' }).rejected).toBeTruthy();
  });

  it('recuo segue o histórico real e não ativa o destino', () => {
    let state = game(2);
    state.players.p0.stepHistory = ['m0', 'm1', 'm2'];
    state.players.p0.nodeId = 'm3';
    state.pending = { kind: 'cardPreview', playerId: 'p0', cardId: 'A02', category: 'unluck' };
    state.phase = 'awaitingInteraction';
    const before = state.players.p0.common;
    state = run(state, { type: 'confirmCard' });
    while (state.phase === 'moving') state = run(state, { type: 'step' });
    expect(state.players.p0.nodeId).toBe('m0');
    expect(state.phase).toBe('turnEnd');
    expect(state.players.p0.common).toBe(before); // destino não ativado
  });

  it('sem histórico suficiente o recuo para no início', () => {
    let state = game(2);
    state.players.p0.stepHistory = [];
    state.players.p0.nodeId = 'm7';
    state.pending = { kind: 'cardPreview', playerId: 'p0', cardId: 'A02', category: 'unluck' };
    state.phase = 'awaitingInteraction';
    state = run(state, { type: 'confirmCard' });
    while (state.phase === 'moving') state = run(state, { type: 'step' });
    expect(state.players.p0.nodeId).toBe(state.map.startNodeId);
  });
});

describe('ataque, defesa e reverse', () => {
  function attackState() {
    let state = game(3);
    state.players.p0.inventory = [{ uid: 'casca1', itemId: 'casca' }];
    state = run(state, { type: 'startRound' });
    state = run(state, { type: 'beginTurn' });
    state = run(state, { type: 'requestItemChoice' });
    return run(state, { type: 'useItem', uid: 'casca1' });
  }

  it('ataque sem defesa possível não pede confirmação de defesa', () => {
    let state = attackState();
    expect(state.pending?.kind).toBe('target');
    state = run(state, { type: 'chooseTarget', targetId: 'p1' });
    expect(state.pending).toBeNull();
    expect(state.players.p1.common).toBe(7);
    expect(state.players.p0.inventory).toHaveLength(0);
    expect(state.phase).toBe('readyToRoll');
  });

  it('escudo bloqueia sem transferir nada e é consumido uma vez', () => {
    let state = attackState();
    state.players.p1.inventory = [{ uid: 'esc1', itemId: 'escudo' }];
    state = run(state, { type: 'chooseTarget', targetId: 'p1' });
    expect(state.pending?.kind).toBe('defense');
    state = run(state, { type: 'resolveDefense', choice: 'block', uid: 'esc1' });
    expect(state.players.p1.common).toBe(10);
    expect(state.players.p1.inventory).toHaveLength(0);
    expect(state.players.p0.inventory).toHaveLength(0);
    // Resolver de novo é rejeitado: defesa não é consumida duas vezes.
    expect(tryRun(state, { type: 'resolveDefense', choice: 'block', uid: 'esc1' }).rejected).toBeTruthy();
  });

  it('reverse devolve o ataque e não inicia cadeia', () => {
    let state = attackState();
    state.players.p1.inventory = [{ uid: 'rev1', itemId: 'reverse' }];
    state.players.p0.inventory.push({ uid: 'esc0', itemId: 'escudo' });
    state = run(state, { type: 'chooseTarget', targetId: 'p1' });
    state = run(state, { type: 'resolveDefense', choice: 'reverse', uid: 'rev1' });
    expect(state.players.p1.common).toBe(10);
    expect(state.players.p0.common).toBe(7);
    // O atacante não recebeu uma nova decisão de defesa.
    expect(state.pending).toBeNull();
    // O escudo do atacante continua intacto: não houve segunda rodada de defesa.
    expect(state.players.p0.inventory.map((i) => i.uid)).toContain('esc0');
  });

  it('desistir do alvo não consome o item', () => {
    let state = attackState();
    state = run(state, { type: 'cancelTarget' });
    expect(state.players.p0.inventory).toHaveLength(1);
    expect(state.phase).toBe('readyToRoll');
  });
});

describe('minigame e premiação', () => {
  function atResults(format: 'individual' | 'teams') {
    let state = game(8, { minigameOrder: [format === 'teams' ? 'beerpong' : 'pontaria', 'quiz'] });
    state = run(state, { type: 'startRound' });
    state = autoplay(state);
    return run(state, { type: 'startMinigame' });
  }

  it('empate individual usa 1º, 1º, 3º', () => {
    let state = atResults('individual');
    const before = { ...Object.fromEntries(state.order.map((id) => [id, state.players[id].common])) };
    state = run(state, {
      type: 'submitResults',
      resultId: 'r1',
      format: 'individual',
      ranking: [['p0', 'p1'], ['p2']],
    });
    const r = state.config.rewards.individual;
    expect(state.players.p0.common).toBe(before.p0 + r.first);
    expect(state.players.p1.common).toBe(before.p1 + r.first);
    // p2 ocupa a 3ª posição, então recebe o prêmio de "demais".
    expect(state.players.p2.common).toBe(before.p2 + r.others);
  });

  it('confirmar duas vezes não duplica a recompensa', () => {
    let state = atResults('teams');
    const before = state.players.p0.common;
    state = run(state, { type: 'submitResults', resultId: 'r1', format: 'teams', winningTeam: 0 });
    const after = state.players.p0.common;
    expect(after).toBe(before + state.config.rewards.teams.winner);
    const again = tryRun(state, { type: 'submitResults', resultId: 'r2', format: 'teams', winningTeam: 0 });
    expect(again.rejected).toBeTruthy();
    expect(state.players.p0.common).toBe(after);
  });

  it('equipes com número ímpar não excluem ninguém', () => {
    let state = game(9, { minigameOrder: ['beerpong'] });
    state = run(state, { type: 'startRound' });
    state = autoplay(state);
    const flat = state.minigame!.teams.flat();
    expect(flat.sort()).toEqual([...state.order].sort());
  });

  it('empate entre equipes usa a recompensa de empate', () => {
    let state = atResults('teams');
    const before = state.players.p0.common;
    state = run(state, { type: 'submitResults', resultId: 'r1', format: 'teams', winningTeam: -1 });
    expect(state.players.p0.common).toBe(before + state.config.rewards.teams.draw);
  });
});

describe('classificação', () => {
  it('ordena por douradas antes de bananas comuns', () => {
    const state = game(3);
    state.players.p0.common = 50;
    state.players.p1.golden = 1;
    state.players.p1.common = 0;
    expect(ranking(state)[0].id).toBe('p1');
  });
});

describe('revisão e duplicidade', () => {
  it('rejeita comandos com revisão antiga (callback antigo / clique duplo)', () => {
    let state = run(game(2), { type: 'startRound' });
    const stale = state.revision - 1;
    const result = applyCommand(state, {
      commandId: 'x',
      expectedRevision: stale,
      command: { type: 'beginTurn' },
    });
    expect(result.rejected).toBeTruthy();
    expect(result.state).toBe(state);
  });

  it('a revisão avança exatamente uma vez por comando aceito', () => {
    let state = game(2);
    const before = state.revision;
    state = run(state, { type: 'startRound' });
    expect(state.revision).toBe(before + 1);
  });
});

describe('partida completa', () => {
  it('vai do início ao fim sem manipular o estado diretamente', () => {
    let state = game(8, { rounds: 2 });
    for (let round = 1; round <= 2; round++) {
      state = run(state, { type: 'startRound' });
      state = autoplay(state);
      expect(state.phase).toBe('minigameIntro');
      state = run(state, { type: 'startMinigame' });
      const format = state.minigame!.teams.length ? 'teams' : 'individual';
      state = run(state, {
        type: 'submitResults',
        resultId: `r${round}`,
        format,
        winningTeam: format === 'teams' ? 0 : undefined,
        ranking: format === 'individual' ? [[state.order[0]], [state.order[1]]] : undefined,
      });
      expect(state.phase).toBe('roundEnd');
      state = run(state, { type: 'nextRound' });
    }
    expect(state.phase).toBe('finished');
    expect(state.results).toHaveLength(2);
    expect(activePlayer(state)).not.toBeNull();
  });
});
