import { CARDS_BY_ID } from '../data/cards';
import type { DomainEvent, GameState } from '../game/types';

export type AudioCue =
  | 'dice'
  | 'step'
  | 'coins'
  | 'banana'
  | 'power'
  | 'luck'
  | 'unluck'
  | 'victory';

export interface SequencedAudioEvent {
  seq: number;
  matchId: string;
  event: DomainEvent;
}

export type AudioEventInput = DomainEvent | SequencedAudioEvent;

export interface AudioEngine {
  readonly supported: boolean;
  readonly enabled: boolean;
  enable(): Promise<boolean>;
  setSuspended(value: boolean): void;
  setMuted(value: boolean): void;
  setEffectsVolume(value: number): void;
  setMusicVolume(value: number): void;
  setMusicDucked(value: boolean): void;
  setMusicEnabled(value: boolean): void;
  play(cue: AudioCue): void;
  dispose(): void;
}

const COINS_THROTTLE_MS = 180;
const DEFAULT_EFFECTS_VOLUME = 0.55;
const DEFAULT_MUSIC_VOLUME = 0.2;
const MUSIC_BPM = 104;
const MUSIC_BEAT_SECONDS = 60 / MUSIC_BPM;
const MUSIC_BARS = 4;
const MUSIC_BEATS = MUSIC_BARS * 4;
const MUSIC_PHRASE_SECONDS = MUSIC_BEATS * MUSIC_BEAT_SECONDS;
const MUSIC_LOOKAHEAD_SECONDS = 0.75;

export type MusicVoice = 'pad' | 'bass' | 'marimba' | 'kick' | 'conga' | 'shaker';

export interface MusicEvent {
  voice: MusicVoice;
  atBeat: number;
  durationBeats: number;
  midi?: number;
  velocity: number;
}

const CHORDS: ReadonlyArray<readonly [number, number, number]> = [
  [50, 54, 57], // D major
  [47, 50, 54], // B minor
  [43, 47, 50], // G major
  [45, 52, 57], // A suspended, resolving to D on the next phrase
];

const BASS_ROOTS = [38, 35, 31, 33] as const;

/** Converte MIDI para frequência sem depender de afinação externa. */
export function midiToFrequency(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

/**
 * Arranjo procedural determinístico. Cada chamada é um pequeno cartão de
 * partitura: vozes, compassos e velocidades são testáveis sem AudioContext.
 * A variação alterna o motivo melódico e abre a última barra a cada duas frases.
 */
export function musicPhrasePlan(phraseIndex = 0): MusicEvent[] {
  const phrase = Math.max(0, Math.floor(phraseIndex));
  const events: MusicEvent[] = [];
  const add = (event: MusicEvent) => events.push(event);

  for (let bar = 0; bar < MUSIC_BARS; bar += 1) {
    const start = bar * 4;
    const chord = CHORDS[bar];
    chord.forEach((midi, index) => add({
      voice: 'pad', midi: midi + (index === 0 ? 0 : 12), atBeat: start,
      durationBeats: 3.8, velocity: index === 0 ? 0.035 : 0.022,
    }));

    // Baixo em síncope: sustenta o chão sem soar como uma batida reta.
    [0, 1.75, 2.5, 3.5].forEach((offset, index) => add({
      voice: 'bass', midi: BASS_ROOTS[bar] + (index === 2 ? 12 : 0),
      atBeat: start + offset, durationBeats: index === 0 ? 0.6 : 0.28,
      velocity: index === 0 ? 0.1 : 0.065,
    }));

    // Kick e conga formam um balanço leve, com resposta na parte fraca do compasso.
    [0, 2.5].forEach((offset, index) => add({
      voice: 'kick', atBeat: start + offset, durationBeats: index === 0 ? 0.28 : 0.18,
      velocity: index === 0 ? 0.11 : 0.075,
    }));
    [1.5, 3, 3.75].forEach((offset, index) => add({
      voice: 'conga', atBeat: start + offset, durationBeats: 0.16,
      velocity: index === 1 ? 0.065 : 0.045,
    }));
    for (let eighth = 0.5; eighth < 4; eighth += 0.5) {
      add({ voice: 'shaker', atBeat: start + eighth, durationBeats: 0.08, velocity: eighth % 1 === 0.5 ? 0.034 : 0.022 });
    }
  }

  const motifs = phrase % 2 === 0
    ? [
      [[62, 0.5], [66, 0.75], [69, 1.5], [66, 2.25], [64, 2.5], [62, 3.5]],
      [[59, 0.25], [62, 0.75], [66, 1.25], [69, 2], [66, 2.75], [62, 3.5]],
      [[62, 0.5], [66, 1], [69, 1.75], [71, 2.25], [69, 3], [66, 3.5]],
      [[69, 0.25], [66, 0.75], [64, 1.5], [62, 2.25], [66, 3], [69, 3.5]],
    ]
    : [
      [[69, 0.5], [71, 1.25], [74, 1.75], [71, 2.5], [69, 3.25]],
      [[66, 0.25], [69, 1], [71, 1.5], [74, 2.25], [71, 3.25]],
      [[67, 0.5], [71, 1], [74, 1.75], [76, 2.5], [74, 3.25]],
      [[69, 0.25], [71, 0.75], [74, 1.5], [71, 2.25], [69, 3], [74, 3.5]],
    ];
  motifs.forEach((motif, bar) => motif.forEach(([midi, atBeat], index) => add({
    voice: 'marimba', midi: midi + (phrase >= 2 && bar === 3 ? 12 : 0),
    atBeat: bar * 4 + atBeat, durationBeats: index % 3 === 0 ? 0.42 : 0.28,
    velocity: phrase % 2 === 0 ? 0.075 : 0.065,
  })));

  return events;
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

/** Mapeia o evento de domínio para um som curto. Eventos sem som retornam null. */
export function audioCueForEvent(event: DomainEvent, state?: GameState | null): AudioCue | null {
  void state;
  switch (event.type) {
    case 'diceRolled': return 'dice';
    case 'movementFinished': return 'step';
    case 'coinsChanged': return 'coins';
    case 'goldenBananaPurchased': return 'banana';
    case 'itemGranted':
    case 'itemUsed': return event.itemId === 'bananaTurbo' ? 'banana' : 'power';
    case 'cardResolved': {
      const card = CARDS_BY_ID[event.cardId];
      if (card?.category === 'luck') return 'luck';
      if (card?.category === 'unluck') return 'unluck';
      // Compatibilidade com catálogos antigos que codificavam a categoria no ID.
      return event.cardId.toUpperCase().startsWith('A') ? 'unluck' :
        event.cardId.toUpperCase().startsWith('S') ? 'luck' : 'power';
    }
    case 'attackResolved':
    case 'attackBlocked':
    case 'attackReversed':
      return 'power';
    case 'minigameCompleted':
    case 'gameCompleted':
      return 'victory';
    default:
      return null;
  }
}

interface AudioContextLike extends AudioContext {
  close(): Promise<void>;
}

interface WindowWithAudio extends Window {
  AudioContext?: typeof AudioContext;
  webkitAudioContext?: typeof AudioContext;
}

type SourceNode = OscillatorNode | AudioBufferSourceNode;

function getAudioContextConstructor(): typeof AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    const candidate = window as WindowWithAudio;
    return candidate.AudioContext ?? candidate.webkitAudioContext ?? null;
  } catch {
    return null;
  }
}

