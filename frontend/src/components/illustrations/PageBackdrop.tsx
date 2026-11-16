import type { CSSProperties } from 'react';
import { Doodle, type DoodleName } from './MarketDoodles';
import styles from './PageBackdrop.module.css';

interface Placed {
  name: DoodleName;
  /** Size against the base size of the column. */
  size: number;
  rotate: number;
  /** Sideways shift, from -1 to 1, used only when the margin is wider than the gutter. */
  shift: number;
}

// One ribbon of drawings for each side of the page, from top to bottom. Large and small pieces
// alternate, and each side mixes containers, produce and the signs of the trade.
const LEFT: Placed[] = [
  { name: 'leaf', size: 0.8, rotate: -18, shift: 0.5 },
  { name: 'stall', size: 1.15, rotate: -3, shift: -0.15 },
  { name: 'tomato', size: 0.8, rotate: 8, shift: 0.6 },
  { name: 'sack', size: 1.05, rotate: 6, shift: -0.4 },
  { name: 'carrot', size: 0.9, rotate: -10, shift: 0.45 },
  { name: 'scale', size: 1.1, rotate: 0, shift: -0.2 },
  { name: 'onion', size: 0.8, rotate: 12, shift: 0.55 },
  { name: 'cart', size: 1.1, rotate: -4, shift: -0.25 },
];

const RIGHT: Placed[] = [
  { name: 'trend', size: 0.95, rotate: 0, shift: -0.4 },
  { name: 'potato', size: 0.8, rotate: 14, shift: 0.5 },
  { name: 'basket', size: 1.15, rotate: -5, shift: -0.2 },
  { name: 'priceTag', size: 0.8, rotate: 10, shift: 0.55 },
  { name: 'crate', size: 1.1, rotate: 3, shift: -0.3 },
  { name: 'plantain', size: 0.9, rotate: -12, shift: 0.5 },
  { name: 'spark', size: 0.85, rotate: 0, shift: -0.45 },
  { name: 'leaf', size: 0.8, rotate: 28, shift: 0.4 },
];

/**
 * Faint market drawings in the free space on both sides of the content. On laptops they form a
 * narrow ribbon inside the page gutter; on wide screens they grow and spread over the margin.
 * They never sit behind text, tables or charts.
 */
export function PageBackdrop() {
  return (
    <div className={styles.backdrop} aria-hidden="true">
      {[LEFT, RIGHT].map((column, index) => (
        <div key={index} className={`${styles.column} ${index === 0 ? styles.left : styles.right}`}>
          {column.map((item, position) => (
            <span
              key={item.name}
              className={styles.item}
              style={
                {
                  top: `${((position + 0.5) / column.length) * 100}%`,
                  '--size': item.size,
                  '--shift': item.shift,
                  '--rotate': `${item.rotate}deg`,
                } as CSSProperties
              }
            >
              <Doodle name={item.name} className={styles.doodle} />
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}
