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
    individual: { first: 20, second: 6, others: 0 },
    teams: { winner: 10, loser: 0, draw: 10 },
  },
  shopItems: ['dadoDuplo', 'dadoCerteiro', 'trocaTroca', 'mudaBanana', 'preguicao', 'blindado'],
  minigameOrder: [],
  cardMode: 'digital',
};

export const ITEMS: Record<ItemId, ItemDef> = {
  preguicao: {id:'preguicao',name:'Gorila Preguição',price:5,description:'Escolha um adversário: a próxima rolagem dele fica entre 1 e 3, mesmo com poder de dado.',usage:'active',icon:'🦥'},
  blindado: {id:'blindado',name:'Gorila Blindado',price:5,description:'Bloqueia automaticamente um efeito prejudicial de Sorte ou Azar contra você. Consumido ao proteger.',usage:'defensive',icon:'🛡️'},
  dadoCerteiro: { id: 'dadoCerteiro', name: 'Dado Certeiro', price: 5, description: 'Escolha seu resultado de 1 a 10 antes de rolar.', usage: 'active', icon: '🎯' },
  bananaTurbo: { id: 'bananaTurbo', name: 'Banana Turbo', price: 5, description: 'Some 5 ao seu dado neste turno.', usage: 'active', icon: '⚡' },
  trocaTroca: { id: 'trocaTroca', name: 'Troca-Troca', price: 5, description: 'Troque de posição com um adversário aleatório. Depois role normalmente.', usage: 'active', icon: '🔀' },
  maoNoBolso: { id: 'maoNoBolso', name: 'Mão no Bolso', price: 8, description: 'Escolha um adversário e roube um poder aleatório dele.', usage: 'active', icon: '🎒' },
  mudaBanana: { id: 'mudaBanana', name: 'Muda a Banana!', price: 5, description: 'Faça a banana dourada nascer em outra árvore Fábio aleatória.', usage: 'active', icon: '🌳' },
  dadoDuplo: {
    id: 'dadoDuplo',
    name: 'Dado Duplo',
    price: 5,
    description: 'Role dois dados e ande a soma dos resultados.',
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
  '/assets/characters/arthur-v1.png',
  '/assets/characters/mari-v1.png',
  '/assets/characters/milena-v1.png',
];

export const DEMO_NAMES = [
  'Iago', 'Miguel', 'Júlia', 'Fábio', 'Arthur', 'Maria', 'Lucas', 'Salgado',
  'Bruna', 'Caio',
];

/** Sequência padrão de minigames para N rodadas (repete a lista, é permitido). */
export function defaultMinigameOrder(rounds: number): string[] {
  return Array.from({ length: rounds }, (_, i) => MINIGAMES[i % MINIGAMES.length].id);
}
