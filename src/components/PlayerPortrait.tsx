import './PlayerPortrait.css';
import {displayPortrait} from '../presentation/portrait';
import type { CSSProperties } from 'react';

export interface PlayerPortraitProps {
  src: string | undefined;
  alt?: string;
  className?: string;
  style?: CSSProperties;
}

type OfficialCharacter = 'arthur' | 'mari' | 'milena';

function officialCharacter(src: string | undefined): OfficialCharacter | null {
  const match = src?.match(/^\/?assets\/characters\/(arthur|mari|milena)-v1\.png$/);
  return (match?.[1] as OfficialCharacter | undefined) ?? null;
}

/** Avatar circular com enquadramento de rosto apenas para os assets oficiais. */
export function PlayerPortrait({ src, alt = '', className = '', style }: PlayerPortraitProps) {
  const displaySrc = displayPortrait(src);
  const character = officialCharacter(displaySrc);
  const classes = [
    'player-portrait',
    character ? 'player-portrait--official' : 'player-portrait--photo',
    character ? `player-portrait--${character}` : '',
    className,
  ].filter(Boolean).join(' ');

  return (
    <span className={classes} style={style} aria-label={!src && alt ? alt : undefined}>
      {displaySrc ? <img className="player-portrait__image" src={displaySrc} alt={alt} /> : null}
    </span>
  );
}
