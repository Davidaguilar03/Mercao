import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter, useLocation } from 'react-router-dom';

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname + location.search}</output>;
}

/** Renders with a fresh query cache (no retries) and an in-memory router. */
export function renderWithProviders(ui: ReactElement, route = '/') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>
        {ui}
        <LocationProbe />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/** Path and query string the router is at, to check what the selectors write in the URL. */
export function currentUrl(): string {
  return screen.getByTestId('location').textContent ?? '';
}

/** Text as the user reads it: non-breaking spaces become plain spaces. */
export function plain(text: string | null | undefined): string {
  return (text ?? '').replaceAll(String.fromCharCode(160), ' ');
}

type ApiResponse = unknown | ((params: URLSearchParams) => unknown);

/**
 * Replaces fetch with a stub that answers by URL path. A function receives the query string and
 * returns the body. Unknown paths answer 404.
 */
export function mockApi(responses: Record<string, ApiResponse>) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const { pathname, searchParams } = new URL(String(input), 'http://localhost');
    if (pathname in responses) {
      const response = responses[pathname];
      const body = typeof response === 'function' ? response(searchParams) : response;
      return new Response(JSON.stringify(body), { status: 200 });
    }
    return new Response(JSON.stringify({ detail: 'No encontrado.' }), { status: 404 });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}
