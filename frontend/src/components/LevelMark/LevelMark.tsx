import type { PriceLevel } from '../../lib/analysis';
import styles from './LevelMark.module.css';
import { LEVEL_ICON_PATHS } from './levelSymbols';

/**
 * Small decorative mark of a price level against the other markets: arrow down, equal sign or
 * arrow up. The level is always written next to it.
 */
export function LevelMark({ level }: { level: PriceLevel }) {
  return (
    <span className={`${styles.mark} ${styles[level]}`} data-level={level} aria-hidden="true">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d={LEVEL_ICON_PATHS[level]} />
      </svg>
    </span>
  );
}
