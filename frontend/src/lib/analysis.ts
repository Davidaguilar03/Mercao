// Small calculations on top of the API data: relative price levels, forecast direction and the
// plain-language sentences shown to the user.

import type { MarketForecast, MarketLatestPrice, Product } from '../api/types';
import { formatPricePerKg, lowerFirst } from './format';

export type PriceLevel = 'cheaper' | 'similar' | 'expensive';

/** A market within this percentage of the group median counts as "similar". */
export const SIMILAR_THRESHOLD_PCT = 5;

export function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/** Percentage change with one decimal, like the API. */
export function percentChange(from: number, to: number): number {
  return Math.round(((to - from) / from) * 1000) / 10;
}

/** Where a price stands against the median of its comparable group. */
export function classifyPriceLevel(price: number, groupMedian: number): PriceLevel {
  const difference = ((price - groupMedian) / groupMedian) * 100;
  if (difference <= -SIMILAR_THRESHOLD_PCT) return 'cheaper';
  if (difference >= SIMILAR_THRESHOLD_PCT) return 'expensive';
  return 'similar';
}

export interface MarketRow {
  marketId: number;
  marketName: string;
  city: string;
  comparableGroup: string;
  weekStart: string;
  price: number;
  change4w: number | null;
  change52w: number | null;
  level: PriceLevel;
  /** Forecast for the requested horizon; null when the market has none. */
  forecastPrice: number | null;
  /** Forecast against the latest price, in percent. */
  forecastChangePct: number | null;
}

export interface MarketGroup {
  comparableGroup: string;
  rows: MarketRow[];
}

/**
 * Joins the latest prices with the forecasts and groups the markets by comparable group.
 * The largest group goes first; inside a group the cheapest market goes first.
 */
export function buildMarketGroups(
  latest: MarketLatestPrice[],
  forecasts: MarketForecast[],
  horizon: number,
): MarketGroup[] {
  const forecastByMarket = new Map(forecasts.map((market) => [market.market_id, market]));
  const byGroup = new Map<string, MarketLatestPrice[]>();
  for (const market of latest) {
    const members = byGroup.get(market.comparable_group) ?? [];
    members.push(market);
    byGroup.set(market.comparable_group, members);
  }

  const groups = [...byGroup.entries()].map(([comparableGroup, members]) => {
    const groupMedian = median(members.map((market) => market.mean_price));
    const rows = members
      .map((market): MarketRow => {
        const forecast = forecastByMarket
          .get(market.market_id)
          ?.forecasts.find((item) => item.horizon === horizon);
        return {
          marketId: market.market_id,
          marketName: market.market_name,
          city: market.city,
          comparableGroup,
          weekStart: market.week_start,
          price: market.mean_price,
          change4w: market.change_4w_pct,
          change52w: market.change_52w_pct,
          // A market alone in its group has nothing to be compared with.
          level:
            members.length > 1 ? classifyPriceLevel(market.mean_price, groupMedian) : 'similar',
          forecastPrice: forecast?.predicted_price ?? null,
          forecastChangePct: forecast
            ? percentChange(market.mean_price, forecast.predicted_price)
            : null,
        };
      })
      .sort((a, b) => a.price - b.price);
    return { comparableGroup, rows };
  });

  return groups.sort((a, b) => b.rows.length - a.rows.length);
}

/**
 * One sentence about the product this week, from its largest comparable group.
 * Written without grammatical gender so it works for every product name.
 */
export function buildSummary(productName: string, groups: MarketGroup[]): string | null {
  const rows = groups[0]?.rows ?? [];
  if (rows.length === 0) return null;
  const name = lowerFirst(productName);
  const cheapest = rows[0];
  if (rows.length === 1) {
    return `Esta semana solo hay precio de ${name} en ${cheapest.city}: ${formatPricePerKg(cheapest.price)}.`;
  }
  const mostExpensive = rows[rows.length - 1];
  let sentence =
    `Esta semana el precio más bajo de ${name} está en ${cheapest.city} ` +
    `(${formatPricePerKg(cheapest.price)}) y el más alto en ${mostExpensive.city} ` +
    `(${formatPricePerKg(mostExpensive.price)}).`;

  const changes = rows.flatMap((row) => (row.change4w === null ? [] : [row.change4w]));
  const rises = changes.filter((change) => change > 0).length;
  const falls = changes.filter((change) => change < 0).length;
  if (changes.length > 1 && rises !== falls) {
    const [verb, count] = rises > falls ? ['subió', rises] : ['bajó', falls];
    sentence += ` Frente a hace cuatro semanas ${verb} en ${count} de ${changes.length} plazas.`;
  }
  return sentence;
}

/** Why the confidence of a buy and sell recommendation is high or low, in plain words. */
export function explainConfidence(
  confidence: 'alta' | 'baja',
  buyCity: string,
  sellCity: string,
): string {
  if (confidence === 'alta') {
    return (
      `Los rangos de precio de las dos plazas no se cruzan: aun si el precio en ${buyCity} resulta ` +
      `más alto de lo esperado y el de ${sellCity} más bajo, la diferencia se mantiene.`
    );
  }
  return (
    `Los rangos de precio de las dos plazas se cruzan: el precio en ${buyCity} podría terminar ` +
    `tan alto como el de ${sellCity}, así que la diferencia puede ser menor o no darse.`
  );
}

/**
 * Variety of a comparable group. Markets in the product's own group sell the product's variety;
 * any other group is read from its key ("papa-criolla|kg" -> "papa criolla").
 */
export function varietyLabel(comparableGroup: string, product: Product | null): string {
  if (product && comparableGroup === product.comparable_group) {
    return product.variety || 'Única';
  }
  return comparableGroup.split('|')[0].replace(/-/g, ' ');
}
