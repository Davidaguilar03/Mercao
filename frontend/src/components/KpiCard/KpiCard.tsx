import { Minus, TrendingDown, TrendingUp } from 'lucide-react';
import type { ReactNode } from 'react';
import { formatChange, getTrend, type Trend } from '../../lib/format';
import styles from './KpiCard.module.css';

interface KpiGridProps {
  children: ReactNode;
  /** Names the group of figures for screen readers. */
  label: string;
}

/** Row of key figures: equal-height cards, two columns on phones and four on desktop. */
export function KpiGrid({ children, label }: KpiGridProps) {
  return (
    <div className={styles.grid} role="group" aria-label={label}>
      {children}
    </div>
  );
}

interface KpiCardProps {
  label: string;
  /** The figure, shown large. Every card of a row uses the same size. */
  value: ReactNode;
  /** Colors the figure: a rising price in terracotta, a falling one in green. */
  tone?: Trend | 'neutral';
  /** Secondary line under the figure: a short explanation, a reference or a small visual. */
  children?: ReactNode;
}

export function KpiCard({ label, value, tone = 'neutral', children }: KpiCardProps) {
  return (
    <div className={styles.card}>
      <p className={styles.label}>{label}</p>
      <p className={`${styles.value} ${styles[tone]}`}>{value}</p>
      {children && <div className={styles.secondary}>{children}</div>}
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
