import { apiGet } from './client';
import type { Health, LatestPrices, PriceHistory, Seasonality } from './types';

// The health endpoint lives with prices in the backend because it reports the latest price week.
export function getHealth(): Promise<Health> {
  return apiGet<Health>('/api/health');
}

export function getLatestPrices(productId: number): Promise<LatestPrices> {
  return apiGet<LatestPrices>('/api/prices/latest', { product_id: productId });
}

export interface PriceHistoryRange {
  from?: string;
  to?: string;
}

export function getPriceHistory(
  productId: number,
  marketId: number,
  range: PriceHistoryRange = {},
): Promise<PriceHistory> {
  return apiGet<PriceHistory>('/api/prices/history', {
    product_id: productId,
    market_id: marketId,
    from: range.from,
    to: range.to,
  });
}

export function getSeasonality(productId: number, marketId: number): Promise<Seasonality> {
  return apiGet<Seasonality>('/api/prices/seasonality', {
    product_id: productId,
    market_id: marketId,
  });
}
