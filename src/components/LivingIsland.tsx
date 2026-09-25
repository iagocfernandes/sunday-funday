import { useEffect, useId, useState } from 'react';
import './living-island.css';

const ART = '/assets/board/ilha-v4-2x.webp';

// Coordenadas calibradas para a arte aprovada em viewBox 1000×563.
// Trocar a imagem de base exige recalibrar máscaras; não há visão computacional em runtime.
const CANOPIES = [
  { cx: 282, cy: 31, rx: 55, ry: 28, faceX: 282, faceY: 54, faceRx: 22, faceRy: 25, pivotX: 282, pivotY: 70, delay: -1.4 },
  { cx: 842, cy: 91, rx: 55, ry: 29, faceX: 842, faceY: 124, faceRx: 23, faceRy: 28, pivotX: 842, pivotY: 145, delay: -4.8 },
  { cx: 687, cy: 184, rx: 55, ry: 29, faceX: 687, faceY: 211, faceRx: 23, faceRy: 27, pivotX: 687, pivotY: 235, delay: -2.7 },
  { cx: 502, cy: 338, rx: 57, ry: 30, faceX: 502, faceY: 366, faceRx: 23, faceRy: 28, pivotX: 502, pivotY: 398, delay: -6.1 },
] as const;

const FALLS = [
  {
    id: 'temple',
    path: 'M744 59C751 63 758 59 766 63C768 83 768 105 765 126C758 132 750 129 743 124C748 101 747 79 744 59Z',
    x: 740, y: 55, width: 32, height: 79, foamX: 757, foamY: 129, foamRx: 18, delay: -1.3,
  },
  {
    id: 'east',
    path: 'M841 177C849 181 858 177 864 183C865 199 861 214 867 226C871 237 867 252 859 264C850 263 843 256 840 247C846 225 844 201 841 177Z',
    x: 837, y: 173, width: 36, height: 96, foamX: 856, foamY: 264, foamRx: 21, delay: -2.1,
  },
  {
    id: 'lagoon',
    path: 'M476 147C481 151 486 149 491 154C490 167 491 181 487 190C483 195 477 195 472 190C477 176 476 161 476 147Z',
    x: 469, y: 143, width: 26, height: 54, foamX: 482, foamY: 192, foamRx: 12, delay: -0.6,
  },
  {
    id: 'bridge',
    path: 'M490 422C501 428 518 424 528 430C525 449 530 465 525 484C520 500 513 515 503 524C493 516 487 505 483 493C492 469 488 445 490 422Z',
    x: 480, y: 418, width: 51, height: 109, foamX: 505, foamY: 518, foamRx: 28, delay: -3.2,
  },
] as const;

