import { formatPesos } from '../../lib/format';
import styles from './PriceTag.module.css';

interface PriceTagProps {
  /** Price in Colombian pesos per kilogram; null when there is no price. */
  value: number | null;
  size?: 'md' | 'lg';
}

export function PriceTag({ value, size = 'md' }: PriceTagProps) {
  if (value === null) {
    return <span className={styles.missing}>Sin dato</span>;
  }
  return (
    <span className={`${styles.price} ${styles[size]}`}>
      {formatPesos(value)}
      <span className={styles.unit}>{'\u00a0/kg'}</span>
    </span>
  );
}
