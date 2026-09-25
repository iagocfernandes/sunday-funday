import type { BoardMap, BoardNode } from '../game/types';

/** Coordenadas usadas pelo SVG do tabuleiro. */
export const BOARD_SCREEN = { width: 1000, height: 563 } as const;

export interface LayoutMetrics {
  count: number;
  min: number;
  max: number;
  mean: number;
  cv: number;
}

interface ScreenPoint { x: number; y: number }

const screenOf = (node: BoardNode): ScreenPoint => ({
  x: node.x * BOARD_SCREEN.width,
  y: node.y * BOARD_SCREEN.height,
});

const normalizedOf = (point: ScreenPoint) => ({
  x: point.x / BOARD_SCREEN.width,
  y: point.y / BOARD_SCREEN.height,
});

function distance(a: ScreenPoint, b: ScreenPoint) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/**
 * Percorre uma rota até o reencontro, mantendo a polilinha já desenhada.
 * `firstNext` escolhe o ramo quando o nó de origem tem duas saídas.
 */
function routeBetween(map: BoardMap, from: string, to: string, firstNext?: string): string[] {
  const route = [from];
  const seen = new Set([from]);
  let current = from;
  if (firstNext && !map.nodes[from]?.next.includes(firstNext)) {
    throw new Error(`Saída inválida no layout: ${from} → ${firstNext}`);
  }
  while (current !== to) {
    const node = map.nodes[current];
    if (!node) throw new Error(`Nó ausente no layout: ${current}`);
    const next = route.length === 1 && firstNext
      ? firstNext
      : node.next.find(id => !seen.has(id));
    if (!next || !map.nodes[next]) throw new Error(`Rota incompleta: ${from} → ${to}`);
    route.push(next);
    seen.add(next);
    current = next;
  }
  return route;
}

/** Reamostra os próprios segmentos da polilinha, sem criar atalhos entre curvas. */
function resampleRoute(map: BoardMap, route: string[]): Map<string, ScreenPoint> {
  const lengths = [0];
  for (let i = 1; i < route.length; i++) {
    lengths.push(lengths[i - 1] + distance(screenOf(map.nodes[route[i - 1]]), screenOf(map.nodes[route[i]])));
  }
  const total = lengths[lengths.length - 1];
  const placed = new Map<string, ScreenPoint>();
  if (route.length === 1) {
    placed.set(route[0], screenOf(map.nodes[route[0]]));
    return placed;
  }

  for (let targetIndex = 0; targetIndex < route.length; targetIndex++) {
    const target = total * targetIndex / (route.length - 1);
    let segment = 1;
    while (segment < lengths.length - 1 && lengths[segment] < target) segment++;
    const startLength = lengths[segment - 1];
    const endLength = lengths[segment];
    const t = endLength === startLength ? 0 : (target - startLength) / (endLength - startLength);
    const a = screenOf(map.nodes[route[segment - 1]]);
    const b = screenOf(map.nodes[route[segment]]);
    placed.set(route[targetIndex], { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  }
  return placed;
}

function repositionStops(before: BoardMap, after: BoardMap) {
  if (!before.stops || !after.stops) return;
  const beforeById = new Map(before.stops.map(stop => [stop.id, stop]));
  for (const stop of after.stops) {
    const old = beforeById.get(stop.id);
    if (!old || old.from !== stop.from || old.to !== stop.to) continue;
    const oldA = screenOf(before.nodes[old.from]);
    const oldB = screenOf(before.nodes[old.to]);
    const newA = screenOf(after.nodes[stop.from]);
    const newB = screenOf(after.nodes[stop.to]);
    const edgeX = oldB.x - oldA.x;
    const edgeY = oldB.y - oldA.y;
    const edgeLengthSquared = edgeX * edgeX + edgeY * edgeY;
    const oldPoint = { x: old.x * BOARD_SCREEN.width, y: old.y * BOARD_SCREEN.height };
    const t = edgeLengthSquared === 0
      ? 0.5
      : Math.max(0, Math.min(1, ((oldPoint.x - oldA.x) * edgeX + (oldPoint.y - oldA.y) * edgeY) / edgeLengthSquared));
    const newPoint = { x: newA.x + (newB.x - newA.x) * t, y: newA.y + (newB.y - newA.y) * t };
    Object.assign(stop, normalizedOf(newPoint));
  }
}

/** Mede arestas dirigidas em pixels do SVG 1000×563. */
export function measureBoardLayout(map: BoardMap): LayoutMetrics {
  const lengths: number[] = [];
  for (const node of Object.values(map.nodes)) {
    for (const nextId of node.next) {
      const next = map.nodes[nextId];
      if (next) lengths.push(distance(screenOf(node), screenOf(next)));
    }
  }
  const mean = lengths.length ? lengths.reduce((sum, value) => sum + value, 0) / lengths.length : 0;
  const variance = lengths.length ? lengths.reduce((sum, value) => sum + (value - mean) ** 2, 0) / lengths.length : 0;
  return {
    count: lengths.length,
    min: lengths.length ? Math.min(...lengths) : 0,
    max: lengths.length ? Math.max(...lengths) : 0,
    mean,
    cv: mean ? Math.sqrt(variance) / mean : 0,
  };
}

/**
 * Ajusta apenas o layout de renderização do v5.
 * V4 e mapas legados retornam a mesma referência para não reinterpretar saves.
 */
export function layoutBoardForRender(map: BoardMap): BoardMap {
  if (map.id !== 'ilha-dos-gorilas-v5') return map;

  const routes: Array<{ from: string; to: string; firstNext?: string }> = [
    { from: 'm0', to: 'm4' },
    { from: 'm4', to: 'm9', firstNext: 'm5' },
    { from: 'm4', to: 'm9', firstNext: 'a0' },
    { from: 'm9', to: 'm16' },
    { from: 'm16', to: 'm22', firstNext: 'm17' },
    { from: 'm16', to: 'm22', firstNext: 'b0' },
    { from: 'm22', to: 'm0' },
  ];
  const positioned = new Map<string, ScreenPoint>();
  for (const spec of routes) {
    const route = routeBetween(map, spec.from, spec.to, spec.firstNext);
    for (const [id, point] of resampleRoute(map, route)) positioned.set(id, point);
  }

  const nodes = Object.fromEntries(Object.entries(map.nodes).map(([id, node]) => {
    const point = positioned.get(id);
    return [id, point ? { ...node, ...normalizedOf(point), next: [...node.next] } : { ...node, next: [...node.next] }];
  }));
  const laidOut: BoardMap = {
    ...map,
    nodes,
    pedestalSpots: [...map.pedestalSpots],
    stops: map.stops?.map(stop => ({ ...stop })),
  };
  repositionStops(map, laidOut);
  return laidOut;
}
