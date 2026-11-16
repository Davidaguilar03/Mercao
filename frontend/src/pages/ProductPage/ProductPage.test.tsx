import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { currentUrl, mockApi, plain, renderWithProviders } from '../../test/utils';
import {
  emptySupplyOrigins,
  fullApi,
  latestPrices,
  priceHistory,
  seasonality,
} from '../../test/viewFixtures';
import { ProductPage } from './ProductPage';

describe('ProductPage', () => {
  it('offers only the markets where the product is sold and starts with the first one', async () => {
    mockApi(fullApi);
    renderWithProviders(<ProductPage />);

    const select = await screen.findByRole('combobox', { name: 'Plaza' });
    await vi.waitFor(() => expect(select).toHaveValue('1'));
    expect(
      within(select)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['Bogotá, D.C., Corabastos', 'Cartago (Valle del Cauca)', 'Pereira, Mercasa']);
  });

  it('shows the key figures of the product in the market', async () => {
    mockApi(fullApi);
    renderWithProviders(<ProductPage />);

    const latest = (await screen.findByText('Último precio')).parentElement!;
    expect(plain(latest.textContent)).toContain('$ 3.063 /kg');
    expect(plain(latest.textContent)).toContain('Semana del 9 al 15 de noviembre de 2026');
    expect(plain(screen.getByText('Frente a hace 4 semanas').parentElement!.textContent)).toContain(
      '+4,8 %',
    );
    expect(plain(screen.getByText('Frente a hace un año').parentElement!.textContent)).toContain(
      '+154,0 %',
    );
    const forecast = (await screen.findByText('Pronóstico a 4 semanas')).parentElement!;
    await vi.waitFor(() => expect(plain(forecast.textContent)).toContain('$ 2.941 /kg'));
    expect(plain(forecast.textContent)).toContain(
      'Semana del 7 al 13 de diciembre de 2026. Rango probable: $ 2.172 a $ 3.843',
    );
  });

  it('describes the price chart in words and changes the period with the range buttons', async () => {
    mockApi(fullApi);
    const user = userEvent.setup();
    renderWithProviders(<ProductPage />);

    const description = await screen.findByText(/En este periodo el precio pasó de/);
    expect(plain(description.textContent)).toContain('pasó de $ 2.066 /kg');
    expect(screen.getByRole('button', { name: '3 años' })).toHaveAttribute('aria-pressed', 'true');

    await user.click(screen.getByRole('button', { name: '1 año' }));
    expect(screen.getByRole('button', { name: '1 año' })).toHaveAttribute('aria-pressed', 'true');
    expect(plain(screen.getByText(/En este periodo/).textContent)).toContain('pasó de $ 3.100 /kg');
  });

  it('explains the seasons and the origin of the product', async () => {
    mockApi(fullApi);
    renderWithProviders(<ProductPage />);

    const seasons = await screen.findByText(/Suele estar más barato en/);
    expect(seasons).toHaveTextContent('Suele estar más barato en septiembre y más caro en abril.');
    expect(screen.getByText('abril: índice 120')).toBeInTheDocument();

    const municipalities = await screen.findByRole('list', { name: 'Origen por municipio' });
    expect(plain(within(municipalities).getAllByRole('listitem')[0].textContent)).toBe(
      'Ipiales (Nariño)2.000 t20,0 %',
    );
  });

  it('explains why a market has no supply data', async () => {
    mockApi({ ...fullApi, '/api/supply/origins': emptySupplyOrigins });
    renderWithProviders(<ProductPage />, '/producto?plaza=8');

    expect(
      await screen.findByText('Sin datos de abastecimiento para esta plaza'),
    ).toBeInTheDocument();
    expect(screen.getByText(emptySupplyOrigins.message!)).toBeInTheDocument();
    expect(
      screen.getByText(/El DANE mide de dónde llega la carga solo en algunas plazas/),
    ).toBeInTheDocument();
  });

  it('shows empty states for a market without history or full years', async () => {
    mockApi({
      ...fullApi,
      '/api/prices/history': { ...priceHistory, series: [] },
      '/api/prices/seasonality': {
        ...seasonality,
        months: [],
        years_used: [],
        cheapest_month: null,
        most_expensive_month: null,
        message: 'No hay ningún año completo de precios.',
      },
    });
    renderWithProviders(<ProductPage />);

    expect(await screen.findByText('Sin historia de precios')).toBeInTheDocument();
    expect(await screen.findByText('No hay ningún año completo de precios.')).toBeInTheDocument();
  });

  it('explains when no market sells the product', async () => {
    mockApi({ ...fullApi, '/api/prices/latest': { ...latestPrices, markets: [] } });
    renderWithProviders(<ProductPage />);

    expect(
      await screen.findByText('No hay plazas con precios de este producto'),
    ).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Plaza' })).toBeDisabled();
  });

  it('shows an error with a retry button when the prices cannot be loaded', async () => {
    const api: Record<string, unknown> = { ...fullApi };
    delete api['/api/prices/latest'];
    mockApi(api);
    renderWithProviders(<ProductPage />);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('No encontrado.');
    expect(within(alert).getByRole('button', { name: /Reintentar/ })).toBeInTheDocument();
  });

  it('reads the market from the URL and writes it back when another one is chosen', async () => {
    const fetchMock = mockApi(fullApi);
    const user = userEvent.setup();
    renderWithProviders(<ProductPage />, '/producto?producto=1&plaza=6');

    const select = await screen.findByRole('combobox', { name: 'Plaza' });
    await vi.waitFor(() => expect(select).toHaveValue('6'));
    await vi.waitFor(() =>
      expect(fetchMock.mock.calls.map(([url]) => String(url))).toContain(
        'http://localhost:8000/api/prices/history?product_id=1&market_id=6&from=2000-01-01',
      ),
    );

    await user.selectOptions(select, 'Cartago (Valle del Cauca)');
    expect(currentUrl()).toBe('/producto?producto=1&plaza=8');
  });

  it('falls back to an available market when the URL names one that does not sell the product', async () => {
    mockApi(fullApi);
    renderWithProviders(<ProductPage />, '/producto?plaza=4');

    const select = await screen.findByRole('combobox', { name: 'Plaza' });
    await vi.waitFor(() => expect(select).toHaveValue('1'));
  });
});
