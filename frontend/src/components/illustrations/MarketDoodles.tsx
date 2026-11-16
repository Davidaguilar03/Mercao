// Line drawings of a Colombian market square, in the visual language of the logo: rounded strokes
// in a single color. They are decoration only, so every drawing is hidden from screen readers.

import type { ReactNode } from 'react';

const STROKE_WIDTH = 2;

/** Each doodle is drawn inside a 64 x 64 box. */
const DOODLES = {
  basket: (
    <>
      <path d="M16 28c0-11 7-19 16-19s16 8 16 19" />
      <path d="M20 28c0-4 3-7 6-7s6 3 6 7M32 28c0-5 3-8 7-8s7 3 7 8" />
      <path d="M8 28h48a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-2a2 2 0 0 1 2-2z" />
      <path d="M10 34l4 19c.6 2.6 2.4 4 5 4h26c2.6 0 4.4-1.4 5-4l4-19" />
      <path d="M12 42h40M14 50h36M23 34l1.5 23M32 34v23M41 34l-1.5 23" />
    </>
  ),
  sack: (
    <>
      <path d="M21 19c-7 7-11 15-11 24 0 9 7 14 22 14s22-5 22-14c0-9-4-17-11-24" />
      <path d="M21 19c5 2 17 2 22 0" />
      <path d="M21 19l-4-8c5 2 10 2 15 0 5 2 10 2 15 0l-4 8" />
      <path d="M19 35c8 3 18 3 26 0M17 45c3 2.5 7 3.5 11 4M38 44h6M41 41v6" />
    </>
  ),
  crate: (
    <>
      <path d="M8 30h48v24a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2z" />
      <path d="M8 39h48M8 47h48M17 30v26M47 30v26" />
      <path d="M12 30c0-5 3-8 7-8s7 3 7 8M26 30c0-6 3-10 8-10s8 4 8 10M42 30c0-5 3-8 6-8s6 3 6 8" />
      <path d="M34 20v-5M34 16c2-3 5-4 8-3" />
    </>
  ),
  scale: (
    <>
      <path d="M22 57h20M32 57V15M12 19h40" />
      <path d="M32 15a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z" />
      <path d="M12 19L5 35M12 19l7 16M3 35h18c0 5-4 9-9 9s-9-4-9-9z" />
      <path d="M52 19l-7 16M52 19l7 16M43 35h18c0 5-4 9-9 9s-9-4-9-9z" />
      <path d="M8 35c0-3 2-5 4-5s4 2 4 5" />
    </>
  ),
  stall: (
    <>
      <path d="M9 11h46l5 13H4z" />
      <path d="M4 24a7 5 0 0 0 14 0 7 5 0 0 0 14 0 7 5 0 0 0 14 0 7 5 0 0 0 14 0" />
      <path d="M20 11l-2 13M32 11v13M44 11l2 13" />
      <path d="M10 30v26M54 30v26M6 56h52M6 43h52" />
      <path d="M15 43c0-4 2-6 5-6s5 2 5 6M27 43c0-5 2.5-7 5.5-7s5.5 2 5.5 7M40 43c0-4 2-6 5-6s5 2 5 6" />
      <path d="M22 49h20" />
    </>
  ),
  potato: (
    <>
      <path d="M11 37c-2-11 7-22 20-23 12-1 22 6 22 17 0 12-11 20-24 20-10 0-16-5-18-14z" />
      <path d="M23 28c1 1.5 3 1.5 4 0M36 24c1 1.5 3 1.5 4 0M40 36c1 1.5 3 1.5 4 0M26 41c1 1.5 3 1.5 4 0" />
    </>
  ),
  tomato: (
    <>
      <path d="M32 22c-12-4-22 4-22 15s10 19 22 19 22-8 22-19-10-19-22-15z" />
      <path d="M32 22l-8-3M32 22l8-3M32 22l-4 6M32 22l4 6M32 22c0-4 1-8 4-11" />
      <path d="M17 38c0-4 2-8 5-10" />
    </>
  ),
  onion: (
    <>
      <path d="M32 20c-12 3-20 11-20 20 0 10 9 16 20 16s20-6 20-16c0-9-8-17-20-20z" />
      <path d="M32 20c-6 9-8 20-5 35M32 20c6 9 8 20 5 35" />
      <path d="M32 20c-1-5 0-9 3-12M32 20c-3-3-4-7-3-10M28 56l-1 3M32 56v3.5M36 56l1 3" />
    </>
  ),
  carrot: (
    <>
      <path d="M30 22c4-4 10-4 13 0s3 9-1 13L14 56c-2 1.5-5-1-3.5-3.5z" />
      <path d="M33 28l5 3M26 35l5 3.5M21 43l4 3" />
      <path d="M40 20c0-6 2-10 6-13M42 20c3-5 8-7 14-6M43 22c5-2 10-1 14 2" />
    </>
  ),
  plantain: (
    <>
      <path d="M12 22c2 16 14 28 32 30 3 0 5-1 6-3-16-2-28-12-32-28-2-2-5-1-6 1z" />
      <path d="M17 24c4 13 13 21 29 25M12 22l-1-6 5-1 2 6M50 49l4 1" />
      <path d="M22 17c3 12 11 21 26 26 2 .5 4.5 0 6-1.5-13-4-22-12-26-25M22 17l-1-5 5-1 2 6" />
    </>
  ),
  leaf: (
    <>
      <path d="M10 54c0-24 14-42 44-44 0 28-16 44-44 44z" />
      <path d="M10 54c12-14 24-26 38-38M22 42l-2-12M30 34l-2-12M26 38l12 2M34 30l12 2" />
    </>
  ),
  cart: (
    <>
      <path d="M14 26h40l-6 16H20z" />
      <path d="M14 26l-6-6H3" />
      <path d="M18 26c0-6 4-9 8-9s8 3 8 9M34 26c0-5 3-8 7-8s7 3 7 8" />
      <path d="M34 43a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM34 50h.01" />
      <path d="M20 42l-4 14M12 56h8M48 42l4 14M48 56h8" />
    </>
  ),
  priceTag: (
    <>
      <path d="M34 8h18a4 4 0 0 1 4 4v18L30 56a3 3 0 0 1-4.2 0L8 38.2a3 3 0 0 1 0-4.2z" />
      <path d="M46 15a3 3 0 1 0 0 6 3 3 0 0 0 0-6z" />
      <path d="M20 36l9 9M26 30l12 12M31 24l7 7" />
    </>
  ),
  trend: (
    <>
      <path d="M6 48l12-10 8 6 12-16 8 5 12-17" />
      <path d="M48 14h10v10" />
      <path d="M6 10v48h52" />
    </>
  ),
  spark: (
    <>
      <path d="M6 40c8 0 8-14 16-14s8 10 16 10 9-17 17-19" />
      <path d="M55 20a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
      <path d="M6 52h4M16 52h4M26 52h4M36 52h4M46 52h4M56 52h2" />
    </>
  ),
} satisfies Record<string, ReactNode>;

