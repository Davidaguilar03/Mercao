import { apiGet } from './client';
import type { Market, Product } from './types';

export function getProducts(): Promise<Product[]> {
  return apiGet<Product[]>('/api/products');
}

export function getMarkets(): Promise<Market[]> {
  return apiGet<Market[]>('/api/markets');
}
