import { CARDS_BY_ID } from '../data/cards';
import { ITEMS, MINIGAMES } from '../data/config';
import type { DomainEvent, GameState } from '../game/types';

export type SceneLevel = 'small' | 'medium' | 'large';

export interface Scene {
  id: string;
  level: SceneLevel;
  title: string;
  subtitle?: string;
  /** Chave do manifesto: escolhe imagem/vídeo/áudio. */
  presentationKey: string;
  playerId?: string;
  accent?: string;
  /** Duração alvo em ms (meta visual, nunca um bloqueio obrigatório). */
  durationMs: number;
}

export interface SceneAsset {
  image: string;
  /** Vídeo local opcional. Ausente, incompatível ou com erro = fallback imediato. */
  video?: string;
  audio?: string;
  gradient: string;
}

/**
 * Manifesto: evento → imagem, vídeo opcional, áudio opcional e duração.
 * Nenhuma regra depende de um vídeo existir ou terminar.
 */
export const SCENE_ASSETS: Record<string, SceneAsset> = {
  abertura: {
    image: 'assets/scenes/gorila-heroi.png',
    video: 'assets/scenes/abertura.mp4',
    gradient: 'linear-gradient(135deg,#1b3b1f,#4b7f34)',
  },
  'descobrir-carta': {
    image: 'assets/scenes/gorila-jovem.png',
    gradient: 'linear-gradient(135deg,#2d4a1f,#89b33a)',
  },
  'sofrer-azar': {
    image: 'assets/scenes/gorila-jovem.png',
    gradient: 'linear-gradient(135deg,#4a1f1f,#b3453a)',
  },
  ataque: {
    image: 'assets/scenes/gorila-heroi.png',
    gradient: 'linear-gradient(135deg,#3a2216,#c2703a)',
  },
  defesa: {
    image: 'assets/scenes/gorila-heroi.png',
    gradient: 'linear-gradient(135deg,#16303a,#3a9bc2)',
  },
  dourada: {
    image: 'assets/scenes/gorila-heroi.png',
    video: 'assets/scenes/dourada.mp4',
    gradient: 'linear-gradient(135deg,#6b4a06,#f2c138)',
  },
  minigame: {
    image: 'assets/scenes/gorila-heroi.png',
    gradient: 'linear-gradient(135deg,#1f3a4a,#3a85c2)',
  },
  'comemorar-vitoria': {
    image: 'assets/scenes/gorila-heroi.png',
    video: 'assets/scenes/vitoria.mp4',
    gradient: 'linear-gradient(135deg,#5a3f06,#f2b134)',
  },
  coroacao: {
    image: 'assets/scenes/gorila-heroi.png',
    gradient: 'linear-gradient(135deg,#3b2a06,#ffd75e)',
  },
  item: {
    image: 'assets/scenes/gorila-jovem.png',
    gradient: 'linear-gradient(135deg,#25304a,#5f72b3)',
  },
};

export function assetFor(key: string): SceneAsset {
  return SCENE_ASSETS[key] ?? SCENE_ASSETS['descobrir-carta'];
}

const DURATION: Record<SceneLevel, number> = { small: 1100, medium: 2800, large: 4600 };

let counter = 0;
function sceneId() {
  counter += 1;
  return `sc-${counter}-${Date.now().toString(36)}`;
}

/**
 * Transforma eventos de domínio em cenas. Este controlador NUNCA altera saldos:
 * o estado já foi salvo antes da animação.
 */