export type DoodleName = keyof typeof DOODLES;

interface DoodleProps {
  name: DoodleName;
  className?: string;
}

/** One drawing on its own. Its size comes from CSS. */
export function Doodle({ name, className }: DoodleProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 64 64"
      fill="none"
      stroke="currentColor"
      strokeWidth={STROKE_WIDTH}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {DOODLES[name]}
    </svg>
  );
}

interface ScenePiece {
  name: DoodleName;
  x: number;
  y: number;
  scale: number;
  rotate?: number;
}

// A market stall on the ground line, with its produce around it and the trend line above.
// Laid out on a 220 x 100 canvas.
const SCENE: ScenePiece[] = [
  { name: 'trend', x: 6, y: 2, scale: 0.72 },
  { name: 'stall', x: 62, y: 14, scale: 1.45 },
  { name: 'sack', x: -3, y: 61, scale: 0.6 },
  { name: 'basket', x: 23, y: 60, scale: 0.62 },
  { name: 'crate', x: 151, y: 62, scale: 0.6 },
  { name: 'tomato', x: 187, y: 76, scale: 0.34 },
  { name: 'onion', x: 202, y: 77, scale: 0.3 },
  { name: 'leaf', x: 168, y: 6, scale: 0.5, rotate: 12 },
  { name: 'priceTag', x: 196, y: 30, scale: 0.34, rotate: -8 },
];

/** The whole market scene, used in the page header band and in the footer. */
export function MarketScene({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 220 100"
      fill="none"
      stroke="currentColor"
      strokeWidth={STROKE_WIDTH}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M2 96h216" />
      {SCENE.map((piece) => (
        <g
          key={piece.name}
          transform={`translate(${piece.x} ${piece.y}) scale(${piece.scale}) rotate(${piece.rotate ?? 0} 32 32)`}
          // Keeps the line weight even when a piece is drawn larger or smaller.
          strokeWidth={STROKE_WIDTH / piece.scale}
        >
          {DOODLES[piece.name]}
        </g>
      ))}
    </svg>
  );
}
