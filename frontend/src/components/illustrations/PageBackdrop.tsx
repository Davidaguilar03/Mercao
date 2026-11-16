import { Doodle, type DoodleName } from './MarketDoodles';
import styles from './PageBackdrop.module.css';

interface Placed {
  name: DoodleName;
  top: string;
  offset: string;
  size: number;
  rotate: number;
}

// Positions inside each margin column, from the top of the page.
const LEFT: Placed[] = [
  { name: 'leaf', top: '6%', offset: '18%', size: 84, rotate: -18 },
  { name: 'sack', top: '24%', offset: '46%', size: 104, rotate: 8 },
  { name: 'tomato', top: '45%', offset: '12%', size: 76, rotate: -6 },
  { name: 'stall', top: '62%', offset: '38%', size: 124, rotate: 4 },
  { name: 'onion', top: '84%', offset: '16%', size: 80, rotate: 12 },
];

const RIGHT: Placed[] = [
  { name: 'trend', top: '9%', offset: '34%', size: 96, rotate: 0 },
  { name: 'potato', top: '28%', offset: '10%', size: 80, rotate: 14 },
  { name: 'basket', top: '46%', offset: '40%', size: 112, rotate: -6 },
  { name: 'leaf', top: '68%', offset: '14%', size: 78, rotate: 24 },
  { name: 'tomato', top: '86%', offset: '42%', size: 74, rotate: 6 },
];

/**
 * Faint market drawings in the empty margins beside the content. They only appear on screens
 * wide enough to have margins, so they never sit behind text, tables or charts.
 */
export function PageBackdrop() {
  return (
    <div className={styles.backdrop} aria-hidden="true">
      {[LEFT, RIGHT].map((column, index) => (
        <div key={index} className={`${styles.column} ${index === 0 ? styles.left : styles.right}`}>
          {column.map((item) => (
            <span
              key={`${item.name}-${item.top}`}
              className={styles.item}
              style={{
                top: item.top,
                [index === 0 ? 'left' : 'right']: item.offset,
                transform: `rotate(${item.rotate}deg)`,
              }}
            >
              <Doodle name={item.name} size={item.size} />
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}