export function scenesFor(event: DomainEvent, state: GameState): Scene[] {
  const name = (id: string) => state.players[id]?.name ?? '???';
  const color = (id: string) => state.players[id]?.color;

  switch (event.type) {
    case 'diceRolled':
      return [
        {
          id: sceneId(),
          level: 'small',
          title: `${event.value}`,
          subtitle: `${name(event.playerId)} rolou o dado${event.doubled ? ' (dobrado)' : ''}`,
          presentationKey: 'item',
          playerId: event.playerId,
          accent: color(event.playerId),
          durationMs: DURATION.small,
        },
      ];
    case 'coinsChanged':
      return [
        {
          id: sceneId(),
          level: 'small',
          title: `${event.delta > 0 ? '+' : ''}${event.delta} 🪙`,
          subtitle: `${name(event.playerId)} — ${event.reason}`,
          presentationKey: event.delta > 0 ? 'descobrir-carta' : 'sofrer-azar',
          playerId: event.playerId,
          accent: color(event.playerId),
          durationMs: DURATION.small,
        },
      ];
    case 'itemGranted':
      return [
        {
          id: sceneId(),
          level: 'medium',
          title: ITEMS[event.itemId].name,
          subtitle: `${name(event.playerId)} recebeu um item`,
          presentationKey: 'item',
          playerId: event.playerId,
          accent: color(event.playerId),
          durationMs: DURATION.medium,
        },
      ];
    case 'itemUsed':
      return [
        {
          id: sceneId(),
          level: 'medium',
          title: `${ITEMS[event.itemId].icon} ${ITEMS[event.itemId].name}`,
          subtitle: `${name(event.playerId)} usou o item`,
          presentationKey: 'item',
          playerId: event.playerId,
          accent: color(event.playerId),
          durationMs: DURATION.medium,
        },
      ];
    case 'cardResolved': {
      const card = CARDS_BY_ID[event.cardId];
      return [
        {
          id: sceneId(),
          level: 'medium',
          title: card.title,
          subtitle: `${name(event.playerId)} — ${card.description}`,
          presentationKey: card.presentationKey,
          playerId: event.playerId,
          accent: color(event.playerId),
          durationMs: DURATION.medium,
        },
      ];
    }
    case 'attackResolved':
      return [
        {
          id: sceneId(),
          level: 'medium',
          title: 'Ataque certeiro',
          subtitle: `${name(event.attackerId)} acertou ${name(event.targetId)} (-${event.amount} 🪙)`,
          presentationKey: 'ataque',
          playerId: event.targetId,
          accent: color(event.attackerId),
          durationMs: DURATION.medium,
        },
      ];
    case 'attackBlocked':
      return [
        {
          id: sceneId(),
          level: 'medium',
          title: 'Bloqueado!',
          subtitle: `${name(event.targetId)} usou o escudo contra ${name(event.attackerId)}`,
          presentationKey: 'defesa',
          playerId: event.targetId,
          accent: color(event.targetId),
          durationMs: DURATION.medium,
        },
      ];
    case 'attackReversed':
      return [
        {
          id: sceneId(),
          level: 'medium',
          title: 'Reverse!',
          subtitle: `${name(event.targetId)} devolveu o ataque para ${name(event.attackerId)}`,
          presentationKey: 'defesa',
          playerId: event.targetId,
          accent: color(event.targetId),
          durationMs: DURATION.medium,
        },
      ];
    case 'goldenBananaPurchased':
      return [
        {
          id: sceneId(),
          level: 'large',
          title: 'BANANA DOURADA',
          subtitle: `${name(event.playerId)} conquistou uma banana dourada!`,
          presentationKey: 'dourada',
          playerId: event.playerId,
          accent: '#f2c138',
          durationMs: DURATION.large,
        },
      ];
    case 'minigameStarted': {
      const game = MINIGAMES.find((m) => m.id === event.minigameId);
      return [
        {
          id: sceneId(),
          level: 'large',
          title: `Capítulo ${state.round} — ${game?.name ?? 'Prova'}`,
          subtitle: game?.description,
          presentationKey: 'minigame',
          accent: '#3a85c2',
          durationMs: DURATION.large,
        },
      ];
    }
    case 'minigameCompleted': {
      const game = MINIGAMES.find((m) => m.id === event.minigameId);
      return [
        {
          id: sceneId(),
          level: 'large',
          // Recompensas de equipe consolidadas numa única cena.
          title: 'Vitória!',
          subtitle: `${game?.name}: ${event.winners.map(name).join(', ')}`,
          presentationKey: 'comemorar-vitoria',
          playerId: event.winners[0],
          accent: '#f2b134',
          durationMs: DURATION.large,
        },
      ];
    }
    case 'gameCompleted':
      return [
        {
          id: sceneId(),
          level: 'large',
          title: 'Coroação',
          subtitle: `Campeão(ões): ${event.winners.map(name).join(', ')}`,
          presentationKey: 'coroacao',
          playerId: event.winners[0],
          accent: '#ffd75e',
          durationMs: DURATION.large,
        },
      ];
    default:
      return [];
  }
}

/** Cenas pequenas não bloqueiam a automação; médias e grandes atrasam o próximo passo. */
export function isBlocking(scene: Scene): boolean {
  return scene.level !== 'small';
}
