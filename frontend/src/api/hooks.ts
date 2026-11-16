// TanStack Query hooks, one per endpoint. Hooks that need a product or a market stay idle
// (enabled: false) until the id is known, so pages can call them before the user picks one.

import { useQuery } from '@tanstack/react-query';
import { getMarkets, getProducts } from './catalog';
import { getForecasts } from './forecasting';
import { getModelSummary } from './model';
import {
  getHealth,
  getLatestPrices,
  getPriceHistory,
  getSeasonality,
  type PriceHistoryRange,
} from './prices';
import { getRecommendations } from './recommendations';
import { getSupplyOrigins } from './supply';
import type { Horizon } from './types';

type Id = number | null | undefined;

// The catalog and the model summary only change when the pipeline runs again.
const STATIC_STALE_TIME = 60 * 60 * 1000;

export function useHealth() {
  return useQuery({ queryKey: ['health'], queryFn: getHealth });
}

export function useProducts() {
  return useQuery({ queryKey: ['products'], queryFn: getProducts, staleTime: STATIC_STALE_TIME });
}

export function useMarkets() {
  return useQuery({ queryKey: ['markets'], queryFn: getMarkets, staleTime: STATIC_STALE_TIME });
}

export function useLatestPrices(productId: Id) {
  return useQuery({
    queryKey: ['prices', 'latest', productId],
    queryFn: () => getLatestPrices(productId!),
    enabled: productId != null,
  });
}

export function usePriceHistory(productId: Id, marketId: Id, range: PriceHistoryRange = {}) {
  return useQuery({
    queryKey: ['prices', 'history', productId, marketId, range.from ?? null, range.to ?? null],
    queryFn: () => getPriceHistory(productId!, marketId!, range),
    enabled: productId != null && marketId != null,
  });
}

export function useSeasonality(productId: Id, marketId: Id) {
  return useQuery({
    queryKey: ['prices', 'seasonality', productId, marketId],
    queryFn: () => getSeasonality(productId!, marketId!),
    enabled: productId != null && marketId != null,
  });
}

export function useSupplyOrigins(productId: Id, marketId?: Id) {
  return useQuery({
    queryKey: ['supply', 'origins', productId, marketId ?? null],
    queryFn: () => getSupplyOrigins(productId!, marketId ?? undefined),
    enabled: productId != null,
  });
}

export function useForecasts(productId: Id, marketId?: Id) {
  return useQuery({
    queryKey: ['forecasts', productId, marketId ?? null],
    queryFn: () => getForecasts(productId!, marketId ?? undefined),
    enabled: productId != null,
  });
}

export function useRecommendations(productId: Id, horizon: Horizon) {
  return useQuery({
    queryKey: ['recommendations', productId, horizon],
    queryFn: () => getRecommendations(productId!, horizon),
    enabled: productId != null,
  });
}

export function useModelSummary() {
  return useQuery({
    queryKey: ['model', 'summary'],
    queryFn: getModelSummary,
    staleTime: STATIC_STALE_TIME,
  });
}
