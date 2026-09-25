import type { RewardTable } from './types';

/**
 * Representação ÚNICA da classificação de uma prova individual, usada pelo
 * motor, pelo formulário de resultados, pela prévia e pelo histórico.
 *
 * `tiers[i]` é o grupo de empatados na i-ésima posição preenchida. A posição
 * competitiva é derivada dos tamanhos dos grupos anteriores (1º, 1º, 3º), nunca
 * do índice do array — é essa divergência que produzia rótulos errados.
 */
export type PlacementTiers = string[][];

export interface PlacementTier {
  /** Posição competitiva exibida (1, 1, 3, ...). */
  position: number;
  playerIds: string[];
}

export type PlacementValidation =
  | { ok: true; tiers: PlacementTiers }
  | { ok: false; error: string };

/**
 * Normaliza e valida a classificação informada.
 *
 * - Grupos vazios no fim são descartados (não são ambíguos).
 * - Um grupo vazio ANTES de um grupo preenchido é recusado: colocar alguém em
 *   segundo sem ninguém em primeiro não tem leitura única.
 * - Jogador repetido ou desconhecido é recusado.
 */
export function normalizePlacement(order: string[], rawTiers: unknown): PlacementValidation {
  if (!Array.isArray(rawTiers)) return { ok: false, error: 'Classificação inválida.' };

  const tiers: PlacementTiers = [];
  for (const tier of rawTiers) {
    if (!Array.isArray(tier)) return { ok: false, error: 'Classificação inválida.' };
    tiers.push(tier.filter((id): id is string => typeof id === 'string'));
  }

  // Descarta apenas os grupos vazios finais.
  while (tiers.length > 0 && tiers[tiers.length - 1].length === 0) tiers.pop();

  if (tiers.length === 0) return { ok: false, error: 'Informe ao menos uma colocação.' };

  const emptyIndex = tiers.findIndex((tier) => tier.length === 0);
  if (emptyIndex >= 0) {
    return {
      ok: false,
      error: `A ${emptyIndex + 1}ª posição está vazia com posições seguintes preenchidas. Preencha-a ou remova quem está abaixo.`,
    };
  }

  const known = new Set(order);
  const seen = new Set<string>();
  for (const tier of tiers) {
    for (const id of tier) {
      if (!known.has(id)) return { ok: false, error: `Jogador desconhecido na classificação: ${id}.` };
      if (seen.has(id)) return { ok: false, error: 'Jogador repetido na classificação.' };
      seen.add(id);
    }
  }

  return { ok: true, tiers };
}

/** Posições competitivas dos grupos preenchidos: 1º, 1º, 3º. */
export function placementTiers(tiers: PlacementTiers): PlacementTier[] {
  const result: PlacementTier[] = [];
  let position = 1;
  for (const playerIds of tiers) {
    if (playerIds.length === 0) continue;
    result.push({ position, playerIds });
    position += playerIds.length;
  }
  return result;
}

/**
 * Posição competitiva que uma caixa do formulário representa, considerando
 * apenas as caixas anteriores já preenchidas. Caixas cuja anterior está vazia
 * ficam bloqueadas (`position` nulo) para não gerar lacuna ambígua.
 */
export function boxPositions(tiers: PlacementTiers): Array<number | null> {
  const positions: Array<number | null> = [];
  let position = 1;
  let blocked = false;
  for (const tier of tiers) {
    if (blocked) {
      positions.push(null);
      continue;
    }
    positions.push(position);
    if (tier.length === 0) blocked = true;
    else position += tier.length;
  }
  return positions;
}

function prizeForPosition(position: number, rewards: RewardTable['individual']): number {
  if (position === 1) return rewards.first;
  if (position === 2) return rewards.second;
  return rewards.others;
}

/**
 * Premiação individual. Quem não foi classificado recebe o prêmio de
 * participação. Usa exatamente as mesmas posições exibidas na interface.
 */
export function individualAwards(
  order: string[],
  tiers: PlacementTiers,
  rewards: RewardTable['individual'],
): Record<string, number> {
  const awards: Record<string, number> = {};
  for (const tier of placementTiers(tiers)) {
    const prize = prizeForPosition(tier.position, rewards);
    for (const id of tier.playerIds) awards[id] = prize;
  }
  for (const id of order) if (!(id in awards)) awards[id] = rewards.others;
  return awards;
}

/** Texto do histórico e da revisão, com as mesmas posições competitivas. */
export function describePlacement(
  tiers: PlacementTiers,
  nameOf: (id: string) => string,
): string {
  return placementTiers(tiers)
    .map((tier) => `${tier.position}º: ${tier.playerIds.map(nameOf).join(', ')}`)
    .join(' | ');
}
