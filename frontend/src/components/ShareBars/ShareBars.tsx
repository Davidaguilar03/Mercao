import { formatPercent, formatTons } from '../../lib/format';
import styles from './ShareBars.module.css';

export interface ShareItem {
  key: string;
  label: string;
  /** Secondary text next to the label, for example the department of a municipality. */
  detail?: string;
  kg: number;
  sharePct: number;
  /** Draws the bar in the neutral color (for "other" or imported rows). */
  muted?: boolean;
}

interface ShareBarsProps {
  items: ShareItem[];
  /** Describes the list for screen readers. */
  label: string;
}

/** Horizontal bar chart of shares. Each bar carries its name, tonnes and percentage as text. */
export function ShareBars({ items, label }: ShareBarsProps) {
  const maxShare = Math.max(...items.map((item) => item.sharePct), 1);
  return (
    <ol className={styles.list} aria-label={label}>
      {items.map((item) => (
        <li key={item.key} className={styles.item}>
          <span className={styles.name}>
            {item.label}
            {item.detail && <span className={styles.detail}> ({item.detail})</span>}
          </span>
          <span className={`${styles.value} tabular`}>
            <span className={styles.tons}>{formatTons(item.kg)}</span>
            {formatPercent(item.sharePct)}
          </span>
          <span className={styles.track} aria-hidden="true">
            <span
              className={`${styles.bar} ${item.muted ? styles.muted : ''}`}
              style={{ width: `${(item.sharePct / maxShare) * 100}%` }}
            />
          </span>
        </li>
      ))}
    </ol>
  );
}
