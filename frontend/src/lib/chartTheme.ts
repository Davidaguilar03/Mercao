// Colors for charts and the map. SVG attributes cannot read CSS variables reliably in every
// library, so these mirror the tokens in styles/tokens.css.

import type { PriceLevel } from './analysis';

export const CHART_COLORS = {
  primary: '#1f6b4a',
  terracotta: '#c8553d',
  accent: '#f2b705',
  neutral: '#8a8f80',
  ink: '#1e2b24',
  muted: '#55635b',
  grid: '#e3dccb',
} as const;

/**
 * Price level (cheaper or more expensive than the rest). It is not a price change, so it uses
 * corn yellow and ink instead of the green and terracotta of rises and falls.
 */
export const LEVEL_COLORS: Record<PriceLevel, string> = {
  cheaper: CHART_COLORS.accent,
  similar: CHART_COLORS.neutral,
  expensive: CHART_COLORS.ink,
};

export const LEVEL_LABELS: Record<PriceLevel, string> = {
  cheaper: 'Más barata que la mayoría',
  similar: 'Precio parecido al de la mayoría',
  expensive: 'Más cara que la mayoría',
};

/** Short form for tight places, next to the level mark. */
export const LEVEL_SHORT_LABELS: Record<PriceLevel, string> = {
  cheaper: 'Más barata',
  similar: 'Precio parecido',
  expensive: 'Más cara',
};

export const TOOLTIP_STYLE = {
  borderRadius: 10,
  border: `1px solid ${CHART_COLORS.grid}`,
  background: '#ffffff',
  color: CHART_COLORS.ink,
  padding: '8px 12px',
  fontSize: 14,
} as const;
