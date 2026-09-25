import { CARDS_BY_ID } from '../data/cards.js';
import type { DomainEvent, GameState } from '../game/types';

export type HostAudioMood = 'neutral' | 'happy' | 'mischievous' | 'sad';

/**
 * The files are keyed by stable logical cue names so the server does not need
 * to know filesystem paths. `durationMs` includes a small 250ms tail.
 */
export const HOST_AUDIO_CLIPS = {
  opening: { src: '/assets/audio/ar2/opening.wav', text: 'Partida valendo!', mood: 'neutral', durationMs: 26_450 },
  bananaBought: { src: '/assets/audio/ar2/banana-bought.wav', text: 'Banana dourada comprada!', mood: 'happy', durationMs: 8_690 },
  bananaStolen: { src: '/assets/audio/ar2/banana-stolen.wav', text: 'Banana dourada roubada!', mood: 'mischievous', durationMs: 7_650 },
  champion: { src: '/assets/audio/ar2/champion.wav', text: 'Campeão!', mood: 'happy', durationMs: 19_410 },
  lastRound: { src: '/assets/audio/ar2/last-round.wav', text: 'Última rodada decisiva!', mood: 'mischievous', durationMs: 10_730 },
  luck: { src: '/assets/audio/ar2/luck.wav', text: 'Sorte!', mood: 'happy', durationMs: 3_090 },
  unluck: { src: '/assets/audio/ar2/unluck.wav', text: 'Azar!', mood: 'mischievous', durationMs: 4_250 },
  sober: { src: '/assets/audio/ar2/sober.wav', text: 'Fique sóbrio.', mood: 'sad', durationMs: 8_570 },
} as const satisfies Record<string, { src: string; text: string; mood: HostAudioMood; durationMs: number }>;

export type HostAudioClip = keyof typeof HOST_AUDIO_CLIPS;

export interface HostAudioCue {
  /** Stable logical key from HOST_AUDIO_CLIPS. */
  clip: HostAudioClip;
  durationMs: number;
  playerIds: string[];
}

type CandidateClip = HostAudioClip | 'duel';
type Candidate = { clip: CandidateClip; priority: number; playerIds: string[] };

function cue(candidate: Candidate & { clip: HostAudioClip }): HostAudioCue {
  return {
    clip: candidate.clip,
    durationMs: HOST_AUDIO_CLIPS[candidate.clip].durationMs,
    playerIds: [...new Set(candidate.playerIds)],
  };
}

function pendingDuelIds(pending: GameState['pending']) {
  if (!pending || (pending.kind !== 'duelBet' && pending.kind !== 'duelResult')) return [];
  return [pending.playerId, pending.opponentId];
}

function cardCandidate(event: Extract<DomainEvent, { type: 'cardResolved' }>): Candidate | null {
  const card = CARDS_BY_ID[event.cardId];
  if (!card) return null;
  if (event.cardId === 'MA02') return { clip: 'sober', priority: 110, playerIds: [event.playerId] };
  if (event.cardId === 'MS01') return null; // only after an actual golden delta
  if (event.cardId === 'MS06') return null; // handled as a duel below
  return card.category === 'luck'
    ? { clip: 'luck', priority: 70, playerIds: [event.playerId] }
    : { clip: 'unluck', priority: 80, playerIds: [event.playerId] };
}

function iaguguGoldenRobbery(previous: GameState | null, next: GameState): Candidate | null {
  if (!previous || !next.notice?.toLowerCase().includes('iagugu')) return null;
  const gainers = Object.values(next.players).filter(player => (player.golden - (previous.players[player.id]?.golden ?? player.golden)) > 0);
  const losses = Object.values(previous.players).some(player => (next.players[player.id]?.golden ?? player.golden) < player.golden);
  return losses && gainers.length ? { clip: 'bananaStolen', priority: 106, playerIds: gainers.map(player => player.id) } : null;
}

function cardGoldenRobbery(previous: GameState | null, next: GameState, playerId: string): Candidate | null {
  if (!previous) return null;
  const gain = (next.players[playerId]?.golden ?? 0) - (previous.players[playerId]?.golden ?? 0);
  const loss = Object.values(previous.players).some(player => (next.players[player.id]?.golden ?? player.golden) < player.golden);
  return gain > 0 && loss ? { clip: 'bananaStolen', priority: 105, playerIds: [playerId] } : null;
}

/** Selects one non-repeating audio cue from a state transition and its events. */
export function selectHostAudioCue(
  previous: GameState | null,
  next: GameState,
  events: DomainEvent[],
): HostAudioCue | null {
  const candidates: Candidate[] = [];

  if (previous === null) candidates.push({ clip: 'opening', priority: 10, playerIds: [] });
  const iaguguRobbery = iaguguGoldenRobbery(previous, next);
  if (iaguguRobbery) candidates.push(iaguguRobbery);
  if (previous && next.pending?.kind !== previous.pending?.kind) {
    const ids = pendingDuelIds(next.pending);
    if (ids.length) candidates.push({ clip: 'duel', priority: 100, playerIds: ids });
  }

  for (const event of events) {
    switch (event.type) {
      case 'goldenBananaPurchased':
        candidates.push({ clip: 'bananaBought', priority: 85, playerIds: [event.playerId] });
        break;
      case 'cardResolved': {
        if (event.cardId === 'MS01') {
          const stolen = cardGoldenRobbery(previous, next, event.playerId);
          if (stolen) candidates.push(stolen);
          break;
        }
        const card = cardCandidate(event);
        if (card) candidates.push(card);
        if (event.cardId === 'MS06') candidates.push({ clip: 'duel', priority: 100, playerIds: [event.playerId] });
        break;
      }
      case 'gameCompleted':
        if (event.winners.length === 1) candidates.push({ clip: 'champion', priority: 120, playerIds: event.winners });
        break;
      default:
        break;
    }
  }
  if (previous && previous.round !== next.round && next.round === next.config.rounds) {
    candidates.push({ clip: 'lastRound', priority: 90, playerIds: [] });
  }

  // Missing source files intentionally remove their candidate (duel and
  // minigameWin are not present among the unambiguous approved files).
  const available = candidates.filter((candidate): candidate is Candidate & { clip: HostAudioClip } => candidate.clip in HOST_AUDIO_CLIPS);
  const best = available.reduce<(Candidate & { clip: HostAudioClip }) | null>((winner, candidate) => (
    !winner || candidate.priority >= winner.priority ? candidate : winner
  ), null);
  return best ? cue(best) : null;
}
