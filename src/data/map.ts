import type { BoardMap, BoardNode, NodeKind } from '../game/types';

/**
 * Mapa inicial: circuito de 28 casas com duas bifurcações internas que se
 * reconectam (4 casas cada) = 36 casas. Coordenadas normalizadas 0..1.
 */

const MAIN_COUNT = 28;

/** Padrão de casas do circuito principal (índice 0 = INÍCIO). */
const MAIN_KINDS: NodeKind[] = [
  'start', 'plus', 'luck', 'minus', 'unluck', 'plus', 'shop', 'unluck',
  'plus', 'luck', 'minus', 'blank', 'plus', 'unluck', 'pedestal', 'minus',
  'luck', 'plus', 'thief', 'unluck', 'plus', 'minus', 'luck', 'plus',
  'unluck', 'blank', 'minus', 'luck',
];

const BRANCH_A_KINDS: NodeKind[] = ['plus', 'unluck', 'luck', 'plus'];
const BRANCH_B_KINDS: NodeKind[] = ['minus', 'luck', 'plus', 'unluck'];

/** Bifurcações: a partir de main[from], o desvio reconecta em main[to]. */
const FORK_A = { from: 4, to: 9 };
const FORK_B = { from: 17, to: 22 };

const CX = 0.5;
const CY = 0.5;
const RX = 0.415;
const RY = 0.375;

function ringPoint(i: number): { x: number; y: number } {
  // Começa embaixo à esquerda e caminha no sentido horário.
  const t = (i / MAIN_COUNT) * Math.PI * 2 + Math.PI * 0.78;
  // Superelipse suave: mais parecido com um circuito do que com um círculo.
  const c = Math.cos(t);
  const s = Math.sin(t);
  const p = 2.6;
  const fx = Math.sign(c) * Math.pow(Math.abs(c), 2 / p);
  const fy = Math.sign(s) * Math.pow(Math.abs(s), 2 / p);
  return { x: CX + RX * fx, y: CY + RY * fy };
}

function mainId(i: number) {
  return `m${((i % MAIN_COUNT) + MAIN_COUNT) % MAIN_COUNT}`;
}

const LABELS: Record<string, string> = {
  m0: 'INÍCIO',
  m6: 'LOJA',
  m14: 'BANANA DOURADA',
  m18: 'LADRÃO',
};

function buildBranch(
  prefix: string,
  kinds: NodeKind[],
  fork: { from: number; to: number },
  bow: number,
): BoardNode[] {
  const a = ringPoint(fork.from);
  const b = ringPoint(fork.to);
  const nodes: BoardNode[] = [];
  for (let i = 0; i < kinds.length; i++) {
    const t = (i + 1) / (kinds.length + 1);
    // Interpola e puxa em direção ao centro para o desvio ficar por dentro.
    const lx = a.x + (b.x - a.x) * t;
    const ly = a.y + (b.y - a.y) * t;
    const pull = Math.sin(Math.PI * t) * bow;
    nodes.push({
      id: `${prefix}${i}`,
      kind: kinds[i],
      x: lx + (CX - lx) * pull,
      y: ly + (CY - ly) * pull,
      next: [i === kinds.length - 1 ? mainId(fork.to) : `${prefix}${i + 1}`],
    });
  }
  return nodes;
}

export function createDefaultMap(): BoardMap {
  const nodes: Record<string, BoardNode> = {};

  for (let i = 0; i < MAIN_COUNT; i++) {
    const p = ringPoint(i);
    const id = mainId(i);
    nodes[id] = {
      id,
      kind: MAIN_KINDS[i],
      x: p.x,
      y: p.y,
      next: [mainId(i + 1)],
      label: LABELS[id],
    };
  }

  for (const node of buildBranch('a', BRANCH_A_KINDS, FORK_A, 0.55)) nodes[node.id] = node;
  for (const node of buildBranch('b', BRANCH_B_KINDS, FORK_B, 0.55)) nodes[node.id] = node;

  nodes[mainId(FORK_A.from)].next = [mainId(FORK_A.from + 1), 'a0'];
  nodes[mainId(FORK_B.from)].next = [mainId(FORK_B.from + 1), 'b0'];

  return {
    id: 'ilha-dos-gorilas',
    nodes,
    startNodeId: 'm0',
    pedestalSpots: ['m14', 'm3', 'm21', 'a2', 'b1', 'm9'],
  };
}

export interface MapValidation {
  ok: boolean;
  errors: string[];
}

/** Valida o grafo antes de iniciar a partida. */
export function validateMap(map: BoardMap): MapValidation {
  const errors: string[] = [];
  const ids = Object.keys(map.nodes);
  if (!map.nodes[map.startNodeId]) errors.push('Nó inicial inexistente.');

  for (const id of ids) {
    const node = map.nodes[id];
    if (node.next.length === 0) errors.push(`Casa ${id} não tem saída.`);
    for (const next of node.next) {
      if (!map.nodes[next]) errors.push(`Casa ${id} aponta para ${next}, que não existe.`);
    }
    if (node.x < 0 || node.x > 1 || node.y < 0 || node.y > 1) {
      errors.push(`Casa ${id} fora das coordenadas normalizadas.`);
    }
  }

  // Todo nó deve ser alcançável a partir do início.
  const seen = new Set<string>();
  const queue = [map.startNodeId];
  while (queue.length) {
    const id = queue.shift()!;
    if (seen.has(id) || !map.nodes[id]) continue;
    seen.add(id);
    queue.push(...map.nodes[id].next);
  }
  for (const id of ids) {
    if (!seen.has(id)) errors.push(`Casa ${id} é inalcançável a partir do início.`);
  }

  for (const spot of map.pedestalSpots) {
    if (!map.nodes[spot]) errors.push(`Local de pedestal ${spot} não existe.`);
  }
  if (map.pedestalSpots.length < 2) errors.push('É preciso ao menos 2 locais de pedestal.');

  return { ok: errors.length === 0, errors };
}

/** Arestas desenháveis (para o SVG do tabuleiro). */
export function mapEdges(map: BoardMap): Array<{ from: BoardNode; to: BoardNode }> {
  const edges: Array<{ from: BoardNode; to: BoardNode }> = [];
  for (const node of Object.values(map.nodes)) {
    for (const next of node.next) edges.push({ from: node, to: map.nodes[next] });
  }
  return edges;
}
