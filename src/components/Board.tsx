import { BoardV4 } from './BoardV4';
import { useId, useMemo } from 'react';
import { mapEdges } from '../data/map';
import type { BoardNode, BoardStop, GameState, NodeKind } from '../game/types';

const W = 1000;


const NODE_STYLE: Record<NodeKind, { fill: string; icon: string; label: string }> = {
  start: { fill: '#8a6a3a', icon: '⚑', label: 'Início' },
  plus: { fill: '#3c7fc0', icon: '+', label: 'Casa boa' },
  minus: { fill: '#c0453c', icon: '−', label: 'Casa ruim' },
  luck: { fill: '#3f9e5f', icon: '☘', label: 'Sorte' },
  unluck: { fill: '#8a5fc0', icon: '✦', label: 'Azar' },
  shop: { fill: '#c98a17', icon: '🛒', label: 'Loja' },
  pedestal: { fill: '#7a6a3a', icon: '🪙', label: 'Pedestal' },
  thief: { fill: '#4a4a4a', icon: '🕵', label: 'Ladrão' },
  duel: { fill: '#ad542b', icon: '⚔', label: 'Duelo' },
  blank: { fill: '#55684a', icon: '•', label: 'Passagem' },
};

interface Props {
  state: GameState;
  /** Destaques clicáveis (bifurcação). */
  highlightNodes?: string[];
  onNodeClick?: (nodeId: string) => void;
  /** Camadas ambientais da arte V4/V5; efeito apenas de apresentação. */
  living?: boolean;
  /** Congela as camadas ambientais sem alterar o estado do jogo. */
  paused?: boolean;
}

export function Board(props: Props) {
  return ['ilha-dos-gorilas-v4','ilha-dos-gorilas-v5'].includes(props.state.map.id) ? <BoardV4 {...props}/> : <LegacyBoard {...props}/>;
}

