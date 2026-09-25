import { useCallback, useEffect, useRef, useState } from 'react';

export interface RecordedHostCue {
  id: string;
  src: string;
  durationMs: number;
}

export interface RecordedHostAudioOptions {
  enabled: boolean;
  paused: boolean;
  muted: boolean;
  onComplete: (id: string) => void;
}

export interface RecordedHostAudioControls {
  /** True while a cue is playing or waiting for a paused game to resume. */
  speaking: boolean;
  /** Ends the current cue and acknowledges it exactly once. */
  skip: () => void;
}

interface ActiveCue {
  id: string;
  audio: HTMLAudioElement;
  audioToken: number;
  paused: boolean;
  playPending: boolean;
  timer: ReturnType<typeof setTimeout> | null;
}

const MAX_CUE_TIMEOUT_MS = 40_000;
const SILENT_WAV_DATA_URI = 'data:audio/wav;base64,UklGRiUAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQEAAACA';

let sharedAudio: HTMLAudioElement | null = null;
let sharedAudioConstructor: typeof Audio | null = null;
let sharedAudioToken = 0;
let sharedAudioOwner: 'prime' | 'cue' | null = null;

function getSharedAudio(): HTMLAudioElement {
  const AudioConstructor = typeof Audio === 'function' ? Audio : null;
  if (!AudioConstructor) throw new Error('Audio indisponível neste ambiente');
  if (!sharedAudio || sharedAudioConstructor !== AudioConstructor) {
    sharedAudio = new AudioConstructor();
    sharedAudioConstructor = AudioConstructor;
  }
  return sharedAudio;
}

function claimSharedAudio(owner: 'prime' | 'cue'): number {
  sharedAudioToken += 1;
  sharedAudioOwner = owner;
  return sharedAudioToken;
}

/**
 * Unlocks the shared media element from a user gesture (especially Safari).
 * A cue that claims the element while this promise is pending wins the race;
 * the unlock completion then cannot pause or replace that cue.
 */
export function primeRecordedHostAudio(): Promise<boolean> {
  let audio: HTMLAudioElement;
  try {
    audio = getSharedAudio();
  } catch {
    return Promise.resolve(false);
  }
  if (sharedAudioOwner === 'cue') return Promise.resolve(true);

  const token = claimSharedAudio('prime');
  audio.preload = 'auto';
  audio.src = SILENT_WAV_DATA_URI;
  let playback: Promise<void>;
  try {
    playback = Promise.resolve(audio.play());
  } catch {
    if (sharedAudioToken === token) sharedAudioOwner = null;
    return Promise.resolve(false);
  }
  return playback.then(
    () => {
      if (sharedAudioToken === token && sharedAudioOwner === 'prime') {
        try { audio.pause(); } catch { /* best-effort */ }
        sharedAudioOwner = null;
      }
      return true;
    },
    () => {
      if (sharedAudioToken === token && sharedAudioOwner === 'prime') sharedAudioOwner = null;
      return false;
    },
  );
}

function rememberCompleted(ids: Set<string>, id: string): void {
  ids.add(id);
  if (ids.size > 128) {
    const oldest = ids.values().next().value;
    if (oldest) ids.delete(oldest);
  }
}

function isDocumentVisible(): boolean {
  return typeof document === 'undefined' || document.visibilityState !== 'hidden';
}

function cueTimeoutMs(durationMs: number): number {
  const duration = Number.isFinite(durationMs) ? Math.max(0, durationMs) : 0;
  return Math.min(MAX_CUE_TIMEOUT_MS, duration + 3_000);
}

/**
 * Plays one short recorded host cue at a time. Playback is intentionally
 * driven by the caller's enabled state, so the TV can gate it behind a user
 * gesture without invoking speech synthesis or autoplay.
 */
