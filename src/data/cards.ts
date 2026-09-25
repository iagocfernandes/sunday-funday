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

/** Baralho digital inicial: preserva as cartas físicas legadas para saves antigos. */
const LEGACY_DIGITAL_CARDS: CardDef[] = [
  CARDS[0],
  { ...CARDS[0], id: 'DS02', code: 'DS02', title: 'Moedas na trilha', description: 'Você encontrou 3 moedas no caminho.', amount: 3 },
  { ...CARDS[0], id: 'DS03', code: 'DS03', title: 'Mão Leve', description: 'Escolha um adversário e pegue até 5 moedas dele.', effectType: 'stealCommon', targetRule: 'otherPlayer' },
  CARDS[3], CARDS[4],
  { ...CARDS[3], id: 'DA03', code: 'DA03', title: 'Bolso furado', description: 'Você deixou cair 5 moedas.', amount: 5 },
];
function event(id: string, title: string, category: CardDef['category'], description: string, effectType: CardDef['effectType'], amount = 0, rare = false, durationRounds?: number): CardDef {
  return {id, code:id, title, category, description, effectType, amount,
    targetRule: ['stealGolden','stealPower','stealHalf','allInDuel'].includes(effectType)?'otherPlayer':'self',
    blockable:true, reversible:false, presentationKey:category==='luck'?'descobrir-carta':'sofrer-azar', weight:rare?1:5, durationRounds};
}
export const DIGITAL_CARDS: CardDef[] = [
  event('MS01','GORILA DA SORTE','luck','Escolha um gorila e roube uma banana dourada dele.','stealGolden',1,true),
  event('MS02','AVANTE, GORILA!','luck','Avance 5 casas. O deslocamento não ativa outras casas ou paradas.','moveForward',5),
  event('MS03','GORILA PICKPOCKET','luck','Escolha outro jogador e roube uma carta de poder aleatória dele.','stealPower'),
  event('MS04','LOTERIA GORILA!','luck','Receba metade das moedas do jogador à sua escolha, arredondando para baixo.','stealHalf'),
  event('MS05','TELETRANSPORTE','luck','Vá imediatamente para a árvore ativa da Banana Dourada. Você pode comprar por 20 moedas.','teleportTree',0,true),
  event('MS06','TUDO OU NADA','luck','Escolha um jogador para um duelo presencial. O vencedor recebe todas as moedas do adversário.','allInDuel',0,true),
  event('MA01','SHOT DA IMUNIDADE.','unluck','Tome 1 shot de bananinha. Se você for o Iago, tome 2.','social'),
  event('MA02','FIQUE SÓBRIO.','unluck','Você está proibido de fumar e/ou beber até o início da próxima rodada. Se você for o AR2, fique 2 rodadas.','social',0,false,1),
  event('MA03','GORILA, RECUAR!','unluck','Volte 5 casas. O deslocamento não ativa outras casas ou paradas.','moveBack',5),
  event('MA04','CHURRASQUEIRO','unluck','Você foi escolhido. Sirva o churrasco pelas próximas 2 rodadas.','social',0,false,2),
  event('MA05','BILL & MAYA QUEREM CAGAR','unluck','Dê uma volta com os cachorros na rua. Não esqueça das sacolas.','social'),
  event('MA06','BUNDA DA FAMA','unluck','Poste uma foto com o gorila bundudo no story ou dê 2 shots de bananinha.','social'),
  event('MA07','SE FUDEU!','unluck','Perca uma banana dourada.','loseGolden',1,true),
];
export const CARD_REVEAL_MS = 7000;
export function digitalCardsOfCategory(category: CardDef['category']) {
  return DIGITAL_CARDS.filter(c => c.category === category);
}

export const CARDS_BY_ID: Record<string, CardDef> = Object.fromEntries(
  [...CARDS, ...LEGACY_DIGITAL_CARDS, ...DIGITAL_CARDS].map((c) => [c.id, c]),
);

export function findCardByCode(code: string): CardDef | undefined {
  const normalized = code.trim().toUpperCase();
  return CARDS.find((c) => c.code.toUpperCase() === normalized);
}

export function cardsOfCategory(category: CardDef['category']): CardDef[] {
  return CARDS.filter((c) => c.category === category);
}
