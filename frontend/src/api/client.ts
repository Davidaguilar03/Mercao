// Small fetch client for the Mercao API (read-only, GET requests only).

const DEFAULT_API_URL = 'http://localhost:8000';

// An empty VITE_API_URL means relative URLs, served through the Vite dev proxy or a reverse proxy.
export const API_BASE_URL = (import.meta.env.VITE_API_URL ?? DEFAULT_API_URL).replace(/\/+$/, '');

export type QueryParams = Record<string, string | number | undefined>;

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export const NETWORK_ERROR_MESSAGE =
  'No pudimos conectarnos con el servidor de Mercao. Revise su conexión e intente de nuevo.';

export function buildUrl(path: string, params: QueryParams = {}): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) search.set(key, String(value));
  }
  const query = search.toString();
  return `${API_BASE_URL}${path}${query ? `?${query}` : ''}`;
}

export async function apiGet<T>(path: string, params?: QueryParams): Promise<T> {
  let response: Response;
  try {
    response = await fetch(buildUrl(path, params), { headers: { Accept: 'application/json' } });
  } catch {
    throw new ApiError(0, NETWORK_ERROR_MESSAGE);
  }
  if (!response.ok) {
    // The API explains its errors in Spanish in the "detail" field.
    const body: unknown = await response.json().catch(() => null);
    const detail =
      body && typeof body === 'object' && 'detail' in body && typeof body.detail === 'string'
        ? body.detail
        : 'El servidor respondió con un error. Intente de nuevo en un momento.';
    throw new ApiError(response.status, detail);
  }
  return (await response.json()) as T;
}
