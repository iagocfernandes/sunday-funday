import type { GameConfig, ItemDef, ItemId, MinigameDef } from '../game/types';

/**
 * TODOS os valores aqui são PROPOSTAS de teste, não regras aprovadas.
 * Exceção: a janela de 5 s para itens ativos é decisão confirmada.
 */
export const DEFAULT_CONFIG: GameConfig = {
  rounds: 8,
  diceMin: 1,
  diceMax: 10,
  startingCommon: 10,
  goldenPrice: 20,
  plusAmount: 3,
  minusAmount: 3,
  inventoryLimit: 3,
  activeItemsPerTurn: 1,
  itemWindowMs: 5000, // confirmado
  thiefEnabled: false, // desligado no primeiro ciclo, conforme o plano
  rewards: {
    individual: { first: 10, second: 6, others: 3 },
    teams: { winner: 8, loser: 3, draw: 5 },
  },
  shopItems: ['dadoDuplo', 'escudo', 'casca', 'reverse'],
  minigameOrder: [],
  cardMode: 'physical',
};

export const ITEMS: Record<ItemId, ItemDef> = {
  dadoDuplo: {
    id: 'dadoDuplo',
    name: 'Dado duplo',
    price: 5,
    description: 'Dobra o resultado do próximo dado deste turno.',
    usage: 'active',
    icon: '🎲',
  },
  escudo: {
    id: 'escudo',
    name: 'Escudo',
    price: 5,
    description: 'Bloqueia um ataque recebido. Consumido ao bloquear.',
    usage: 'defensive',
    icon: '🛡️',
  },
  casca: {
    id: 'casca',
    name: 'Casca de banana',
    price: 4,
    description: 'Alvo perde até 3 moedas.',
    usage: 'active',
    icon: '🍌',
  },
  reverse: {
    id: 'reverse',
    name: 'Reverse',
    price: 6,
    description: 'Devolve um ataque ao atacante. Não gera nova corrente.',
    usage: 'defensive',
    icon: '↩️',
  },
};

export const MINIGAMES: MinigameDef[] = [
  {
    id: 'beerpong',
    name: 'Beerpong',
    format: 'teams',
    description: 'Duplas se enfrentam. Alternativa sem álcool disponível.',
    icon: '🥤',
  },
  {
    id: 'pontaria',
    name: 'Pontaria da banana',
    format: 'individual',
    description: 'Cada gorila arremessa; melhor pontuação vence.',
    icon: '🎯',
  },
  {
    id: 'cabo-de-guerra',
    name: 'Cabo de guerra',
    format: 'teams',
    description: 'Duas equipes puxam a corda. Sem contato físico entre pessoas.',
    icon: '🪢',
  },
  {
    id: 'quiz',
    name: 'Quiz do gorilão',
    format: 'individual',
    description: 'Perguntas rápidas sobre a turma.',
    icon: '❓',
  },
  {
    id: 'equilibrio',
    name: 'Equilíbrio da banana',
    format: 'individual',
    description: 'Quem segura a banana em equilíbrio por mais tempo.',
    icon: '⚖️',
  },
  {
    id: 'revezamento',
    name: 'Revezamento selvagem',
    format: 'teams',
    description: 'Percurso em equipes com obstáculos leves.',
    icon: '🏃',
  },
];

export const DEFAULT_COLORS = [
  '#f2b134', '#4ea8de', '#e5574f', '#57cc99', '#c77dff',
  '#ff922b', '#2ec4b6', '#ff70a6', '#9bc53d', '#845ef7',
];

export const DEFAULT_SYMBOLS = ['★', '▲', '●', '◆', '■', '✦', '♥', '⬟', '✚', '❋'];

export const PORTRAITS = [
  'assets/portraits/gorila-1.png',
  'assets/portraits/gorila-2.png',
  'assets/portraits/gorila-3.png',
  'assets/portraits/gorila-4.png',
  'assets/portraits/gorila-5.png',
];

export const DEMO_NAMES = [
  'Iago', 'Miguel', 'Júlia', 'Fábio', 'Arthur', 'Maria', 'Lucas', 'Salgado',
  'Bruna', 'Caio',
];

/** Sequência padrão de minigames para N rodadas (repete a lista, é permitido). */
export function defaultMinigameOrder(rounds: number): string[] {
  return Array.from({ length: rounds }, (_, i) => MINIGAMES[i % MINIGAMES.length].id);
}
