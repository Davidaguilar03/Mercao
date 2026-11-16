import { formatPesos } from '../../lib/format';
import styles from './RangeBar.module.css';

interface RangeBarProps {
  /** Lower and upper end of the probable range, in pesos per kilogram. */
  lower: number;
  upper: number;
  /** Expected price, marked with a dot inside the range. */
  value: number;
}

/** Small picture of a forecast range: a bar from the lowest to the highest probable price. */
export function RangeBar({ lower, upper, value }: RangeBarProps) {
  const span = upper - lower || 1;
  const position = Math.min(100, Math.max(0, ((value - lower) / span) * 100));
  return (
    <span
      className={styles.range}
      role="img"
      aria-label={`Rango probable: de ${formatPesos(lower)} a ${formatPesos(upper)}`}
    >
      <span className={styles.track}>
        <span className={styles.dot} style={{ left: `${position}%` }} />
      </span>
      <span className={`${styles.ends} tabular`} aria-hidden="true">
        <span>{formatPesos(lower)}</span>
        <span>{formatPesos(upper)}</span>
      </span>
    </span>
  );
}
