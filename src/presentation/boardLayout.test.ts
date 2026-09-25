import { describe, expect, it } from 'vitest';
import { createDefaultMap, createV4Map } from '../data/map';
import { layoutBoardForRender, measureBoardLayout, BOARD_SCREEN } from './boardLayout';

function logicalShape(map: ReturnType<typeof createDefaultMap>) {
  return Object.fromEntries(Object.entries(map.nodes).map(([id, node]) => [id, {
    kind: node.kind,
    next: node.next,
  }]));
}

function stopShape(map: ReturnType<typeof createDefaultMap>) {
  return (map.stops ?? []).map(stop => ({
    id: stop.id,
    kind: stop.kind,
    name: stop.name,
    from: stop.from,
    to: stop.to,
    artX: stop.artX,
    artY: stop.artY,
  }));
}

function pointOnEdge(map: ReturnType<typeof createDefaultMap>, stop: { from: string; to: string; x: number; y: number }) {
  const a = map.nodes[stop.from];
  const b = map.nodes[stop.to];
  const ax = a.x * BOARD_SCREEN.width;
  const ay = a.y * BOARD_SCREEN.height;
  const bx = b.x * BOARD_SCREEN.width;
  const by = b.y * BOARD_SCREEN.height;
  const px = stop.x * BOARD_SCREEN.width;
  const py = stop.y * BOARD_SCREEN.height;
  const cross = Math.abs((px - ax) * (by - ay) - (py - ay) * (bx - ax));
  const length = Math.hypot(bx - ax, by - ay);
  return { cross, length, t: ((px - ax) * (bx - ax) + (py - ay) * (by - ay)) / (length * length) };
}

function routeBetween(map: ReturnType<typeof createDefaultMap>, from: string, to: string, firstNext?: string) {
  const route = [from];
  const seen = new Set(route);
  let current = from;
  while (current !== to) {
    const node = map.nodes[current];
    const next = route.length === 1 && firstNext ? firstNext : node.next.find(id => !seen.has(id));
    if (!next || !node.next.includes(next)) throw new Error(`Rota inválida: ${current} → ${next}`);
    route.push(next);
    seen.add(next);
    current = next;
  }
  return route;
}

function distanceToSegment(point: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }) {
  const px = point.x * BOARD_SCREEN.width;
  const py = point.y * BOARD_SCREEN.height;
  const ax = a.x * BOARD_SCREEN.width;
  const ay = a.y * BOARD_SCREEN.height;
  const bx = b.x * BOARD_SCREEN.width;
  const by = b.y * BOARD_SCREEN.height;
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}

describe('board layout helper', () => {
  it('melhora a uniformidade de distância sem alterar a lógica do mapa', () => {
    const source = createDefaultMap();
    const laidOut = layoutBoardForRender(source);
    const before = measureBoardLayout(source);
    const after = measureBoardLayout(laidOut);

    expect(after.count).toBe(before.count);
    expect(after.cv).toBeLessThan(before.cv);
    expect(after.max - after.min).toBeLessThan(before.max - before.min);
    expect(logicalShape(laidOut)).toEqual(logicalShape(source));
    expect(stopShape(laidOut)).toEqual(stopShape(source));
    expect(laidOut).not.toBe(source);
  });

  it('mantém cada piso de parada sobre a mesma aresta', () => {
    const source = createDefaultMap();
    const laidOut = layoutBoardForRender(source);
    for (const stop of laidOut.stops ?? []) {
      const position = pointOnEdge(laidOut, stop);
      expect(position.cross).toBeLessThan(0.00001);
      expect(position.t).toBeGreaterThanOrEqual(0);
      expect(position.t).toBeLessThanOrEqual(1);
    }
  });

  it('mantém bifurcações e reencontros reais e não cria atalhos fora das polilinhas', () => {
    const source = createDefaultMap();
    const laidOut = layoutBoardForRender(source);
    expect(source.nodes.m4.next).toContain('a0');
    expect(source.nodes.m16.next).toEqual(['m17', 'b0']);
    expect(source.nodes.m17.next).not.toContain('b0');

    for (const id of ['m4', 'm9', 'm16', 'm22']) {
      expect(laidOut.nodes[id].x).toBe(source.nodes[id].x);
      expect(laidOut.nodes[id].y).toBe(source.nodes[id].y);
    }

    const paths: Array<[string, string, string?]> = [
      ['m0', 'm4'], ['m4', 'm9', 'm5'], ['m4', 'm9', 'a0'],
      ['m9', 'm16'], ['m16', 'm22', 'm17'], ['m16', 'm22', 'b0'], ['m22', 'm0'],
    ];
    for (const [from, to, firstNext] of paths) {
      const originalRoute = routeBetween(source, from, to, firstNext);
      for (const id of originalRoute) {
        const point = laidOut.nodes[id];
        const onOriginalPolyline = originalRoute.slice(1).some((nextId, index) =>
          distanceToSegment(point, source.nodes[originalRoute[index]], source.nodes[nextId]) < 0.00001);
        expect(onOriginalPolyline).toBe(true);
      }
    }
  });

  it('não reinterpreta v4 nem mapas legados', () => {
    const v4 = createV4Map();
    expect(layoutBoardForRender(v4)).toBe(v4);
    const legacy = { ...v4, id: 'ilha-dos-gorilas-v3' };
    expect(layoutBoardForRender(legacy)).toBe(legacy);
  });
});
