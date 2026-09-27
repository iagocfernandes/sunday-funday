import { useEffect, useRef, useState } from 'react';
import { hostVideoForMood, type HostVideoClip } from '../presentation/hostVideoClips';
import { useMiguelHost, type MiguelHostBoard, type MiguelHostReaction, type MiguelHostResult } from '../presentation/useMiguelHost';
import type { GameState } from '../game/types';
import './miguel-host.css';

interface Props {
  board: MiguelHostBoard;
  state: GameState;
  enabled: boolean;
  paused: boolean;
  className?: string;
}

/** Compact presentation-only host. It never captures pointer or keyboard input. */
export function MiguelHost({ board, state, enabled, paused, className }: Props) {
  const host = useMiguelHost({ board, state, enabled, paused });
  return <MiguelHostView reaction={host} enabled={enabled} paused={paused} videoScope={board.matchId} className={className} />;
}

const VIDEO_TIMEOUT_MS = 2500;
const MAX_SEEN_VIDEO_MESSAGES = 64;

function MiguelReactionVideo({ src, onAttempt, onFailed }: { src: string; onAttempt: () => void; onFailed: () => void }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const activeRef = useRef(true);
  const startedRef = useRef(false);
  const settledRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onAttemptRef = useRef(onAttempt);
  const onFailedRef = useRef(onFailed);
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading');
  onAttemptRef.current = onAttempt;
  onFailedRef.current = onFailed;

  const clearTimeoutRef = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
  };

  useEffect(() => {
    activeRef.current = true;
    onAttemptRef.current();
    timeoutRef.current = setTimeout(() => {
      if (!activeRef.current || settledRef.current) return;
      settledRef.current = true;
      setStatus('failed');
      onFailedRef.current();
    }, VIDEO_TIMEOUT_MS);
    return () => {
      activeRef.current = false;
      clearTimeoutRef();
      videoRef.current?.pause();
    };
  }, []);

  const fail = () => {
    if (!activeRef.current || settledRef.current) return;
    settledRef.current = true;
    clearTimeoutRef();
    setStatus('failed');
    onFailedRef.current();
  };

  const start = () => {
    const video = videoRef.current;
    if (!video || startedRef.current || settledRef.current) return;
    startedRef.current = true;
    void video.play().then(() => {
      if (!activeRef.current) return;
      clearTimeoutRef();
      setStatus('ready');
    }).catch(fail);
  };

  if (status === 'failed') return null;
  return <video
    ref={videoRef}
    className={`miguel-host__video miguel-host__video--${status}`}
    src={src}
    muted
    playsInline
    preload="metadata"
    aria-hidden="true"
    onLoadedData={start}
    onCanPlay={start}
    onError={fail}
    onStalled={fail}
  />;
}

/** View-only variant for BoardTv: call the hook once and pass its stable reaction. */
export function MiguelHostView({
  reaction,
  enabled,
  paused = false,
  videoSrc,
  videoClip = 'reaction',
  announcement = false,
  videoScope,
  className = '',
}: {
  reaction: MiguelHostReaction | MiguelHostResult;
  enabled: boolean;
  paused?: boolean;
  /** Preview/test injection, or an explicit video source for a special announcement. */
  videoSrc?: string;
  videoClip?: HostVideoClip | string;
  /** Announcements may play a clip even when they intentionally have no text bubble. */
  announcement?: boolean;
  /** Clears the bounded one-shot history when a different board session is shown. */
  videoScope?: string;
  className?: string;
}) {
  const [spriteFailed, setSpriteFailed] = useState(false);
  const [documentVisible, setDocumentVisible] = useState(() => typeof document === 'undefined' || document.visibilityState === 'visible');
  const [reducedMotion, setReducedMotion] = useState(false);
  const seenVideoMessages = useRef(new Set<string>());
  const seenVideoOrder = useRef<string[]>([]);
  const previousVideoScope = useRef(videoScope);
  const [activeVideoKey, setActiveVideoKey] = useState<string | null>(null);
  const resolvedVideoSrc = videoSrc ?? hostVideoForMood(reaction.mood, videoClip)?.src;
  const messageId = reaction.messageId ?? '';
  const eligible = enabled && !paused && documentVisible && !reducedMotion && Boolean(messageId) && Boolean(resolvedVideoSrc) && (reaction.visible || announcement);
  if (previousVideoScope.current !== videoScope) {
    previousVideoScope.current = videoScope;
    seenVideoMessages.current.clear();
    seenVideoOrder.current = [];
  }
  const videoKey = `${videoScope ?? ''}:${messageId}:${resolvedVideoSrc ?? ''}`;
  const canRenderVideo = eligible && (activeVideoKey === videoKey || !seenVideoMessages.current.has(messageId));

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const update = () => setDocumentVisible(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(query.matches);
    update();
    query.addEventListener?.('change', update);
    return () => query.removeEventListener?.('change', update);
  }, []);

  useEffect(() => {
    if (!eligible) setActiveVideoKey(null);
  }, [eligible]);

  const markVideoAttempted = () => {
    if (!seenVideoMessages.current.has(messageId)) {
      seenVideoMessages.current.add(messageId);
      seenVideoOrder.current.push(messageId);
      if (seenVideoOrder.current.length > MAX_SEEN_VIDEO_MESSAGES) {
        const expired = seenVideoOrder.current.shift();
        if (expired) seenVideoMessages.current.delete(expired);
      }
    }
    setActiveVideoKey(videoKey);
  };

  const failVideo = () => setActiveVideoKey(current => current === videoKey ? null : current);

  if (!enabled) return null;
  return (
    <aside className={`miguel-host miguel-host--${reaction.mood} ${className}`.trim()} aria-live="polite" aria-atomic="true">
      <div className="miguel-host__face" aria-hidden="true">
        {!spriteFailed && <span className="miguel-host__sprite" />}
        {spriteFailed && <img className="miguel-host__fallback" src="/assets/host/miguel-reference.png" alt="" />}
        <img className="miguel-host__sprite-probe" src="/assets/host/miguel-expressions.png" alt="" onError={() => setSpriteFailed(true)} />
        {canRenderVideo && resolvedVideoSrc && <MiguelReactionVideo key={videoKey} src={resolvedVideoSrc} onAttempt={markVideoAttempted} onFailed={failVideo} />}
      </div>
      <span className="miguel-host__name">AR2</span>
      {reaction.visible && reaction.text && (
        <div className="miguel-host__bubble" role="status">
          {reaction.text}
        </div>
      )}
      {reaction.visible && <button className="miguel-host__dismiss" type="button" onClick={reaction.dismiss} aria-label="Dispensar fala do AR2">×</button>}
    </aside>
  );
}
