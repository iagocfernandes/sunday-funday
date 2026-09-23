import { useMemo } from 'react';
import { mapEdges } from '../data/map';
import type { BoardNode, GameState, NodeKind } from '../game/types';

const W = 1000;
const H = 640;

const NODE_STYLE: Record<NodeKind, { fill: string; icon: string; label: string }> = {
  start: { fill: '#8a6a3a', icon: '⚑', label: 'Início' },
  plus: { fill: '#3c7fc0', icon: '+', label: 'Casa boa' },
  minus: { fill: '#c0453c', icon: '−', label: 'Casa ruim' },
  luck: { fill: '#3f9e5f', icon: '☘', label: 'Sorte' },
  unluck: { fill: '#8a5fc0', icon: '✦', label: 'Azar' },
  shop: { fill: '#c98a17', icon: '🛒', label: 'Loja' },
  pedestal: { fill: '#7a6a3a', icon: '🪙', label: 'Pedestal' },
  thief: { fill: '#4a4a4a', icon: '🕵', label: 'Ladrão' },
  blank: { fill: '#55684a', icon: '•', label: 'Passagem' },
};

interface Props {
  state: GameState;
  /** Destaques clicáveis (bifurcação). */
  highlightNodes?: string[];
  onNodeClick?: (nodeId: string) => void;
}

export function Board({ state, highlightNodes = [], onNodeClick }: Props) {
  const { map, players, order, activeIndex, pedestalNodeId } = state;
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
      role="img"
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
        <clipPath id="pieceClip"><circle cx="0" cy="0" r="17" /></clipPath>
      </defs>

      {/* Cenário: nenhuma casa, número ou peça vem desenhada no fundo. */}
      <rect width={W} height={H} fill="url(#jungle)" />
      <g opacity="0.5" filter="url(#soft)">
        <ellipse cx={170} cy={120} rx={150} ry={95} fill="#2f5c22" />
        <ellipse cx={840} cy={150} rx={170} ry={105} fill="#356225" />
        <ellipse cx={120} cy={540} rx={160} ry={100} fill="#2a4f1d" />
        <ellipse cx={880} cy={540} rx={180} ry={110} fill="#2a4f1d" />
      </g>
      <path
        d="M 430 -20 C 470 160, 400 250, 470 330 C 540 410, 470 520, 520 660 L 620 660 C 570 520, 640 410, 570 330 C 500 250, 570 160, 530 -20 Z"
        fill="url(#river)"
        opacity="0.85"
      />
      <path d="M 455 330 L 590 330" stroke="#8a6a3a" strokeWidth="14" strokeLinecap="round" />
      <g opacity="0.75">
        {[...Array(9)].map((_, i) => (
          <circle key={i} cx={90 + i * 105} cy={i % 2 ? 60 : 600} r={22 + (i % 3) * 7} fill="#3a6b28" />
        ))}
      </g>

      {/* Conexões do grafo */}
      <g>
        {edges.map(({ from, to }, i) => {
          const a = px(from);
          const b = px(to);
          return (
            <line
              key={i}
              x1={a.x} y1={a.y} x2={b.x} y2={b.y}
              stroke="#e4d5ab"
              strokeWidth={14}
              strokeLinecap="round"
              opacity={0.55}
            />
          );
        })}
      </g>

      {/* Casas */}
      <g>
        {Object.values(map.nodes).map((node) => {
          const p = px(node);
          const style = NODE_STYLE[node.kind];
          const isPedestal = node.id === pedestalNodeId;
          const highlighted = highlightNodes.includes(node.id);
          return (
            <g
              key={node.id}
              transform={`translate(${p.x} ${p.y})`}
              onClick={highlighted && onNodeClick ? () => onNodeClick(node.id) : undefined}
              style={{ cursor: highlighted ? 'pointer' : 'default' }}
              role={highlighted ? 'button' : undefined}
              aria-label={highlighted ? `Seguir para ${style.label}` : undefined}
            >
              {highlighted && (
                <circle r={30} fill="none" stroke="#f2b134" strokeWidth={5}>
                  <animate attributeName="r" values="26;34;26" dur="1.1s" repeatCount="indefinite" />
                </circle>
              )}
              <circle r={19} fill="#0d1a08" opacity={0.45} transform="translate(0 3)" />
              <circle r={19} fill={isPedestal ? '#f2c138' : style.fill} stroke="#f4ecd8" strokeWidth={2.5} />
              <text
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={isPedestal ? 19 : 17}
                fill="#0f1c0a"
                fontWeight="800"
              >
                {isPedestal ? '🪙' : style.icon}
              </text>
              {node.label && (
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
              {isPedestal && !node.label && (
                <text
                  textAnchor="middle" y={-28} fontSize={12} fill="#ffd75e" fontWeight="800"
                  stroke="#12200f" strokeWidth={3.5} paintOrder="stroke"
                >
                  PEDESTAL
                </text>
              )}
            </g>
          );
        })}
      </g>

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
          const p = px(node);
          const ox = Math.cos(angle) * radius;
          const oy = Math.sin(angle) * radius;
          const crowded = group.length > 3;
          const isActive = id === activeId;
          return (
            <g
              key={id}
              transform={`translate(${p.x + ox} ${p.y + oy - 22})`}
              style={{ transition: 'transform 0.35s ease' }}
            >
              <ellipse cx={0} cy={22} rx={14} ry={5} fill="#000" opacity={0.35} />
              <circle r={20} fill={player.color} stroke={isActive ? '#fff' : '#12200f'} strokeWidth={isActive ? 4 : 2.5} />
              <image
                href={player.portrait}
                x={-17} y={-17} width={34} height={34}
                clipPath="url(#pieceClip)"
                preserveAspectRatio="xMidYMin slice"
                transform="translate(0 0)"
              />
              {/* Casa lotada mostra só o símbolo: a peça ativa continua com o nome. */}
              {(!crowded || isActive) && (
                <text
                  textAnchor="middle" y={34} fontSize={12} fontWeight="800" fill="#f4ecd8"
                  stroke="#12200f" strokeWidth={3.5} paintOrder="stroke"
                >
                  {player.symbol} {player.name}
                </text>
              )}
              {crowded && !isActive && (
                <text
                  textAnchor="middle" y={6} fontSize={14} fontWeight="800" fill="#12200f"
                >
                  {player.symbol}
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
