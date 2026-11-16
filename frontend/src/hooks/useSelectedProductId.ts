import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

export const PRODUCT_PARAM = 'producto';

/**
 * The selected product lives in the URL (?producto=5) so a link can be shared.
 * Returns null when the parameter is missing or is not a positive integer.
 */
export function useSelectedProductId(): [number | null, (productId: number) => void] {
  const [searchParams, setSearchParams] = useSearchParams();
  const raw = searchParams.get(PRODUCT_PARAM);
  const productId = raw !== null && /^[1-9]\d*$/.test(raw) ? Number(raw) : null;

  const setProductId = useCallback(
    (nextId: number) => {
      setSearchParams((current) => {
        const next = new URLSearchParams(current);
        next.set(PRODUCT_PARAM, String(nextId));
        return next;
      });
    },
    [setSearchParams],
  );

  return [productId, setProductId];
}
