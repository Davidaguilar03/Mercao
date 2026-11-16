// Line drawings of a Colombian market square, in the visual language of the logo: rounded strokes
// in a single color. They are decoration only, so every drawing is hidden from screen readers.

import type { ReactNode } from 'react';

/** Each doodle is drawn inside a 64 x 64 box. */
const DOODLES = {
  basket: (
    <>
      <path d="M12 30c0-13 9-22 20-22s20 9 20 22" />
      <path d="M6 30h52" />
      <path d="M10 30l5 22c1 3 3 4 6 4h22c3 0 5-1 6-4l5-22" />
      <path d="M13 40h38M16 49h32" />
      <path d="M24 30l2 26M32 30v26M40 30l-2 26" />
    </>
  ),
  potato: (
    <>
      <path d="M12 36c-2-12 8-22 21-22 12 0 21 7 20 18-1 12-12 20-24 19-9 0-16-6-17-15z" />
      <path d="M26 28h.5M37 25h.5M41 36h.5M29 40h.5" />
    </>
  ),
  tomato: (
    <>
      <path d="M32 20c-12-3-22 5-22 17 0 11 10 19 22 19s22-8 22-19c0-12-10-20-22-17z" />
      <path d="M32 20c-4-2-8-2-11 0M32 20c4-2 8-2 11 0M32 20c-2 3-2 6 0 8M32 20v-9" />
      <path d="M19 36c0-4 2-7 5-9" />
    </>
  ),
  onion: (
    <>
      <path d="M32 18c-13 3-20 12-20 21 0 10 9 17 20 17s20-7 20-17c0-9-7-18-20-21z" />
      <path d="M32 18c-5 9-7 19-5 37M32 18c5 9 7 19 5 37" />
      <path d="M32 18c-1-5 0-8 3-11M32 18c-3-3-4-6-3-9" />
    </>
  ),
  leaf: (
    <>
      <path d="M10 54c0-24 14-42 44-44 0 28-16 44-44 44z" />
      <path d="M10 54c12-14 24-26 38-38M22 42l-2-12M30 34l-2-12M26 38l12 2M34 30l12 2" />
    </>
  ),
  stall: (
    <>
      <path d="M6 14h52l-4 14H10z" />
      <path d="M10 28c0 4 3 6 7 6s8-2 8-6c0 4 3 6 7 6s7-2 7-6c0 4 4 6 8 6s7-2 7-6" />
      <path d="M19 14l-2 14M32 14v14M45 14l2 14" />
      <path d="M12 34v22M52 34v22M8 56h48M12 44h40" />
    </>
  ),
  sack: (
    <>
      <path d="M22 16c-8 8-12 18-12 27 0 9 7 13 22 13s22-4 22-13c0-9-4-19-12-27z" />
      <path d="M22 16c3 3 17 3 20 0M22 16l-4-8M42 16l4-8M18 8c8 4 20 4 28 0" />
      <path d="M22 34c6 3 14 3 20 0M24 42c5 2 11 2 16 0" />
    </>
  ),
  trend: (
    <>
      <path d="M6 50c10-2 16-12 24-14s12 2 26-22" />
      <path d="M44 14h12v12" />
      <path d="M6 58h52" />
    </>
  ),
} satisfies Record<string, ReactNode>;

export type DoodleName = keyof typeof DOODLES;

interface DoodleProps {
  name: DoodleName;
  size?: number;
  className?: string;
}

/** One drawing on its own. */
export function Doodle({ name, size = 64, className }: DoodleProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
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

// A market stall with its produce around it and the trend line above, laid out on a 440 x 200 canvas.
const SCENE: ScenePiece[] = [
  { name: 'trend', x: 16, y: 6, scale: 1.25 },
  { name: 'stall', x: 150, y: 8, scale: 2.5 },
  { name: 'sack', x: 108, y: 104, scale: 1.4, rotate: -6 },
  { name: 'basket', x: 196, y: 96, scale: 1.2 },
  { name: 'onion', x: 318, y: 116, scale: 1.05, rotate: 10 },
  { name: 'tomato', x: 372, y: 104, scale: 1.0 },
  { name: 'potato', x: 30, y: 122, scale: 1.0, rotate: -12 },
  { name: 'leaf', x: 346, y: 20, scale: 1.1, rotate: 14 },
];

/** The whole market scene, used in the page header band. */
export function MarketScene({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 440 200"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {SCENE.map((piece) => (
        <g
          key={piece.name}
          transform={`translate(${piece.x} ${piece.y}) scale(${piece.scale}) rotate(${piece.rotate ?? 0} 32 32)`}
          // Keeps the line weight even when a piece is drawn larger.
          strokeWidth={2.5 / piece.scale}
        >
          {DOODLES[piece.name]}
        </g>
      ))}
    </svg>
  );
}
