import type { PriceLevel } from '../../lib/analysis';
import { LEVEL_SYMBOLS, levelMarkClassName } from './levelSymbols';

/** Small decorative mark of a price level. The level is always written next to it. */
export function LevelMark({ level }: { level: PriceLevel }) {
  return (
    <span className={levelMarkClassName(level)} aria-hidden="true">
      {LEVEL_SYMBOLS[level]}
    </span>
  );
}