function LegacyBoard({ state, highlightNodes = [], onNodeClick }: Props) {
  const { map, players, order, activeIndex, pedestalNodeId } = state;
  const illustrated = map.id === 'ilha-dos-gorilas-v2' || map.id === 'ilha-dos-gorilas-v3';
  const H = illustrated ? 563 : 640;
  const uid = useId().replace(/:/g, '');
  const clipId = `${uid}-piece`;
  const arrowId = `${uid}-arrow`;
  const radius = illustrated ? 15 : 19;
  const edges = useMemo(() => mapEdges(map), [map]);
  const activeId = order[activeIndex];

  const px = (node: BoardNode) => ({ x: node.x * W, y: node.y * H });

  // Agrupa peças por casa para não empilhar em cima uma da outra.
  const byNode = new Map<string, string[]>();
  for (const id of order) {
    const list = byNode.get(players[id].nodeId) ?? [];
    list.push(id);
    byNode.set(players[id].nodeId, list);
  }

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ width: '100%', height: '100%' }}
      className="island-board"
      role="group"
      aria-label="Tabuleiro da ilha dos gorilas"
    >
      <defs>
        <radialGradient id="jungle" cx="50%" cy="38%" r="78%">
          <stop offset="0%" stopColor="#4c7c33" />
          <stop offset="60%" stopColor="#2d5220" />
          <stop offset="100%" stopColor="#16290f" />
        </radialGradient>
        <linearGradient id="river" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3f9ec4" />
          <stop offset="100%" stopColor="#1d5f80" />
        </linearGradient>
        <filter id="soft" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="10" />
        </filter>
        <marker id={arrowId} viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M 1 1 L 9 5 L 1 9 Z" fill="#fff1c3" /></marker>
        <clipPath id={clipId}><circle cx="0" cy="0" r="17" /></clipPath>
      </defs>

      {/* A arte é cenário; o grafo abaixo continua vindo do estado real. */}
      <rect width={W} height={H} fill="#163e35" />
      {illustrated ? <>
        <image href="/assets/board/ilha-v1.png" width={W} height={H} preserveAspectRatio="none" />
        <rect width={W} height={H} fill="#132c20" opacity=".12" />
        <g transform="translate(24 25)">
          <rect width="224" height="48" rx="12" fill="#142d24" opacity=".92" />
          <text x="14" y="21" fill="#ffe4a3" fontSize="15" fontWeight="800">ILHA DOS GORILAS</text>
          <text x="14" y="37" fill="#dddac7" fontSize="8">{map.stops ? '36 CASAS · 2 LOJAS · 4 ÁRVORES DO FABI' : '36 CASAS · DOIS DESVIOS · BANANA DOURADA'}</text>
        </g>
      </> : <rect width={W} height={H} fill="url(#jungle)" />}

      {/* Conexões do grafo */}
      <g>
        {edges.map(({ from, to }, i) => {
          const a = px(from);
          const b = px(to);
          const stop = map.stops?.find(s => s.from === from.id && s.to === to.id);
          const entrance = stop ? { x: stop.x * W, y: stop.y * H } : null;
          const route = entrance ? `M ${a.x} ${a.y} Q ${(a.x+entrance.x)/2} ${a.y} ${entrance.x} ${entrance.y} Q ${entrance.x} ${b.y} ${b.x} ${b.y}` : `M ${a.x} ${a.y} L ${b.x} ${b.y}`;
          const branch = from.id.startsWith('a') || from.id.startsWith('b') || to.id.startsWith('a') || to.id.startsWith('b');
          const visited = state.movement?.traversed ?? [];
          const traveled = visited.some((id, n) => id === from.id && visited[n + 1] === to.id);
          return (
            <g key={i}>
              <path d={route} fill="none" stroke="#302319" strokeWidth={illustrated ? 12 : 16} opacity=".7" strokeLinecap="round" />
              <path d={route} fill="none" stroke={traveled ? '#ffe083' : branch ? '#a8d6b1' : '#f1cc85'} strokeWidth={illustrated ? 7 : 11} opacity=".85" strokeLinecap="round" strokeDasharray={branch ? '3 5' : undefined} />
              <line x1={(entrance?.x ?? a.x) + (b.x-(entrance?.x ?? a.x))*.45} y1={(entrance?.y ?? a.y) + (b.y-(entrance?.y ?? a.y))*.45} x2={(entrance?.x ?? a.x) + (b.x-(entrance?.x ?? a.x))*.58} y2={(entrance?.y ?? a.y) + (b.y-(entrance?.y ?? a.y))*.58} stroke="#fff1c3" strokeWidth="1.5" markerEnd={`url(#${arrowId})`} />
            </g>
          );
        })}
      </g>

      {/* Barracas e árvores são paradas do percurso, não casas do dado. */}
      {map.stops?.map(stop => <MapStop key={stop.id} stop={stop} active={stop.id === pedestalNodeId} visiting={state.movement?.transit?.stopId === stop.id} width={W} height={H} />)}

      {/* Casas */}
      <g>
        {Object.values(map.nodes).map((node) => {
          const p = px(node);
          const style = NODE_STYLE[node.kind === 'thief' && !state.config.thiefEnabled ? 'blank' : node.kind];
          const isPedestal = !map.stops && node.id === pedestalNodeId;
          const highlighted = highlightNodes.includes(node.id);
          return (
            <g
              key={node.id}
              transform={`translate(${p.x} ${p.y})`}
              onClick={highlighted && onNodeClick ? () => onNodeClick(node.id) : undefined}
              style={{ cursor: highlighted ? 'pointer' : 'default' }}
              tabIndex={highlighted && onNodeClick ? 0 : undefined}
              onKeyDown={event => {
                if (highlighted && onNodeClick && (event.key === 'Enter' || event.key === ' ')) {
                  event.preventDefault(); onNodeClick(node.id);
                }
              }}
              role={highlighted ? 'button' : undefined}
              aria-label={highlighted ? `Seguir para ${style.label}, casa ${node.id}` : undefined}
            >
              {highlighted && (
                <circle r={25} fill="none" stroke="#fff2a3" strokeWidth={4} className="board-choice" />
              )}
              <circle r={radius} fill="#0d1a08" opacity={0.45} transform="translate(0 3)" />
              <circle r={radius} fill={isPedestal ? '#f2c138' : style.fill} stroke="#f4ecd8" strokeWidth={2.5} />
              <text
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={isPedestal ? 18 : 15}
                fill="#0f1c0a"
                fontWeight="800"
              >
                {isPedestal ? '🍌' : style.icon}
              </text>
              {node.label && !isPedestal && !(node.kind === 'thief' && !state.config.thiefEnabled) && (
                <text
                  textAnchor="middle"
                  y={-28}
                  fontSize={13}
                  fill="#f4ecd8"
                  fontWeight="800"
                  stroke="#12200f"
                  strokeWidth={3.5}
                  paintOrder="stroke"
                >
                  {node.label}
                </text>
              )}
              {isPedestal && (
                <text
                  textAnchor="middle" y={-28} fontSize={12} fill="#ffd75e" fontWeight="800"
                  stroke="#12200f" strokeWidth={3.5} paintOrder="stroke"
                >
                  BANANA DOURADA
                </text>
              )}
            </g>
          );
        })}
      </g>

      {illustrated && <g transform="translate(280 531)" aria-label="Legenda das casas">
        <rect x="-12" y="-17" width="448" height="30" rx="15" fill="#142d24" opacity=".94" />
        {(['plus', 'minus', 'luck', 'unluck', 'shop'] as NodeKind[]).map((kind, i) => <g key={kind} transform={`translate(${i * 87} 0)`}>
          <circle r="8" fill={NODE_STYLE[kind].fill} stroke="#fff0c4" />
          <text x="13" y="3" fontSize="10" fill="#fff0d0">{({plus: '+ moedas', minus: '− moedas', luck: 'Sorte', unluck: 'Azar', shop: 'Loja'} as Record<string, string>)[kind]}</text>
        </g>)}
      </g>}
      {/* Peças */}
      <g>
        {[...order].sort((a, b) => (a === activeId ? 1 : 0) - (b === activeId ? 1 : 0)).map((id) => {
          const player = players[id];
          const node = map.nodes[player.nodeId];
          const group = byNode.get(player.nodeId) ?? [id];
          const index = group.indexOf(id);
          // Espalha em círculo proporcional ao número de peças na mesma casa.
          const radius = group.length > 1 ? 16 + group.length * 3.4 : 0;
          const angle = (index / group.length) * Math.PI * 2 - Math.PI / 2;
          const visiting = id === activeId ? map.stops?.find(s => s.id === state.movement?.transit?.stopId) : undefined;
          const p = visiting ? { x: visiting.x * W + 30, y: visiting.y * H + 12 } : px(node);
          const crowded = group.length > 3;
          const isActive = id === activeId;
          const waiting = group.filter(pid => pid !== activeId);
          const slot = waiting.indexOf(id);
          // Uma pequena formação abaixo da casa deixa dez jogadores identificáveis.
          const ox = crowded ? (isActive ? 0 : (slot % 5 - 2) * 43) : Math.cos(angle) * radius;
          const oy = crowded ? (isActive ? 0 : (p.y > H - 140 ? -110 : 65) + Math.floor(slot / 5) * 48) : Math.sin(angle) * radius;
          return (
            <g
              key={id}
              transform={`translate(${p.x + ox} ${p.y + oy - 22}) scale(${crowded && !isActive ? .72 : 1})`}
              className="board-piece"
            >
              {isActive && <ellipse cx={0} cy={22} rx={24} ry={9} fill="#ffe096" stroke="#fff3ca" strokeWidth="2" />}
              <ellipse cx={0} cy={22} rx={14} ry={5} fill="#000" opacity={0.35} />
              <circle r={20} fill={player.color} stroke={isActive ? '#fff' : '#12200f'} strokeWidth={isActive ? 4 : 2.5} />
              <image
                href={player.portrait}
                x={-17} y={-17} width={34} height={34}
                clipPath={`url(#${clipId})`}
                preserveAspectRatio="xMidYMin slice"
                transform="translate(0 0)"
              />
              {/* Casa lotada mostra só o símbolo: a peça ativa continua com o nome. */}
              {(
                <text
                  textAnchor="middle" y={34} fontSize={12} fontWeight="800" fill="#f4ecd8"
                  stroke="#12200f" strokeWidth={3.5} paintOrder="stroke"
                >
                  {player.symbol} {player.name}
                </text>
              )}

            </g>
          );
        })}
      </g>
    </svg>
  );
}

