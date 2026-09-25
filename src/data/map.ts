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

/** Layout v2 acompanha a ilha ilustrada. IDs, efeitos e ligações permanecem iguais. */
const ISLAND_POINTS: [number, number][] = [
  [.24,.68], [.20,.60], [.195,.51], [.23,.44], [.29,.385],
  [.30,.30], [.265,.235], [.315,.205], [.375,.215], [.44,.255],
  [.51,.28], [.58,.28], [.65,.265], [.72,.29], [.76,.36],
  [.785,.44], [.78,.52], [.825,.595], [.81,.675], [.755,.745],
  [.68,.77], [.60,.75], [.52,.715], [.445,.695], [.375,.68],
  [.32,.64], [.285,.565], [.26,.605],
];

const CX = 0.5;
const CY = 0.5;

function ringPoint(i: number): { x: number; y: number } {
  const [x, y] = ISLAND_POINTS[i];
  return { x, y };
}

function mainId(i: number) {
  return `m${((i % MAIN_COUNT) + MAIN_COUNT) % MAIN_COUNT}`;
}

const LABELS: Record<string, string> = {
  m0: 'INÍCIO',
  m6: 'LOJA',
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

export function createLegacyMap(): BoardMap {
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

  const branchPoints: Record<string, [number, number]> = {
    a0: [.36,.40], a1: [.415,.37], a2: [.465,.335], a3: [.48,.295],
    b0: [.74,.56], b1: [.675,.555], b2: [.615,.605], b3: [.565,.66],
  };
  for (const [id, [x, y]] of Object.entries(branchPoints)) Object.assign(nodes[id], { x, y });

  nodes[mainId(FORK_A.from)].next = [mainId(FORK_A.from + 1), 'a0'];
  nodes[mainId(FORK_B.from)].next = [mainId(FORK_B.from + 1), 'b0'];

  return {
    id: 'ilha-dos-gorilas-v2',
    nodes,
    startNodeId: 'm0',
    pedestalSpots: ['m14', 'm3', 'm21', 'a2', 'b1', 'm9'],
  };
}

/** V3: 36 casas contáveis; serviços são paradas nas ligações. */
export function createV3Map(): BoardMap {
  const map = createLegacyMap();
  map.id = 'ilha-dos-gorilas-v3';
  for (const id of ['m6', 'm14', 'm18']) {
    map.nodes[id].kind = 'blank'; delete map.nodes[id].label;
  }
  // Rota leste passa pela barraca; o desvio alcança a árvore da clareira.
  map.nodes.m16.next = ['m17', 'b0'];
  map.nodes.m17.next = ['m18'];
  map.nodes.b0.x = .70; map.nodes.b0.y = .49;
  map.stops = [
    { id: 'shop-west', kind: 'shop', name: 'Barraca da Praia', from: 'm2', to: 'm3', x: .145, y: .46 },
    { id: 'shop-east', kind: 'shop', name: 'Barraca da Cachoeira', from: 'm17', to: 'm18', x: .875, y: .53 },
    { id: 'tree-temple', kind: 'tree', name: 'Árvore do Templo', from: 'm9', to: 'm10', x: .55, y: .19 },
    { id: 'tree-waterfall', kind: 'tree', name: 'Árvore da Cachoeira', from: 'm13', to: 'm14', x: .84, y: .33 },
    { id: 'tree-bridge', kind: 'tree', name: 'Árvore da Ponte', from: 'm22', to: 'm23', x: .51, y: .84 },
    { id: 'tree-glade', kind: 'tree', name: 'Árvore da Clareira', from: 'b0', to: 'b1', x: .63, y: .45 },
  ];
  map.pedestalSpots = map.stops.filter(s => s.kind === 'tree').map(s => s.id);
  return map;
}

/** V4: arte aprovada, casas em relevo e serviços fora da contagem. */
export function createV4Map(): BoardMap {
  const map = createV3Map(); map.id = 'ilha-dos-gorilas-v4';
  const points: [number, number][] = [
    [.175,.65],[.132,.575],[.112,.495],[.107,.405],[.175,.255],
    [.21,.205],[.266,.156],[.33,.14],[.397,.16],[.478,.196],
    [.56,.188],[.63,.197],[.686,.224],[.744,.274],[.789,.348],
    [.818,.412],[.827,.515],[.824,.615],[.792,.69],[.72,.75],
    [.647,.766],[.591,.755],[.55,.74],[.434,.742],[.36,.75],
    [.296,.739],[.244,.721],[.207,.693],
  ];
  points.forEach(([x,y],i) => Object.assign(map.nodes[`m${i}`], {x,y}));
  const branches: Record<string,[number,number]> = {
    a0:[.237,.334],a1:[.30,.37],a2:[.39,.352],a3:[.44,.28],
    b0:[.764,.486],b1:[.677,.506],b2:[.625,.579],b3:[.588,.67],
  };
  for (const [id,[x,y]] of Object.entries(branches)) Object.assign(map.nodes[id],{x,y});
  for (const id of ['m6','m14','m18']) map.nodes[id].kind='duel';
  map.nodes.m11.kind='luck'; map.nodes.m25.kind='unluck';
  map.stops = [
    {id:'shop-west',kind:'shop',name:'Barraca da Praia',from:'m2',to:'m3',x:.111,y:.447},
    {id:'shop-east',kind:'shop',name:'Barraca do Mirante',from:'m17',to:'m18',x:.822,y:.653},
    {id:'tree-temple',kind:'tree',name:'Árvore do Alto',from:'m6',to:'m7',x:.298,y:.146,artX:.283,artY:.075},
    {id:'tree-waterfall',kind:'tree',name:'Árvore da Cachoeira',from:'m12',to:'m13',x:.724,y:.25,artX:.845,artY:.207},
    {id:'tree-bridge',kind:'tree',name:'Árvore da Ponte',from:'m22',to:'m23',x:.5,y:.741,artX:.502,artY:.622},
    {id:'tree-glade',kind:'tree',name:'Árvore da Clareira',from:'b0',to:'b1',x:.715,y:.484,artX:.686,artY:.37},
    {id:'iagugu',kind:'iagugu',name:'Iagugu',from:'a0',to:'a1',x:.27,y:.358},
  ];
  map.pedestalSpots=map.stops.filter(s=>s.kind==='tree').map(s=>s.id);
  return map;
}

/** 48 casas em novas partidas; saves conservam seu próprio grafo. */
export function createDefaultMap(): BoardMap {
  const map=createV4Map(); map.id='ilha-dos-gorilas-v5';
  const additions: [string,string,number][]=[
    ['m3','m4',2],['m8','m9',1],['m9','m10',1],['m22','m23',2],
    ['a0','a1',1],['a1','a2',1],['b0','b1',1],['b1','b2',1],
    ['m18','m19',1],['m12','m13',1],
  ];
  const kinds: NodeKind[]=['plus','minus','luck','plus','minus','unluck'];
  let count=0;
  for(const [from,to,amount] of additions){
    const a=map.nodes[from],b=map.nodes[to],chain=[from];
    for(let i=1;i<=amount;i++){
      const t=i/(amount+1),id=`extra-${++count}`;
      let x=a.x+(b.x-a.x)*t,y=a.y+(b.y-a.y)*t;
      // A trilha oeste faz uma curva; as casas acompanham a areia.
      if(from==='m3') { [x,y]=i===1?[.12,.347]:[.143,.292]; }
      map.nodes[id]={id,kind:kinds[(count-1)%kinds.length],x,y,next:[]};chain.push(id);
    }
    chain.push(to);a.next=a.next.map(id=>id===to?chain[1]:id);
    for(let i=1;i<chain.length-1;i++) map.nodes[chain[i]].next=[chain[i+1]];
    const stop=map.stops?.find(s=>s.from===from&&s.to===to);
    if(stop){
      let best=0,distance=Infinity;
      for(let i=0;i<chain.length-1;i++){
        const u=map.nodes[chain[i]],v=map.nodes[chain[i+1]];
        const d=((u.x+v.x)/2-stop.x)**2+(((u.y+v.y)/2-stop.y)*.563)**2;
        if(d<distance){distance=d;best=i;}
      }
      stop.from=chain[best];stop.to=chain[best+1];
      stop.x=(map.nodes[stop.from].x+map.nodes[stop.to].x)/2;
      stop.y=(map.nodes[stop.from].y+map.nodes[stop.to].y)/2;
    }
  }
  return map;
}

/** Distância até a primeira parada, sem escolher bifurcações futuras pelo jogador. */
export function routeHint(map: BoardMap, from: string, to: string): string {
  const seen = new Set<string>(); let count = 0;
  while (!seen.has(from)) {
    seen.add(from);
    const stop = map.stops?.find(s => s.from === from && s.to === to);
    if (stop) return `${stop.name} · ${count === 0 ? 'neste trecho' : `após ${count} casa(s)`}`;
    count++;
    const node = map.nodes[to];
    if (!node || node.next.length !== 1) return `Nova bifurcação em ${count} casa(s)`;
    from = to; to = node.next[0];
  }
  return 'Circuito da ilha';
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
    if (!(map.stops ? map.stops.some(s => s.id === spot && s.kind === 'tree') : map.nodes[spot])) errors.push(`Local de pedestal ${spot} não existe.`);
  }
  if (map.pedestalSpots.length < 2) errors.push('É preciso ao menos 2 locais de pedestal.');

  if (map.stops !== undefined) {
    if (!Array.isArray(map.stops)) errors.push('Paradas inválidas.');
    else {
      const ids = new Set<string>(), edges = new Set<string>();
      for (const stop of map.stops) {
        if (!stop || !stop.id || !stop.name || !['shop', 'tree', 'iagugu'].includes(stop.kind)) { errors.push('Parada inválida.'); continue; }
        const edge = `${stop.from}:${stop.to}`;
        if (ids.has(stop.id) || edges.has(edge)) errors.push('Parada ou trecho repetido.');
        ids.add(stop.id); edges.add(edge);
        if (!map.nodes[stop.from]?.next.includes(stop.to)) errors.push(`Acesso inválido: ${stop.id}.`);
        if (![stop.x, stop.y].every(v => Number.isFinite(v) && v >= 0 && v <= 1)) errors.push('Parada fora do mapa.');
      }
    }
  }
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