/**
 * Pequeno sintetizador sem arquivos externos. O contexto só é criado por
 * enable(), que deve ser chamado dentro de um gesto explícito do usuário.
 */
export function createAudioEngine(options: {
  effectsVolume?: number;
  musicVolume?: number;
  musicEnabled?: boolean;
} = {}): AudioEngine {
  const Context = getAudioContextConstructor();
  let context: AudioContextLike | null = null;
  let effectsBus: GainNode | null = null;
  let musicBus: GainNode | null = null;
  let muted = false;
  // Sem contexto ainda não há autoplay; false faz enable() funcionar sozinho.
  // setSuspended(true) antes/durante o gesto continua tendo precedência.
  let suspended = false;
  let musicEnabled = options.musicEnabled ?? true;
  let effectsVolume = clamp(options.effectsVolume ?? DEFAULT_EFFECTS_VOLUME);
  let musicVolume = clamp(options.musicVolume ?? DEFAULT_MUSIC_VOLUME);
  let musicDucked = false;
  let musicTimer: ReturnType<typeof setInterval> | null = null;
  let musicPhraseIndex = 0;
  let nextPhraseAt = 0;
  let lastCoinsAt = -Infinity;
  let noiseBuffer: AudioBuffer | null = null;
  const effectNodes = new Set<SourceNode>();
  const musicNodes = new Set<SourceNode>();
  const nodeCleanups = new Map<SourceNode, () => void>();

  const supported = Context !== null;

  const stopNodes = (nodes: Set<SourceNode>) => {
    for (const node of Array.from(nodes)) {
      const cleanup = nodeCleanups.get(node);
      try { node.stop(); } catch { /* já terminou */ }
      cleanup?.();
    }
    nodes.clear();
  };

  const stopMusic = () => {
    if (musicTimer !== null) {
      clearInterval(musicTimer);
      musicTimer = null;
    }
    stopNodes(musicNodes);
    nextPhraseAt = 0;
  };

  const stopEffects = () => {
    stopNodes(effectNodes);
  };

  const applyBusVolumes = () => {
    if (!effectsBus || !musicBus) return;
    const now = context?.currentTime ?? 0;
    effectsBus.gain.setTargetAtTime(muted ? 0 : effectsVolume, now, 0.01);
    musicBus.gain.setTargetAtTime(muted ? 0 : musicVolume * (musicDucked ? 0.25 : 1), now, 0.01);
  };

  const tone = (
    frequency: number,
    duration: number,
    at: number,
    bus: GainNode,
    nodes: Set<SourceNode>,
    type: OscillatorType = 'sine',
    endFrequency?: number,
    peak = 0.22,
  ) => {
    if (!context) return;
    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, at);
    if (endFrequency !== undefined) oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), at + duration);
    envelope.gain.setValueAtTime(0.0001, at);
    envelope.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak), at + Math.min(0.025, duration * 0.25));
    envelope.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    oscillator.connect(envelope);
    envelope.connect(bus);
    nodes.add(oscillator);
    const cleanup = () => {
      if (!nodeCleanups.has(oscillator)) return;
      nodeCleanups.delete(oscillator);
      nodes.delete(oscillator);
      try { oscillator.disconnect(); envelope.disconnect(); } catch { /* limpeza best-effort */ }
    };
    nodeCleanups.set(oscillator, cleanup);
    oscillator.addEventListener('ended', cleanup, { once: true });
    oscillator.start(at);
    oscillator.stop(at + duration + 0.02);
  };

  const ensureNoiseBuffer = () => {
    if (!context) return null;
    if (!noiseBuffer) {
      const length = Math.max(1, Math.floor(context.sampleRate * 0.8));
      noiseBuffer = context.createBuffer(1, length, context.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let index = 0; index < data.length; index += 1) {
        // Deterministic, inexpensive pseudo-noise avoids external samples.
        const value = Math.sin(index * 12.9898) * 43758.5453;
        data[index] = ((value - Math.floor(value)) * 2 - 1) * 0.7;
      }
    }
    return noiseBuffer;
  };

  const noiseHit = (
    at: number,
    duration: number,
    bus: GainNode,
    nodes: Set<SourceNode>,
    frequency: number,
    peak: number,
  ) => {
    if (!context) return;
    const buffer = ensureNoiseBuffer();
    if (!buffer) return;
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const envelope = context.createGain();
    source.buffer = buffer;
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(frequency, at);
    filter.Q.setValueAtTime(0.7, at);
    envelope.gain.setValueAtTime(0.0001, at);
    envelope.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak), at + 0.008);
    envelope.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    source.connect(filter);
    filter.connect(envelope);
    envelope.connect(bus);
    nodes.add(source);
    const cleanup = () => {
      if (!nodeCleanups.has(source)) return;
      nodeCleanups.delete(source);
      nodes.delete(source);
      try { source.disconnect(); filter.disconnect(); envelope.disconnect(); } catch { /* limpeza best-effort */ }
    };
    nodeCleanups.set(source, cleanup);
    source.addEventListener('ended', cleanup, { once: true });
    source.start(at);
    source.stop(at + duration + 0.015);
  };

  const scheduleMusicPhrase = (start: number) => {
    const bus = musicBus;
    if (!context || !bus || suspended || !musicEnabled) return;
    const phrase = musicPhrasePlan(musicPhraseIndex);
    musicPhraseIndex += 1;
    for (const event of phrase) {
      const at = start + event.atBeat * MUSIC_BEAT_SECONDS;
      const duration = event.durationBeats * MUSIC_BEAT_SECONDS;
      if (event.voice === 'shaker') {
        noiseHit(at, duration, bus, musicNodes, 5600, event.velocity);
        continue;
      }
      switch (event.voice) {
        case 'kick':
          tone(118, duration, at, bus, musicNodes, 'sine', 45, event.velocity);
          break;
        case 'conga':
          tone(205, duration, at, bus, musicNodes, 'triangle', 112, event.velocity);
          break;
        case 'pad':
        case 'bass':
        case 'marimba':
          if (event.midi === undefined) break;
          {
            const frequency = midiToFrequency(event.midi);
            if (event.voice === 'pad') {
              tone(frequency, duration, at, bus, musicNodes, 'sine', undefined, event.velocity);
            } else if (event.voice === 'bass') {
              // O baixo sustenta a fundamental; slides ficam reservados à percussão.
              tone(frequency, duration, at, bus, musicNodes, 'triangle', undefined, event.velocity);
            } else {
              tone(frequency, duration, at, bus, musicNodes, 'triangle', undefined, event.velocity);
              tone(frequency * 2, duration * 0.55, at + 0.008, bus, musicNodes, 'sine', undefined, event.velocity * 0.28);
            }
          }
          break;
        default:
          break;
      }
    }
  };

  const pumpMusic = () => {
    if (!context || suspended || !musicEnabled) return;
    const now = context.currentTime;
    if (nextPhraseAt <= 0) nextPhraseAt = now + 0.04;
    let scheduled = 0;
    while (nextPhraseAt <= now + MUSIC_LOOKAHEAD_SECONDS && scheduled < 3) {
      const start = nextPhraseAt;
      scheduleMusicPhrase(start);
      nextPhraseAt = start + MUSIC_PHRASE_SECONDS;
      scheduled += 1;
    }
  };

  const startMusic = () => {
    if (!context || suspended || !musicEnabled || musicTimer !== null) return;
    pumpMusic();
    musicTimer = setInterval(pumpMusic, 200);
  };

  const ensureBuses = () => {
    if (!context) return false;
    if (!effectsBus || !musicBus) {
      effectsBus = context.createGain();
      musicBus = context.createGain();
      effectsBus.connect(context.destination);
      musicBus.connect(context.destination);
      applyBusVolumes();
    }
    return true;
  };

  const play = (cue: AudioCue) => {
    const bus = effectsBus;
    if (!context || !bus || context.state === 'closed' || suspended || muted) return;
    const now = context.currentTime;
    if (cue === 'coins' && now * 1000 - lastCoinsAt < COINS_THROTTLE_MS) return;
    if (cue === 'coins') lastCoinsAt = now * 1000;
    const notes: Record<AudioCue, Array<[number, number, number, OscillatorType?, number?]>> = {
      dice: [[230, 0.09, 0, 'triangle', 480], [360, 0.12, 0.1, 'triangle', 620]],
      step: [[155, 0.08, 0, 'sine', 105]],
      coins: [[740, 0.1, 0, 'triangle'], [988, 0.11, 0.09, 'triangle'], [1318, 0.14, 0.18, 'triangle']],
      banana: [[392, 0.14, 0, 'sine'], [523, 0.14, 0.12, 'sine'], [784, 0.22, 0.24, 'sine']],
      power: [[185, 0.16, 0, 'sawtooth', 420], [420, 0.16, 0.14, 'triangle', 680]],
      luck: [[392, 0.13, 0, 'sine'], [523, 0.13, 0.11, 'sine'], [659, 0.2, 0.22, 'sine']],
      unluck: [[330, 0.14, 0, 'triangle'], [247, 0.14, 0.12, 'triangle'], [165, 0.24, 0.24, 'triangle']],
      victory: [[392, 0.15, 0, 'triangle'], [523, 0.15, 0.13, 'triangle'], [659, 0.15, 0.26, 'triangle'], [784, 0.36, 0.39, 'sine']],
    };
    for (const [frequency, duration, offset, type, endFrequency] of notes[cue]) {
      tone(frequency, duration, now + offset, bus, effectNodes, type, endFrequency);
    }
  };

  const engine: AudioEngine = {
    supported,
    get enabled() { return context !== null && context.state !== 'closed'; },
    async enable() {
      if (!Context || !ensureBuses()) return false;
      if (!context) {
        // ensureBuses creates the context below only through this branch.
        return false;
      }
      try {
        const activeContext = context;
        await activeContext.resume();
        if (context !== activeContext || activeContext.state === 'closed') return false;
        applyBusVolumes();
        if (suspended) {
          stopMusic();
          await activeContext.suspend();
        } else startMusic();
        return true;
      } catch {
        return false;
      }
    },
    setSuspended(value) {
      suspended = value;
      if (value) {
        stopMusic();
        stopEffects();
        if (context) void context.suspend().catch(() => undefined);
      } else if (context) {
        void context.resume().catch(() => undefined);
        startMusic();
      }
    },
    setMuted(value) {
      muted = value;
      applyBusVolumes();
    },
    setEffectsVolume(value) {
      effectsVolume = clamp(value);
      applyBusVolumes();
    },
    setMusicVolume(value) {
      musicVolume = clamp(value);
      applyBusVolumes();
    },
    setMusicDucked(value) {
      musicDucked = value;
      applyBusVolumes();
    },
    setMusicEnabled(value) {
      musicEnabled = value;
      if (!value) stopMusic();
      else startMusic();
    },
    play,
    dispose() {
      stopMusic();
      stopEffects();
      if (context) {
        const closing = context;
        context = null;
        void closing.close().catch(() => undefined);
      }
      effectsBus = null;
      musicBus = null;
      noiseBuffer = null;
    },
  };

  // Lazy creation is deliberate: constructing/resuming AudioContext here
  // would violate autoplay policies before the TV user clicks enable().
  const originalEnable = engine.enable;
  engine.enable = async () => {
    if (!Context) return false;
    if (!context) {
      try {
        context = new Context() as AudioContextLike;
        if (!ensureBuses()) {
          context = null;
          return false;
        }
      } catch {
        context = null;
        effectsBus = null;
        musicBus = null;
        return false;
      }
    }
    return originalEnable();
  };
  return engine;
}