export const NODE_LEGEND = NODE_STYLE;

function MapStop({ stop, active, visiting, width, height }: { stop: BoardStop; active: boolean; visiting: boolean; width: number; height: number }) {
  const name = stop.name.replace('Árvore da ', '').replace('Árvore do ', '').replace('Barraca da ', '');
  return <g transform={`translate(${stop.x * width} ${stop.y * height})`} role="img" aria-label={`${stop.name}${active ? ': banana dourada disponível' : ''}${visiting ? ', jogador visitando' : ''}`}>
    <ellipse rx={stop.kind === 'tree' ? 29 : 35} ry="10" fill="#17291d" opacity=".5" />
    <ellipse rx="22" ry="9" fill={visiting ? '#fff4b0' : '#ddbb79'} stroke={active ? '#fff4a8' : '#69432a'} strokeWidth="2" />
    {stop.kind === 'tree' ? <>
      {active && <ellipse cy="-27" rx="38" ry="40" fill="#ffd64b" opacity=".18" />}
      <image href="/assets/board/arvore-fabi-v1.png" x="-48" y="-88" width="96" height="96" />
      <text y="-23" textAnchor="middle" fontSize="6" fontWeight="900" fill="#4c351e">FABI</text>
      {active && <>
        <path d="M 9 -34 Q 27 -24 26 -8 Q 9 -13 7 -26 Q 13 -17 19 -17 Q 18 -24 9 -34" fill="#ffdd45" stroke="#af7014" strokeWidth="1.5" />
        <path d="M 12 -33 Q 34 -30 33 -13 Q 23 -17 18 -27" fill="#ffef81" stroke="#b9871e" strokeWidth="1.3" />
        <path d="M 34 -42 L 36 -36 L 42 -34 L 36 -32 L 34 -26 L 32 -32 L 26 -34 L 32 -36 Z" fill="#fff7c5" />
      </>}
    </> : <>
      <rect x="-23" y="-14" width="46" height="13" rx="2" fill="#784c2b" stroke="#ddae62" strokeWidth="2" />
      <text y="-5" textAnchor="middle" fontSize="8" fill="#ffefbb" fontWeight="800">PODERES</text>
    </>}
    <rect x="-53" y="12" width="106" height="17" rx="8" fill="#182c22" stroke={active ? '#f9ce58' : '#879663'} />
    <text y="24" textAnchor="middle" fill={active ? '#ffe071' : '#f4e9c7'} fontSize="9" fontWeight="800">{stop.kind === 'shop' ? 'LOJA · ' : active ? '🍌 ' : '♧ '}{name.toUpperCase()}</text>
  </g>;
}
