import { useCallback, useEffect, useRef, useState } from 'react';
import type { BoardView, RemoteEvent } from '../remote/types';
import type { DomainEvent, GameState } from '../game/types';
import {
  audioCueForEvent,
  createAudioEngine,
  type AudioEventInput,
  type AudioEngine,
} from './audioEngine';

export interface GameAudioOptions {
  /** Board remoto da TV. O matchId impede tocar o histórico de outra partida. */
  board?: Pick<BoardView, 'matchId' | 'events'> | null;
  /** Estado público correspondente ao board, usado para contexto futuro de áudio. */
  state?: GameState | null;
  /** Pode ser board.events; também aceita eventos de domínio locais. */
  events?: readonly AudioEventInput[];
  /** Pausa da partida. Eventos recebidos durante a pausa são consumidos sem som. */
  paused?: boolean;
  /** Chave da aterrissagem visual (por exemplo, o id da cena atual). */
  stepKey?: string;
  /** Quando true, passos visuais substituem `movementFinished` do motor. */
  visualSteps?: boolean;
  /** Loop musical sintético, discreto e desligável. */
  ambientMusic?: boolean;
  /** Reduz a música a 25% durante fala/locução, preservando o slider original. */
  ducked?: boolean;
  initialMusicVolume?: number;
  initialEffectsVolume?: number;
}

export interface GameAudioControls {
  supported: boolean;
  enabled: boolean;
  muted: boolean;
  musicEnabled: boolean;
  musicVolume: number;
  effectsVolume: number;
  /** Chamar diretamente no onClick/onPointerUp da TV. Não há autoplay. */
  enable: () => Promise<boolean>;
  toggleMute: () => void;
  setMuted: (value: boolean) => void;
  toggleMusic: () => void;
  setMusicEnabled: (value: boolean) => void;
  setMusicVolume: (value: number) => void;
  setEffectsVolume: (value: number) => void;
}

export interface AudioEventCursor {
  matchId: string;
  seq: number;
  rawKeys: readonly string[];
}

const initialVisibility = () => typeof document === 'undefined' || document.visibilityState !== 'hidden';

function isSequencedEvent(value: AudioEventInput): value is RemoteEvent {
  return typeof value === 'object' && value !== null && 'seq' in value && 'event' in value;
}

function fingerprint(event: DomainEvent): string {
  return JSON.stringify(event);
}

/** Cursor puro para testes e para evitar replay em rerenders/reconexões. */
export function dedupeAudioEvents(
  events: readonly AudioEventInput[],
  matchId: string,
  previous: AudioEventCursor | null,
): { fresh: AudioEventInput[]; cursor: AudioEventCursor } {
  const sequenced = events.filter((input): input is RemoteEvent => isSequencedEvent(input) && input.matchId === matchId);
  const latest = sequenced.reduce((max, item) => Math.max(max, item.seq), 0);
  if (!previous || previous.matchId !== matchId) {
    return {
      fresh: [],
      cursor: {
        matchId,
        seq: latest,
        rawKeys: events.filter((input): input is DomainEvent => !isSequencedEvent(input)).map(fingerprint),
      },
    };
  }

  let seq = previous.seq;
  const rawKeys = new Set(previous.rawKeys);
  const fresh: AudioEventInput[] = [];
  for (const input of events) {
    if (isSequencedEvent(input)) {
      if (input.matchId === matchId && input.seq > seq) fresh.push(input);
      if (input.matchId === matchId) seq = Math.max(seq, input.seq);
      continue;
    }
    const key = fingerprint(input as DomainEvent);
    if (rawKeys.has(key)) continue;
    rawKeys.add(key);
    fresh.push(input);
  }
  return {
    fresh,
    cursor: { matchId, seq, rawKeys: Array.from(rawKeys).slice(-128) },
  };
}

/**
 * Áudio de apresentação apenas da TV. O primeiro lote de um match é sempre
 * considerado histórico; só eventos novos depois do cursor geram som.
 */
