import { usePriceHistory } from '../../api/hooks';
import { FULL_HISTORY_START } from '../../api/prices';
import type { RecommendationSide } from '../../api/types';
import { getTrend } from '../../lib/format';
import styles from './MarketSparkline.module.css';

interface MarketSparklineProps {
  productId: number;
  side: RecommendationSide;
  tone: 'buy' | 'sell';
}

const WEEKS = 12;
const DAY_MS = 24 * 60 * 60 * 1000;
const WIDTH = 120;
const HEIGHT = 40;
/** Room above and below the line so the stroke and the dot are never cut. */
const PAD = 4;

const SUMMARY = `Precio de las últimas ${WEEKS} semanas y pronóstico`;

function weeksBetween(from: string, to: string): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / (7 * DAY_MS));
}

/**
 * The weekly mean price of the market in its last 12 observed weeks, and a dashed step to the
 * forecast for the selected horizon. It reuses the full history query of the Producto view, so
 * both views share the cached response. Nothing is drawn while it loads or without data.
 */
export function MarketSparkline({ productId, side, tone }: MarketSparklineProps) {
  const { data } = usePriceHistory(productId, side.market_id, { from: FULL_HISTORY_START });
  const series = data?.series ?? [];
  const last = series.at(-1);
  if (!last) return null;

  const observed = series.filter(
    (point) => weeksBetween(point.week_start, last.week_start) < WEEKS,
  );
  if (observed.length < 2) return null;

  const first = observed[0].week_start;
  const span = Math.max(weeksBetween(first, side.target_week_start), 1);
  const prices = [...observed.map((point) => point.mean_price), side.predicted_price];
  const low = Math.min(...prices);
  const high = Math.max(...prices);
  const x = (week: string) => (weeksBetween(first, week) / span) * WIDTH;
  const y = (price: number) =>
    high === low ? HEIGHT / 2 : PAD + (1 - (price - low) / (high - low)) * (HEIGHT - 2 * PAD);

  const points = observed.map((point) => `${x(point.week_start)},${y(point.mean_price)}`);
  const line = `M${points.join('L')}`;
  const area = `${line}L${x(last.week_start)},${HEIGHT}L0,${HEIGHT}Z`;
  const forecastX = x(side.target_week_start);
  const forecastY = y(side.predicted_price);
  const change =
    side.expected_change_percent ??
    ((side.predicted_price - last.mean_price) / last.mean_price) * 100;
  const trend = getTrend(change);

  return (
    <div
      className={`${styles.sparkline} ${styles[tone]}`}
      role="img"
      aria-label={SUMMARY}
      title={SUMMARY}
    >
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" aria-hidden="true">
        <path className={styles.area} d={area} />
        <path
          className={styles.forecastLine}
          d={`M${x(last.week_start)},${y(last.mean_price)}L${forecastX},${forecastY}`}
        />
        {tone === 'buy' && <path className={styles.outline} d={line} />}
        <path className={styles.line} d={line} />
      </svg>
      {/* An HTML dot keeps its round shape while the drawing stretches to the space. */}
      <span
        className={`${styles.dot} ${styles[trend]}`}
        data-trend={trend}
        style={{ left: `${(forecastX / WIDTH) * 100}%`, top: `${(forecastY / HEIGHT) * 100}%` }}
      />
    </div>
  );
}
