import { apiGet } from './client';
import type { SupplyOrigins } from './types';

// Without a market, the API adds up all the focus markets.
export function getSupplyOrigins(productId: number, marketId?: number): Promise<SupplyOrigins> {
  return apiGet<SupplyOrigins>('/api/supply/origins', {
    product_id: productId,
    market_id: marketId,
  });
}
