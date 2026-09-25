import { describe, expect, it } from 'vitest';
import type { DomainEvent } from '../game/types';
import { midiToFrequency, musicPhrasePlan } from './audioEngine';
import { dedupeAudioEvents } from './useGameAudio';

const dice = (value: number): DomainEvent => ({ type: 'diceRolled', playerId: 'p1', value, doubled: false });

describe('áudio da TV: cursor de eventos', () => {
  it('consome o histórico inicial e toca apenas seq novas', () => {
    const first = dedupeAudioEvents([
      { seq: 4, matchId: 'm1', event: dice(2) },
    ], 'm1', null);
    expect(first.fresh).toHaveLength(0);

    const second = dedupeAudioEvents([
      { seq: 4, matchId: 'm1', event: dice(2) },
      { seq: 5, matchId: 'm1', event: dice(6) },
    ], 'm1', first.cursor);
    expect(second.fresh).toHaveLength(1);
    expect(second.fresh[0]).toMatchObject({ seq: 5 });
  });

  it('zera o cursor na partida nova sem reproduzir o evento antigo', () => {
    const old = dedupeAudioEvents([{ seq: 9, matchId: 'm1', event: dice(3) }], 'm1', null);
    const next = dedupeAudioEvents([
      { seq: 99, matchId: 'm1', event: dice(3) },
      { seq: 1, matchId: 'm2', event: dice(4) },
    ], 'm2', old.cursor);
    expect(next.fresh).toHaveLength(0);
    expect(next.cursor).toMatchObject({ matchId: 'm2', seq: 1 });
  });

  it('deduplica eventos locais repetidos por renderização', () => {
    const event = dice(5);
    const first = dedupeAudioEvents([event], 'local', null);
    const second = dedupeAudioEvents([event], 'local', first.cursor);
    const third = dedupeAudioEvents([event, dice(6)], 'local', second.cursor);
    expect(second.fresh).toHaveLength(0);
    expect(third.fresh).toHaveLength(1);
  });

  it('gera uma frase determinística com harmonia, baixo, marimba e percussão', () => {
    const phrase = musicPhrasePlan(0);
    const voices = new Set(phrase.map((event) => event.voice));
    expect(voices).toEqual(new Set(['pad', 'bass', 'marimba', 'kick', 'conga', 'shaker']));
    expect(phrase.every((event) => event.atBeat >= 0 && event.atBeat < 16)).toBe(true);
    expect(phrase.filter((event) => event.voice === 'shaker').length).toBe(28);
    expect(midiToFrequency(69)).toBeCloseTo(440);
    expect(musicPhrasePlan(0)).toEqual(phrase);
  });

  it('alterna o motivo entre frases e abre uma variação na quarta barra', () => {
    const first = musicPhrasePlan(0);
    const second = musicPhrasePlan(1);
    const later = musicPhrasePlan(2);
    expect(second).not.toEqual(first);
    expect(later).not.toEqual(first);
    expect(later.some((event) => event.voice === 'marimba' && (event.midi ?? 0) >= 80)).toBe(true);
  });
});
