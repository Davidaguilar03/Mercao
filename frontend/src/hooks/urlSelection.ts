// What the user selects lives in the URL (?producto=5&horizonte=3&plaza=2) so links can be shared.

import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useProducts } from '../api/hooks';
import type { Horizon } from '../api/types';

export const PRODUCT_PARAM = 'producto';
export const HORIZON_PARAM = 'horizonte';
export const MARKET_PARAM = 'plaza';

/** Product shown when the URL names none. */
export const DEFAULT_PRODUCT_NAME = 'Papa parda pastusa';
export const DEFAULT_HORIZON: Horizon = 2;

function readPositiveInt(raw: string | null): number | null {
  return raw !== null && /^[1-9]\d*$/.test(raw) ? Number(raw) : null;
}

/**
 * Address of the Producto view for a product in a market. Keeps the horizon of the current
 * address so the selection survives the change of page.
 */
export function marketDetailPath(
  productId: number,
  marketId: number,
  current: URLSearchParams,
): string {
  const params = new URLSearchParams({ [PRODUCT_PARAM]: String(productId) });
  const horizon = current.get(HORIZON_PARAM);
  if (horizon) params.set(HORIZON_PARAM, horizon);
  params.set(MARKET_PARAM, String(marketId));
  return `/producto?${params}`;
}

function useNumberParam(name: string): [number | null, (value: number) => void] {
  const [searchParams, setSearchParams] = useSearchParams();
  const value = readPositiveInt(searchParams.get(name));
  const setValue = useCallback(
    (next: number) => {
      setSearchParams(
        (current) => {
          const params = new URLSearchParams(current);
          params.set(name, String(next));
          return params;
        },
        // Changing a selector should not fill the browser history.
        { replace: true },
      );
    },
    [name, setSearchParams],
  );
  return [value, setValue];
}

/**
 * Selected product. Falls back to the default product when the URL has none or names one that
 * does not exist. `product` is null only while the catalog loads or if it fails.
 */
export function useProductSelection() {
  const productsQuery = useProducts();
  const [requestedId, setProductId] = useNumberParam(PRODUCT_PARAM);
  const products = productsQuery.data ?? [];
  const product =
    products.find((item) => item.product_id === requestedId) ??
    products.find((item) => item.canonical_name === DEFAULT_PRODUCT_NAME) ??
    products[0] ??
    null;
  return { product, productId: product?.product_id ?? null, setProductId, productsQuery };
}

/** Selected forecast horizon, 1 to 4 weeks. */
export function useHorizonSelection(): [Horizon, (horizon: Horizon) => void] {
  const [requested, setHorizon] = useNumberParam(HORIZON_PARAM);
  const horizon =
    requested !== null && requested >= 1 && requested <= 4
      ? (requested as Horizon)
      : DEFAULT_HORIZON;
  return [horizon, setHorizon];
}

/**
 * Selected market among the ones available for the product. Falls back to the first available
 * (lowest id) when the URL has none or names one where the product is not sold.
 */
export function useMarketSelection(
  availableIds: number[] | undefined,
): [number | null, (marketId: number) => void] {
  const [requestedId, setMarketId] = useNumberParam(MARKET_PARAM);
  if (!availableIds || availableIds.length === 0) return [null, setMarketId];
  const marketId =
    requestedId !== null && availableIds.includes(requestedId)
      ? requestedId
      : Math.min(...availableIds);
  return [marketId, setMarketId];
}
