import { useState } from 'react';
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
  return <MiguelHostView reaction={host} enabled={enabled} className={className} />;
}

/** View-only variant for BoardTv: call the hook once and pass its stable reaction. */
export function MiguelHostView({ reaction, enabled, className = '' }: { reaction: MiguelHostReaction | MiguelHostResult; enabled: boolean; className?: string }) {
  const [spriteFailed, setSpriteFailed] = useState(false);
  if (!enabled) return null;
  return (
    <aside className={`miguel-host miguel-host--${reaction.mood} ${className}`.trim()} aria-live="polite" aria-atomic="true">
      <div className="miguel-host__face" aria-hidden="true">
        {!spriteFailed && <span className="miguel-host__sprite" />}
        {spriteFailed && <img className="miguel-host__fallback" src="/assets/host/miguel-reference.png" alt="" />}
        <img className="miguel-host__sprite-probe" src="/assets/host/miguel-expressions.png" alt="" onError={() => setSpriteFailed(true)} />
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