export function useRecordedHostAudio(
  cue: RecordedHostCue | null,
  options: RecordedHostAudioOptions,
): RecordedHostAudioControls {
  const [speaking, setSpeaking] = useState(false);
  const activeRef = useRef<ActiveCue | null>(null);
  const completedRef = useRef(new Set<string>());
  const mountedRef = useRef(true);
  const visibleRef = useRef(isDocumentVisible());
  const cueRef = useRef<RecordedHostCue | null>(cue);
  const onCompleteRef = useRef(options.onComplete);
  const finishRef = useRef<(id: string, notify?: boolean) => void>(() => undefined);
  cueRef.current = cue;
  onCompleteRef.current = options.onComplete;

  const finish = useCallback((id: string, notify = true) => {
    const active = activeRef.current;
    if (!active || active.id !== id) return;

    activeRef.current = null;
    rememberCompleted(completedRef.current, id);
    if (sharedAudioToken === active.audioToken && sharedAudioOwner === 'cue') sharedAudioOwner = null;
    if (active.timer !== null) clearTimeout(active.timer);
    active.timer = null;
    active.audio.onended = null;
    active.audio.onerror = null;
    try {
      active.audio.pause();
      active.audio.removeAttribute('src');
      active.audio.load();
    } catch {
      // Audio mocks and partially initialized media elements can omit methods.
    }
    if (mountedRef.current) {
      setSpeaking(false);
      if (notify) onCompleteRef.current(id);
    }
  }, []);

  finishRef.current = finish;

  const completeWithoutAudio = useCallback((id: string) => {
    if (completedRef.current.has(id)) return;
    rememberCompleted(completedRef.current, id);
    if (mountedRef.current) {
      setSpeaking(false);
      onCompleteRef.current(id);
    }
  }, []);

  const beginPlayback = useCallback((active: ActiveCue) => {
    if (activeRef.current !== active || active.paused || active.playPending || !mountedRef.current) return;
    active.playPending = true;
    if (active.timer === null) {
      active.timer = setTimeout(() => finishRef.current(active.id), cueTimeoutMs(cueRef.current?.durationMs ?? 0));
    }
    let playback: Promise<void>;
    try {
      playback = Promise.resolve(active.audio.play());
    } catch {
      finishRef.current(active.id);
      return;
    }
    playback.catch(() => {
      // A rejected play() is an acknowledgement, unless a pause caused it.
      if (activeRef.current === active && !active.paused) finishRef.current(active.id);
    });
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const onVisibilityChange = () => {
      const visible = document.visibilityState !== 'hidden';
      visibleRef.current = visible;
      if (!visible) {
        const active = activeRef.current;
        if (active) finishRef.current(active.id);
        else if (cueRef.current) completeWithoutAudio(cueRef.current.id);
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [completeWithoutAudio]);

  useEffect(() => {
    const current = activeRef.current;

    if (!cue) {
      if (current) finishRef.current(current.id);
      return;
    }

    if (current && current.id !== cue.id) finishRef.current(current.id);
    if (completedRef.current.has(cue.id)) return;

    const unavailable = !options.enabled || options.muted || !visibleRef.current || !isDocumentVisible();
    if (unavailable) {
      if (activeRef.current?.id === cue.id) finishRef.current(cue.id);
      else completeWithoutAudio(cue.id);
      return;
    }

    let active = activeRef.current;
    if (!active) {
      let audio: HTMLAudioElement;
      try {
        audio = getSharedAudio();
      } catch {
        completeWithoutAudio(cue.id);
        return;
      }
      audio.preload = 'auto';
      const audioToken = claimSharedAudio('cue');
      audio.src = cue.src;
      active = { id: cue.id, audio, audioToken, paused: options.paused, playPending: false, timer: null };
      activeRef.current = active;
      setSpeaking(true);
      audio.onended = () => finishRef.current(cue.id);
      audio.onerror = () => finishRef.current(cue.id);
    } else {
      active.paused = options.paused;
    }

    if (options.paused) {
      if (active.timer !== null) clearTimeout(active.timer);
      active.timer = null;
      active.playPending = false;
      try { active.audio.pause(); } catch { /* best-effort */ }
      return;
    }
    beginPlayback(active);
  }, [beginPlayback, completeWithoutAudio, cue?.durationMs, cue?.id, cue?.src, options.enabled, options.muted, options.paused]);

  useEffect(() => {
    // StrictMode re-runs effects after their probe cleanup; restore the gate
    // before accepting the next media callback.
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      const active = activeRef.current;
      if (active) {
        // React StrictMode probes effects with a cleanup followed immediately
        // by setup. Defer disposal one microtask so that probe is reversible;
        // a real unmount still releases the media without acknowledging it.
        const dispose = () => {
          if (!mountedRef.current && activeRef.current === active) finishRef.current(active.id, false);
        };
        if (typeof queueMicrotask === 'function') queueMicrotask(dispose);
        else void Promise.resolve().then(dispose);
      }
    };
  }, []);

  const skip = useCallback(() => {
    const active = activeRef.current;
    if (active) {
      finishRef.current(active.id);
      return;
    }
    const current = cueRef.current;
    if (current) completeWithoutAudio(current.id);
  }, [completeWithoutAudio]);

  return { speaking, skip };
}