export function useGameAudio(options: GameAudioOptions): GameAudioControls {
  const engineRef = useRef<AudioEngine | null>(null);
  if (!engineRef.current) {
    engineRef.current = createAudioEngine({
      musicEnabled: options.ambientMusic ?? true,
      effectsVolume: options.initialEffectsVolume,
      musicVolume: options.initialMusicVolume,
    });
  }
  const engine = engineRef.current;
  const [enabled, setEnabled] = useState(false);
  const [muted, setMutedState] = useState(false);
  const [musicEnabled, setMusicEnabledState] = useState(options.ambientMusic ?? true);
  const [musicVolume, setMusicVolumeState] = useState(options.initialMusicVolume ?? 0.2);
  const [effectsVolume, setEffectsVolumeState] = useState(options.initialEffectsVolume ?? 0.55);
  const [visible, setVisible] = useState(initialVisibility);
  const cursorRef = useRef<AudioEventCursor | null>(null);
  const visualStepRef = useRef<{ matchId: string; key: string | undefined } | null>(null);
  const revealMatchRef = useRef<string | null>(null);
  const revealedCardsRef = useRef<{ matchId: string; keys: Set<string>; signatures: Set<string> } | null>(null);
  const stateRef = useRef<GameState | null | undefined>(options.state);
  stateRef.current = options.state;

  const events = options.events ?? options.board?.events ?? [];
  const firstSequencedMatch = events.find(isSequencedEvent)?.matchId;
  const boardMatchId = options.board?.matchId ?? firstSequencedMatch ?? options.state?.gameId ?? 'local';
  const paused = Boolean(options.paused);
  const visualSteps = options.visualSteps ?? options.stepKey !== undefined;

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const onVisibility = () => setVisible(document.visibilityState !== 'hidden');
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  useEffect(() => {
    engine.setSuspended(!visible || paused);
    engine.setMusicDucked(Boolean(options.ducked));
    if (enabled) engine.setMusicEnabled(musicEnabled);
  }, [engine, enabled, musicEnabled, options.ducked, paused, visible]);

  useEffect(() => () => engine.dispose(), [engine]);

  useEffect(() => {
    const stepKey = options.stepKey;
    const previous = visualStepRef.current;
    if (!previous || previous.matchId !== boardMatchId) {
      visualStepRef.current = { matchId: boardMatchId, key: stepKey };
      return;
    }
    if (previous.key === stepKey) return;
    visualStepRef.current = { matchId: boardMatchId, key: stepKey };
    if (enabled && visible && !paused) engine.play('step');
  }, [boardMatchId, enabled, engine, options.stepKey, paused, visible]);

  useEffect(() => {
    const pending = options.state?.pending;
    if (!pending || pending.kind !== 'cardPreview') return;
    const key = `${pending.playerId}:${pending.cardId}:${options.state?.revision ?? 0}`;
    const signature = `${pending.playerId}:${pending.cardId}`;
    if (revealMatchRef.current !== boardMatchId) {
      revealMatchRef.current = boardMatchId;
      revealedCardsRef.current = { matchId: boardMatchId, keys: new Set([key]), signatures: new Set([signature]) };
      return;
    }
    const previous = revealedCardsRef.current;
    if (!previous || previous.matchId !== boardMatchId) {
      // The first reveal after the hook mounted is new; a reveal present on
      // the first render was handled above as history.
      revealedCardsRef.current = { matchId: boardMatchId, keys: new Set([key]), signatures: new Set([signature]) };
      if (enabled && visible && !paused) engine.play(pending.category === 'luck' ? 'luck' : 'unluck');
      return;
    }
    if (previous.keys.has(key)) return;
    previous.keys.add(key);
    previous.signatures.add(signature);
    if (previous.keys.size > 64) {
      const oldest = previous.keys.values().next().value;
      if (oldest) previous.keys.delete(oldest);
    }
    if (enabled && visible && !paused) engine.play(pending.category === 'luck' ? 'luck' : 'unluck');
  }, [boardMatchId, enabled, engine, options.state, paused, visible]);

  /*
   * A state without pending.cardPreview establishes the match baseline. This
   * keeps a preview already present after reconnect silent while allowing the
   * first preview that arrives after mount to play.
   */
  useEffect(() => {
    if (revealMatchRef.current === boardMatchId) return;
    revealMatchRef.current = boardMatchId;
    revealedCardsRef.current = { matchId: boardMatchId, keys: new Set(), signatures: new Set() };
  }, [boardMatchId]);

  useEffect(() => {
    const result = dedupeAudioEvents(events, boardMatchId, cursorRef.current);
    cursorRef.current = result.cursor;
    for (const input of result.fresh) {
      if (isSequencedEvent(input)) {
        if (paused || !visible) continue;
        if (visualSteps && input.event.type === 'movementFinished') continue;
        if (
          input.event.type === 'cardResolved' &&
          stateRef.current?.config.cardMode === 'digital' &&
          revealedCardsRef.current?.matchId === boardMatchId &&
          revealedCardsRef.current.signatures.has(`${input.event.playerId}:${input.event.cardId}`)
        ) continue;
        const cue = audioCueForEvent(input.event, stateRef.current);
        if (cue) engine.play(cue);
        continue;
      }
      // Eventos locais também não podem ficar pendentes para depois do gesto.
      if (paused || !visible) continue;
      const cue = audioCueForEvent(input as DomainEvent, stateRef.current);
      if (cue) engine.play(cue);
    }
  }, [boardMatchId, engine, events, paused, visible, visualSteps]);

  const enable = useCallback(async () => {
    const ok = await engine.enable();
    if (ok) {
      setEnabled(true);
      engine.setMuted(muted);
      engine.setMusicDucked(Boolean(options.ducked));
      engine.setMusicEnabled(musicEnabled);
      engine.setSuspended(!visible || paused);
    }
    return ok;
  }, [engine, muted, musicEnabled, options.ducked, paused, visible]);

  const setMuted = useCallback((value: boolean) => {
    setMutedState(value);
    engine.setMuted(value);
  }, [engine]);

  const toggleMute = useCallback(() => setMuted(!muted), [muted, setMuted]);

  const setMusicEnabled = useCallback((value: boolean) => {
    setMusicEnabledState(value);
    engine.setMusicEnabled(value);
  }, [engine]);

  const toggleMusic = useCallback(() => setMusicEnabled(!musicEnabled), [musicEnabled, setMusicEnabled]);

  const setMusicVolume = useCallback((value: number) => {
    const next = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
    setMusicVolumeState(next);
    engine.setMusicVolume(next);
  }, [engine]);

  const setEffectsVolume = useCallback((value: number) => {
    const next = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
    setEffectsVolumeState(next);
    engine.setEffectsVolume(next);
  }, [engine]);

  return {
    supported: engine.supported,
    enabled: enabled && engine.enabled,
    muted,
    musicEnabled,
    musicVolume,
    effectsVolume,
    enable,
    toggleMute,
    setMuted,
    toggleMusic,
    setMusicEnabled,
    setMusicVolume,
    setEffectsVolume,
  };
}
