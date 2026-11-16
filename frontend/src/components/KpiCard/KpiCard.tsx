import { Minus, TrendingDown, TrendingUp } from 'lucide-react';
import type { ReactNode } from 'react';
import { formatChange, getTrend, type Trend } from '../../lib/format';
import styles from './KpiCard.module.css';

interface KpiGridProps {
  children: ReactNode;
  /** Names the group of figures for screen readers. */
  label: string;
  /**
   * "inline" puts the explanation beside the figure when the card is wide enough, for short
   * explanations; "stacked" keeps it under the figure, for longer texts.
   */
  layout?: 'inline' | 'stacked';
}

/**
 * Group of key figures. The number of columns follows the width of the place where the group
 * is shown (one, two or four), not the width of the screen.
 */
export function KpiGrid({ children, label, layout = 'stacked' }: KpiGridProps) {
  return (
    <div className={styles.container}>
      <div className={`${styles.grid} ${styles[layout]}`} role="group" aria-label={label}>
        {children}
      </div>
    </div>
  );
}

interface KpiCardProps {
  label: string;
  /** The figure, shown large. Every card of a row uses the same size. */
  value: ReactNode;
  /** Colors the figure: a rise in green, a fall in terracotta. */
  tone?: Trend | 'neutral';
  /** Extra detail shown when the pointer rests on the card. */
  title?: string;
  /** Secondary text under or beside the figure: a short explanation, a reference or a small visual. */
  children?: ReactNode;
}

export function KpiCard({ label, value, tone = 'neutral', title, children }: KpiCardProps) {
  return (
    <div className={styles.card} title={title}>
      <p className={styles.label}>{label}</p>
      <div className={styles.body}>
        <p className={`${styles.value} ${styles[tone]}`}>{value}</p>
        {children && <div className={styles.secondary}>{children}</div>}
      </div>
    </div>
  );
}

const TREND_ICONS = { up: TrendingUp, down: TrendingDown, flat: Minus };
const TREND_WORDS: Record<Trend, string> = { up: 'Subió', down: 'Bajó', flat: 'Sin cambio' };

interface KpiChangeCardProps {
  label: string;
  /** Percentage change; null when it cannot be computed. */
  value: number | null;
  /** Explanation for each direction, for example "Más caro que hace 4 semanas". */
  explanations: Record<Trend, string>;
  /** Shown when there is no value. */
  missing: string;
  /** Extra line under the explanation, for example the reference price. */
  children?: ReactNode;
}

/** A percentage change as large as a price, with its arrow, color and a plain explanation. */
export function KpiChangeCard({
  label,
  value,
  explanations,
  missing,
  children,
}: KpiChangeCardProps) {
  if (value === null) {
    return (
      <KpiCard label={label} value="Sin dato">
        {missing}
      </KpiCard>
    );
  }
  const trend = getTrend(value);
  const Icon = TREND_ICONS[trend];
  return (
    <KpiCard
      label={label}
      tone={trend}
      value={
        <>
          <Icon className={styles.icon} strokeWidth={2.5} aria-hidden="true" />
          <span className="visually-hidden">{TREND_WORDS[trend]}</span>
          {formatChange(value)}
        </>
      }
    >
      {explanations[trend]}
      {children && <span className={styles.reference}>{children}</span>}
    </KpiCard>
  );
}
