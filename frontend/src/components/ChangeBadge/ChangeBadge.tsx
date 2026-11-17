import { Minus, TrendingDown, TrendingUp } from 'lucide-react';
import { formatChange, getTrend, type Trend } from '../../lib/format';
import styles from './ChangeBadge.module.css';

interface ChangeBadgeProps {
  /** Percentage change of a price; null when it cannot be computed. */
  value: number | null;
  /** "lg" shows the change as a headline figure. */
  size?: 'sm' | 'lg';
}

const ICONS = { up: TrendingUp, down: TrendingDown, flat: Minus };

// The direction is also given in words: color and arrow alone are not enough for everyone.
const DESCRIPTIONS: Record<Trend, string> = {
  up: 'Subió',
  down: 'Bajó',
  flat: 'Sin cambio',
};

export function ChangeBadge({ value, size = 'sm' }: ChangeBadgeProps) {
  if (value === null) {
    return <span className={`${styles.badge} ${styles[size]} ${styles.flat}`}>Sin dato</span>;
  }
  const trend = getTrend(value);
  const Icon = ICONS[trend];
  return (
    <span className={`${styles.badge} ${styles[size]} ${styles[trend]}`} data-trend={trend}>
      <Icon className={styles.icon} strokeWidth={2.5} aria-hidden="true" />
      <span className="visually-hidden">{DESCRIPTIONS[trend]}</span>
      {formatChange(value)}
    </span>
  );
}
