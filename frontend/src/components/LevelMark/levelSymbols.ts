import type { PriceLevel } from '../../lib/analysis';
import styles from './LevelMark.module.css';

/**
 * Icon of each level, as the path of a 24 x 24 drawing: an arrow down for the cheaper markets,
 * an equal sign for the similar ones and an arrow up for the more expensive.
 */
const LEVEL_ICON_PATHS: Record<PriceLevel, string> = {
  cheaper: 'M12 5v14M6 13l6 6 6-6',
  similar: 'M6 9h12M6 15h12',
  expensive: 'M12 19V5M6 11l6-6 6 6',
};

/** The mark as HTML, shared by the React component and the map markers built outside React. */
export function levelMarkHtml(level: PriceLevel): string {
  return (
    `<span class="${styles.mark} ${styles[level]}" aria-hidden="true">` +
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" ' +
    `stroke-linecap="round" stroke-linejoin="round"><path d="${LEVEL_ICON_PATHS[level]}"/></svg>` +
    '</span>'
  );
}

export { LEVEL_ICON_PATHS };
