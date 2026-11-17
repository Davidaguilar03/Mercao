import type { CSSProperties } from 'react';
import type { RecommendationSide } from '../../api/types';
import { formatPesos } from '../../lib/format';
import styles from './IntervalComparison.module.css';

interface IntervalComparisonProps {
  buy: RecommendationSide;
  sell: RecommendationSide;
}

/** A round step that gives about three or four intervals between low and high. */
function tickStep(span: number): number {
  const raw = span / 4;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].find((factor) => factor * magnitude >= raw) ?? 10;
  return step * magnitude;
}

/** Labels near the edges grow inwards so they never leave the chart. */
function anchor(percent: number): CSSProperties {
  if (percent < 12) return { left: `${percent}%`, transform: 'translateX(0)' };
  if (percent > 88) return { left: `${percent}%`, transform: 'translateX(-100%)' };
  return { left: `${percent}%` };
}

/**
 * The two forecast ranges on one shared price axis. If the bars do not share any stretch, the
 * difference is reliable; if they overlap, the shared stretch is marked because it may not happen.
 */
export function IntervalComparison({ buy, sell }: IntervalComparisonProps) {
  const lowest = Math.min(buy.lower_price, sell.lower_price);
  const highest = Math.max(buy.upper_price, sell.upper_price);
  // The axis covers both ranges with a small margin; the ticks are the round prices inside it.
  const span = highest - lowest || 1;
  const low = lowest - span * 0.06;
  const high = highest + span * 0.06;
  const step = tickStep(span);
  const ticks: number[] = [];
  for (let tick = Math.ceil(low / step) * step; tick <= high; tick += step) ticks.push(tick);
  const percent = (price: number) => ((price - low) / (high - low)) * 100;

  const overlapLow = Math.max(buy.lower_price, sell.lower_price);
  const overlapHigh = Math.min(buy.upper_price, sell.upper_price);
  const overlaps = overlapHigh > overlapLow;

  const rows = [
    { side: buy, label: `Comprar en ${buy.city}`, tone: styles.buy },
    { side: sell, label: `Vender en ${sell.city}`, tone: styles.sell },
  ];

  return (
    <div
      className={styles.comparison}
      role="img"
      aria-label={
        `Rango probable en ${buy.city}: de ${formatPesos(buy.lower_price)} a ` +
        `${formatPesos(buy.upper_price)}. Rango probable en ${sell.city}: de ` +
        `${formatPesos(sell.lower_price)} a ${formatPesos(sell.upper_price)}.` +
        (overlaps
          ? ` Los rangos se cruzan entre ${formatPesos(overlapLow)} y ${formatPesos(overlapHigh)}.`
          : ' Los rangos no se cruzan.')
      }
    >
      <ul className={styles.legend} aria-hidden="true">
        {rows.map(({ side, label, tone }) => (
          <li key={label}>
            <span className={`${styles.swatch} ${tone}`} />
            <span className={styles.legendLabel}>{label}</span>
            <span className={`${styles.legendRange} tabular`}>
              {formatPesos(side.lower_price)} a {formatPesos(side.upper_price)}
            </span>
          </li>
        ))}
      </ul>

      <div className={styles.plot} aria-hidden="true">
        <div className={styles.lanes}>
          {ticks.map((tick) => (
            <span key={tick} className={styles.gridline} style={{ left: `${percent(tick)}%` }} />
          ))}
          {overlaps && (
            <span
              className={styles.overlap}
              style={{
                left: `${percent(overlapLow)}%`,
                width: `${percent(overlapHigh) - percent(overlapLow)}%`,
              }}
            />
          )}
          {rows.map(({ side, label, tone }) => (
            <div key={label} className={styles.lane}>
              <span
                className={`${styles.value} tabular`}
                style={anchor(percent(side.predicted_price))}
              >
                {formatPesos(side.predicted_price)}
              </span>
              <div className={styles.track}>
                <span
                  className={`${styles.range} ${tone}`}
                  style={{
                    left: `${percent(side.lower_price)}%`,
                    width: `${percent(side.upper_price) - percent(side.lower_price)}%`,
                  }}
                />
                <span
                  className={`${styles.marker} ${tone}`}
                  style={{ left: `${percent(side.predicted_price)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
        <div className={`${styles.axis} tabular`}>
          {ticks.map((tick) => (
            <span key={tick} className={styles.tick} style={anchor(percent(tick))}>
              {formatPesos(tick)}
            </span>
          ))}
        </div>
      </div>

      {overlaps && (
        <p className={styles.overlapNote} aria-hidden="true">
          <span className={styles.overlapSwatch} />
          Zona donde los rangos se cruzan
        </p>
      )}
    </div>
  );
}
