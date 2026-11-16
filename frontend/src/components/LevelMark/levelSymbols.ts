import type { PriceLevel } from '../../lib/analysis';
import styles from './LevelMark.module.css';

/** One peso sign for the cheaper markets, two for the similar ones and three for the expensive. */
export const LEVEL_SYMBOLS: Record<PriceLevel, string> = {
  cheaper: '$',
  similar: '$$',
  expensive: '$$$',
};

/** Class names of the mark, also for the map markers that are built outside React. */
export function levelMarkClassName(level: PriceLevel): string {
  return `${styles.mark} ${styles[level]}`;
}