/** Movimento ambiental recortado da própria arte; não altera o tabuleiro. */
export function LivingIsland({ paused = false }: { paused?: boolean }) {
  const id = useId().replace(/:/g, '');
  const [hidden, setHidden] = useState(() => typeof document !== 'undefined' && document.visibilityState === 'hidden');

  useEffect(() => {
    const update = () => setHidden(document.visibilityState === 'hidden');
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);

  return <g className={`living-island ${paused || hidden ? 'is-paused' : ''}`} aria-hidden="true" pointerEvents="none">
    <defs>
      <radialGradient id={`${id}-canopy-feather`}>
        <stop offset="0" stopColor="white" />
        <stop offset=".76" stopColor="white" />
        <stop offset="1" stopColor="black" />
      </radialGradient>
      <linearGradient id={`${id}-water-light`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#eaffff" stopOpacity=".08" />
        <stop offset=".22" stopColor="#f7ffff" stopOpacity=".46" />
        <stop offset=".52" stopColor="#90e9ef" stopOpacity=".13" />
        <stop offset=".76" stopColor="#ffffff" stopOpacity=".38" />
        <stop offset="1" stopColor="#c6ffff" stopOpacity=".08" />
      </linearGradient>
      <filter id={`${id}-face-soft`} x="-25%" y="-25%" width="150%" height="150%">
        <feGaussianBlur stdDeviation="2.4" />
      </filter>
      <filter id={`${id}-foam-soft`} x="-45%" y="-100%" width="190%" height="300%">
        <feGaussianBlur stdDeviation="2.1" />
      </filter>
      <filter id={`${id}-flow-warp`} x="-15%" y="-8%" width="130%" height="116%" colorInterpolationFilters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency=".018 .075" numOctaves="1" seed="12" result="noise" />
        <feDisplacementMap in="SourceGraphic" in2="noise" scale="5" xChannelSelector="R" yChannelSelector="B" />
      </filter>
      {CANOPIES.map((canopy, index) => <mask
        key={index}
        id={`${id}-canopy-${index}`}
        maskUnits="userSpaceOnUse"
        x={canopy.cx - canopy.rx - 8}
        y={canopy.cy - canopy.ry - 8}
        width={canopy.rx * 2 + 16}
        height={canopy.ry * 2 + 16}
      >
        <ellipse cx={canopy.cx} cy={canopy.cy} rx={canopy.rx} ry={canopy.ry} fill={`url(#${id}-canopy-feather)`} />
        <ellipse cx={canopy.faceX} cy={canopy.faceY} rx={canopy.faceRx} ry={canopy.faceRy} fill="black" filter={`url(#${id}-face-soft)`} />
      </mask>)}
      {FALLS.map(fall => <mask key={fall.id} id={`${id}-fall-${fall.id}`} maskUnits="userSpaceOnUse" x={fall.x - 4} y={fall.y - 4} width={fall.width + 8} height={fall.height + 8}>
        <path d={fall.path} fill="white" stroke="white" strokeWidth="2.5" filter={`url(#${id}-face-soft)`} />
      </mask>)}
    </defs>

    {CANOPIES.map((canopy, index) => <g key={index} mask={`url(#${id}-canopy-${index})`}>
      <g
        className="island-canopy"
        style={{ transformOrigin: `${canopy.pivotX}px ${canopy.pivotY}px`, animationDelay: `${canopy.delay}s` }}
      >
        <image href={ART} width="1000" height="563" />
      </g>
    </g>)}

    {FALLS.map(fall => <g key={fall.id} className="island-fall">
      <g mask={`url(#${id}-fall-${fall.id})`}>
        <image className="island-water-texture" href={ART} width="1000" height="563" style={{ animationDelay: `${fall.delay}s` }} />
        <rect
          className="island-water-sheet"
          x={fall.x}
          y={fall.y - 8}
          width={fall.width}
          height={fall.height + 16}
          rx="8"
          fill={`url(#${id}-water-light)`}
          filter={`url(#${id}-flow-warp)`}
          style={{ animationDelay: `${fall.delay * .7}s` }}
        />
      </g>
      <g className="island-foam" filter={`url(#${id}-foam-soft)`} style={{ animationDelay: `${fall.delay * .55}s` }}>
        <ellipse cx={fall.foamX} cy={fall.foamY} rx={fall.foamRx} ry="4.2" fill="#efffff" opacity=".54" />
        <ellipse cx={fall.foamX - fall.foamRx * .28} cy={fall.foamY - 5} rx={fall.foamRx * .55} ry="5.5" fill="#dffbff" opacity=".28" />
      </g>
      <g className="island-mist" filter={`url(#${id}-foam-soft)`} style={{ animationDelay: `${fall.delay * .4}s` }}>
        <ellipse cx={fall.foamX - fall.foamRx * .35} cy={fall.foamY - 8} rx={fall.foamRx * .58} ry="4.6" fill="#f5ffff" opacity=".2" />
        <ellipse cx={fall.foamX + fall.foamRx * .35} cy={fall.foamY - 6} rx={fall.foamRx * .48} ry="3.8" fill="#e2ffff" opacity=".18" />
      </g>
    </g>)}
  </g>;
}
