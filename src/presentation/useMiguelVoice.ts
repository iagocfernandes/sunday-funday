import { useEffect, useRef, useState } from 'react';
import type { MiguelHostReaction } from './useMiguelHost';

interface MiguelVoiceOptions {
  enabled: boolean;
  paused: boolean;
  muted: boolean;
}

/** Optional browser narration. No uploaded voice, network request or autoplay. */
export function useMiguelVoice(
  reaction: MiguelHostReaction,
  { enabled, paused, muted }: MiguelVoiceOptions,
) {
  const supported = typeof window !== 'undefined'
    && 'speechSynthesis' in window
    && 'SpeechSynthesisUtterance' in window;
  const [speaking, setSpeaking] = useState(false);
  const [hidden, setHidden] = useState(
    () => typeof document !== 'undefined' && document.visibilityState === 'hidden',
  );
  const seen = useRef<string | null>(null);
  const current = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const update = () => setHidden(document.visibilityState === 'hidden');
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);

  useEffect(() => {
    if (!supported) return;
    const synth = window.speechSynthesis;
    const stop = () => {
      if (current.current) {
        current.current.onstart = null;
        current.current.onend = null;
        current.current.onerror = null;
        current.current = null;
        synth.cancel();
      }
      setSpeaking(false);
    };

    // Consume the current message while blocked so resuming never narrates history.
    if (!enabled || paused || muted || hidden) {
      stop();
      if (reaction.messageId) seen.current = reaction.messageId;
      return;
    }
    if (!reaction.visible || !reaction.text || !reaction.messageId) {
      stop();
      return;
    }
    if (seen.current === reaction.messageId) return;

    stop();
    seen.current = reaction.messageId;
    const line = new SpeechSynthesisUtterance(reaction.text);
    line.lang = 'pt-BR';
    line.rate = 1.02;
    line.pitch = .88;
    line.volume = .85;
    const voices = synth.getVoices();
    const voice = voices.find(candidate => candidate.lang.toLowerCase() === 'pt-br')
      ?? voices.find(candidate => candidate.lang.toLowerCase().startsWith('pt'));
    if (voice) line.voice = voice;

    current.current = line;
    line.onstart = () => {
      if (current.current === line) setSpeaking(true);
    };
    const finish = () => {
      if (current.current === line) {
        current.current = null;
        setSpeaking(false);
      }
    };
    line.onend = finish;
    line.onerror = finish;
    try {
      synth.speak(line);
    } catch {
      finish();
    }
  }, [enabled, paused, muted, hidden, supported, reaction.visible, reaction.text, reaction.messageId]);

  useEffect(() => () => {
    if (current.current && supported) {
      current.current.onstart = null;
      current.current.onend = null;
      current.current.onerror = null;
      window.speechSynthesis.cancel();
      current.current = null;
    }
  }, [supported]);

  return { supported, speaking };
}
