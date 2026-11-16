import { apiGet } from './client';
import type { Horizon, Recommendations } from './types';

export function getRecommendations(productId: number, horizon: Horizon): Promise<Recommendations> {
  return apiGet<Recommendations>('/api/recommendations', { product_id: productId, horizon });
}
