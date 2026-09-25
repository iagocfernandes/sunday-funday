import { describe, expect, it } from 'vitest';
import { createGame } from '../game/engine';
import type { DomainEvent, GameState } from '../game/types';
import { HOST_AUDIO_CLIPS, selectHostAudioCue } from './hostAudioCues';

function game(): GameState {
  return createGame(
    ['Iago', 'Milena', 'AR2'].map((name, i) => ({ id: `p${i}`, name, color: '#abc', symbol: 'X', portrait: '/x.png' })),
    {},
    { seed: 17, shuffleOrder: false },
  );
}

describe('host audio cues AR2', () => {
  it('returns the opening once and exposes stable measured clip metadata', () => {
    const next = game();
    expect(selectHostAudioCue(null, next, [])).toMatchObject({ clip: 'opening', durationMs: HOST_AUDIO_CLIPS.opening.durationMs, playerIds: [] });
    expect(HOST_AUDIO_CLIPS.opening.src).toBe('/assets/audio/ar2/opening.wav');
  });

  it('prioritizes sober/robbery over generic luck and separates banana purchase', () => {
    const state = game();
    const luck: DomainEvent = { type: 'cardResolved', playerId: 'p0', cardId: 'MS02' };
    const sober: DomainEvent = { type: 'cardResolved', playerId: 'p1', cardId: 'MA02' };
    expect(selectHostAudioCue(state, state, [luck, sober])).toMatchObject({ clip: 'sober', playerIds: ['p1'] });
    expect(selectHostAudioCue(state, state, [{ type: 'goldenBananaPurchased', playerId: 'p0' }])).toMatchObject({ clip: 'bananaBought', playerIds: ['p0'] });
    const stolenNext = structuredClone(state);
    state.players.p1.golden = 1;
    stolenNext.players.p1.golden = 0;
    stolenNext.players.p0.golden = state.players.p0.golden + 1;
    expect(selectHostAudioCue(state, stolenNext, [{ type: 'cardResolved', playerId: 'p0', cardId: 'MS01' }])).toMatchObject({ clip: 'bananaStolen', playerIds: ['p0'] });
    expect(selectHostAudioCue(state, state, [{ type: 'cardResolved', playerId: 'p0', cardId: 'MS01' }])).toBeNull();
  });

  it('refuses missing minigame/duel audio, refuses tied champion, and keeps final-round winners separate', () => {
    const state = game();
    expect(selectHostAudioCue(state, state, [{ type: 'minigameCompleted', minigameId: 'quiz', winners: ['p0', 'p1'] }])).toBeNull();
    expect(selectHostAudioCue(state, state, [{ type: 'gameCompleted', winners: [] }])).toBeNull();
    expect(selectHostAudioCue(state, state, [{ type: 'gameCompleted', winners: ['p0', 'p1'] }])).toBeNull();
    expect(selectHostAudioCue(state, state, [{ type: 'cardResolved', playerId: 'p0', cardId: 'MS06' }])).toBeNull();
    const last = structuredClone(state);
    last.round = last.config.rounds;
    const beforeLast = structuredClone(last);
    beforeLast.round -= 1;
    expect(selectHostAudioCue(beforeLast, last, [{ type: 'roundStarted', round: last.round }])).toMatchObject({ clip: 'lastRound', playerIds: [] });
    expect(selectHostAudioCue(state, state, [{ type: 'gameCompleted', winners: ['p0'] }])).toMatchObject({ clip: 'champion', playerIds: ['p0'] });
  });

  it('does not cue card preview, only its resolved event', () => {
    const previous = game();
    previous.pending = { kind: 'cardPreview', playerId: 'p0', cardId: 'MS02', category: 'luck' };
    const next = structuredClone(previous);
    expect(selectHostAudioCue(previous, next, [])).toBeNull();
    next.pending = null;
    expect(selectHostAudioCue(previous, next, [{ type: 'cardResolved', playerId: 'p0', cardId: 'MS02' }])).toMatchObject({ clip: 'luck', playerIds: ['p0'] });
  });

  it('detects Iagugu golden theft from the authoritative golden delta', () => {
    const previous = game();
    previous.players.p1.golden = 1;
    const next = structuredClone(previous);
    next.players.p1.golden = 0;
    next.players.p0.golden = 1;
    next.notice = 'Iagugu concluiu o roubo para Iago.';
    expect(selectHostAudioCue(previous, next, [])).toMatchObject({ clip: 'bananaStolen', playerIds: ['p0'] });
  });

  it('uses the final-round transition once even when roundStarted is also present', () => {
    const previous = game();
    previous.round = previous.config.rounds - 1;
    const next = structuredClone(previous);
    next.round = next.config.rounds;
    expect(selectHostAudioCue(previous, next, [{ type: 'roundStarted', round: next.round }])).toMatchObject({ clip: 'lastRound' });
  });
});
