import type { MarketForecast, PricePoint } from '../../api/types';
import { formatPricePerKg, formatWeek, toTimestamp } from '../../lib/format';

export type HistoryRange = '1y' | '3y' | 'all';

export const RANGE_LABELS: Record<HistoryRange, string> = {
  '1y': '1 año',
  '3y': '3 años',
  all: 'Todo',
};

const RANGE_WEEKS: Record<HistoryRange, number | null> = { '1y': 52, '3y': 156, all: null };
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export interface ChartPoint {
  /** Monday of the week, in milliseconds. */
  t: number;
  weekStart: string;
  mean?: number;
  /** Lowest and highest price of the week. */
  band?: [number, number];
  forecast?: number;
  /** 80 % interval of the forecast. */
  forecastBand?: [number, number];
  /** True for weeks that have not happened yet. */
  isForecast: boolean;
}

/** Keeps the weeks of the chosen range, counted back from the last week with a price. */
export function filterByRange(series: PricePoint[], range: HistoryRange): PricePoint[] {
  const weeks = RANGE_WEEKS[range];
  if (weeks === null || series.length === 0) return series;
  const cutoff = toTimestamp(series[series.length - 1].week_start) - weeks * WEEK_MS;
  return series.filter((point) => toTimestamp(point.week_start) >= cutoff);
}

/**
 * Points for the chart: the observed weeks followed by the forecast weeks. The forecast starts
 * at the last observed price so its line continues the observed one.
 */
export function buildChartPoints(
  series: PricePoint[],
  forecast: MarketForecast | undefined,
): ChartPoint[] {
  const points: ChartPoint[] = series.map((point) => ({
    t: toTimestamp(point.week_start),
    weekStart: point.week_start,
    mean: point.mean_price,
    band:
      point.min_price !== null && point.max_price !== null
        ? [point.min_price, point.max_price]
        : undefined,
    isForecast: false,
  }));
  const last = points[points.length - 1];
  if (!forecast || !last || last.mean === undefined) return points;

  if (forecast.origin_week_start === last.weekStart) {
    last.forecast = last.mean;
    last.forecastBand = [last.mean, last.mean];
  }
  for (const item of forecast.forecasts) {
    if (item.target_week_start <= last.weekStart) continue;
    points.push({
      t: toTimestamp(item.target_week_start),
      weekStart: item.target_week_start,
      forecast: item.predicted_price,
      forecastBand: [item.lower_price, item.upper_price],
      isForecast: true,
    });
  }
  return points;
}

/** Ticks on the first day of a month or year, spaced according to the range. */
export function buildTimeTicks(min: number, max: number, range: HistoryRange): number[] {
  const monthsStep = range === '1y' ? 2 : range === '3y' ? 6 : 24;
  const start = new Date(min);
  let year = start.getUTCFullYear();
  let month = range === 'all' ? 0 : Math.ceil(start.getUTCMonth() / monthsStep) * monthsStep;
  const ticks: number[] = [];
  for (;;) {
    const tick = Date.UTC(year, month, 1);
    if (tick > max) break;
    if (tick >= min) ticks.push(tick);
    month += monthsStep;
    year += Math.floor(month / 12);
    month %= 12;
  }
  return ticks;
}

/** Text version of the chart for people who cannot see it. */
export function describeSeries(
  series: PricePoint[],
  forecast: MarketForecast | undefined,
): string | null {
  if (series.length === 0) return null;
  const first = series[0];
  const last = series[series.length - 1];
  const lowest = series.reduce((a, b) => (b.mean_price < a.mean_price ? b : a));
  const highest = series.reduce((a, b) => (b.mean_price > a.mean_price ? b : a));
  let text =
    `En este periodo el precio pasó de ${formatPricePerKg(first.mean_price)} ` +
    `(semana del ${formatWeek(first.week_start)}) a ${formatPricePerKg(last.mean_price)} ` +
    `(semana del ${formatWeek(last.week_start)}). El más bajo fue ` +
    `${formatPricePerKg(lowest.mean_price)} en la semana del ${formatWeek(lowest.week_start)} ` +
    `y el más alto ${formatPricePerKg(highest.mean_price)} en la semana del ` +
    `${formatWeek(highest.week_start)}.`;
  const furthest = forecast?.forecasts[forecast.forecasts.length - 1];
  if (furthest) {
    text +=
      ` Para la semana del ${formatWeek(furthest.target_week_start)} se espera ` +
      `${formatPricePerKg(furthest.predicted_price)}, con un rango probable entre ` +
      `${formatPricePerKg(furthest.lower_price)} y ${formatPricePerKg(furthest.upper_price)}.`;
  }
  return text;
}
