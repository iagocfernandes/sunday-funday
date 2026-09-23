import type { CardDef } from '../game/types';

/**
 * Baralho físico de teste. O código identifica o TIPO de carta, não uma cópia.
 * Nenhum texto de carta é executado: effectType mapeia para funções do motor.
 */
export const CARDS: CardDef[] = [
  {
    id: 'S01',
    code: 'S01',
    title: 'Cacho escondido',
    category: 'luck',
    description: 'O gorila encontra um tesouro esquecido. +5 moedas.',
    effectType: 'gainCommon',
    amount: 5,
    targetRule: 'self',
    blockable: false,
    reversible: false,
    presentationKey: 'descobrir-carta',
  },
  {
    id: 'S02',
    code: 'S02',
    title: 'Casco de tartaruga',
    category: 'luck',
    description: 'Ganha um Escudo para o inventário.',
    effectType: 'grantItem',
    amount: 0,
    grantsItem: 'escudo',
    targetRule: 'self',
    blockable: false,
    reversible: false,
    presentationKey: 'descobrir-carta',
  },
  {
    id: 'S03',
    code: 'S03',
    title: 'Troca justa',
    category: 'luck',
    description: 'Ganha uma Casca de banana para usar depois.',
    effectType: 'grantItem',
    amount: 0,
    grantsItem: 'casca',
    targetRule: 'self',
    blockable: false,
    reversible: false,
    presentationKey: 'descobrir-carta',
  },
  {
    id: 'A01',
    code: 'A01',
    title: 'Pisou na casca',
    category: 'unluck',
    description: 'Escorregão feio. -3 moedas.',
    effectType: 'loseCommon',
    amount: 3,
    targetRule: 'self',
    blockable: false,
    reversible: false,
    presentationKey: 'sofrer-azar',
  },
  {
    id: 'A02',
    code: 'A02',
    title: 'Volta por onde veio',
    category: 'unluck',
    description: 'Recua 3 casas. Não ativa passagem nem casa de destino.',
    effectType: 'moveBack',
    amount: 3,
    targetRule: 'self',
    blockable: false,
    reversible: false,
    presentationKey: 'sofrer-azar',
  },
  {
    id: 'A03',
    code: 'A03',
    title: 'Emboscada da selva',
    category: 'unluck',
    description: 'Escolha outro gorila: ele perde até 3 moedas. Pode ser defendido.',
    effectType: 'attackCommon',
    amount: 3,
    targetRule: 'otherPlayer',
    blockable: true,
    reversible: true,
    presentationKey: 'ataque',
  },
];

export const CARDS_BY_ID: Record<string, CardDef> = Object.fromEntries(
  CARDS.map((c) => [c.id, c]),
);

export function findCardByCode(code: string): CardDef | undefined {
  const normalized = code.trim().toUpperCase();
  return CARDS.find((c) => c.code.toUpperCase() === normalized);
}

export function cardsOfCategory(category: CardDef['category']): CardDef[] {
  return CARDS.filter((c) => c.category === category);
}
