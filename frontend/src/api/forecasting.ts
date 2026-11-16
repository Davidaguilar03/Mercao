import { apiGet } from './client';
import type { Forecasts } from './types';

// Without a market, the API returns every usable market of the product.
export function getForecasts(productId: number, marketId?: number): Promise<Forecasts> {
  return apiGet<Forecasts>('/api/forecasts', { product_id: productId, market_id: marketId });
}
