import type { RecommendationSide } from '../../api/types';
import { formatPesos } from '../../lib/format';
import styles from './IntervalComparison.module.css';

interface IntervalComparisonProps {
  buy: RecommendationSide;
  sell: RecommendationSide;
}

/**
 * The two forecast ranges on the same scale. If the bars do not share any stretch, the
 * difference is reliable; if they overlap, it may not happen.
 */
export function IntervalComparison({ buy, sell }: IntervalComparisonProps) {
  const low = Math.min(buy.lower_price, sell.lower_price);
  const high = Math.max(buy.upper_price, sell.upper_price);
  const span = high - low || 1;
  const position = (price: number) => `${((price - low) / span) * 100}%`;
  const width = (side: RecommendationSide) =>
    `${((side.upper_price - side.lower_price) / span) * 100}%`;

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
        `${formatPesos(sell.lower_price)} a ${formatPesos(sell.upper_price)}.`
      }
    >
      {rows.map(({ side, label, tone }) => (
        <div key={label} className={styles.row}>
          <div className={styles.rowLabel}>
            <span>{label}</span>
            <span className="tabular">
              {formatPesos(side.lower_price)} a {formatPesos(side.upper_price)}
            </span>
          </div>
          <div className={styles.track}>
            <span
              className={`${styles.range} ${tone}`}
              style={{ left: position(side.lower_price), width: width(side) }}
            />
            <span
              className={`${styles.dot} ${tone}`}
              style={{ left: position(side.predicted_price) }}
            />
          </div>
        </div>
      ))}
      <div className={`${styles.scale} tabular`} aria-hidden="true">
        <span>{formatPesos(low)}</span>
        <span>{formatPesos(high)}</span>
      </div>
    </div>
  );
}
