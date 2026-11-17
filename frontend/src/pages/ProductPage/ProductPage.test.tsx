import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { currentUrl, mockApi, plain, renderWithProviders } from '../../test/utils';
import {
  emptySupplyOrigins,
  fullApi,
  latestPrices,
  priceHistory,
  seasonality,
  supplyOrigins,
} from '../../test/viewFixtures';
import { ProductPage } from './ProductPage';

describe('ProductPage', () => {
  it('offers only the markets where the product is sold and starts with the first one', async () => {
    mockApi(fullApi);
    renderWithProviders(<ProductPage />);

    const user = userEvent.setup();
    const select = await screen.findByRole('combobox', { name: 'Plaza' });
    await vi.waitFor(() => expect(select).toHaveValue('Bogotá, D.C., Corabastos'));
    await user.click(select);
    const list = screen.getByRole('listbox', { name: 'Plaza' });
    expect(
      within(list)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['Bogotá, D.C., Corabastos', 'Cartago (Valle del Cauca)', 'Pereira, Mercasa']);
    expect(within(list).getByRole('option', { selected: true })).toHaveTextContent(
      'Bogotá, D.C., Corabastos',
    );
  });

  it('searches the market ignoring accents and selects it with the keyboard', async () => {
    mockApi(fullApi);
    const user = userEvent.setup();
    renderWithProviders(<ProductPage />);

    const select = await screen.findByRole('combobox', { name: 'Plaza' });
    await vi.waitFor(() => expect(select).toBeEnabled());
    await user.type(select, 'bogota');
    const list = screen.getByRole('listbox', { name: 'Plaza' });
    expect(within(list).getAllByRole('option')).toHaveLength(1);
    await user.clear(select);
    await user.type(select, 'xyz');
    expect(screen.getByText('Ninguna plaza coincide con «xyz».')).toBeInTheDocument();
    await user.clear(select);
    await user.type(select, 'pereira{Enter}');
    expect(currentUrl()).toBe('/?plaza=6');
    expect(select).toHaveAttribute('aria-expanded', 'false');
  });

  it('shows the four key figures in one system: label, large figure and explanation', async () => {
    mockApi(fullApi);
    renderWithProviders(<ProductPage />);

    const figures = await screen.findByRole('group', { name: 'Cifras clave' });
    await vi.waitFor(() => expect(plain(figures.textContent)).toContain('$ 2.941 /kg'));
    const cards = [...figures.children];
    expect(cards).toHaveLength(4);
    // Every figure, price or percentage, uses the same large style.
    for (const card of cards) {
      expect(card.querySelector('p + div > p')).toHaveClass('value');
    }

    const [latest, fourWeeks, year, forecast] = cards.map((card) => plain(card.textContent));
    expect(latest).toBe('Último precio$ 3.063 /kgSemana del 9 al 15 de noviembre de 2026');
    expect(fourWeeks).toContain('Frente a hace 4 semanasSubió+4,8 %Hoy está más caro');
    expect(year).toContain('Frente a hace un añoSubió+154,0 %Hoy está más caro');
    expect(cards[1].querySelector('.value')).toHaveClass('up');
    expect(forecast).toContain('Pronóstico a 4 semanas$ 2.941 /kgRango probable');
    expect(cards[3]).toHaveAttribute('title', 'Para la semana del 7 al 13 de diciembre de 2026');
    expect(
      within(cards[3] as HTMLElement).getByRole('img', {
        name: /Rango probable: de \$.2\.172 a \$.3\.843/,
      }),
    ).toBeInTheDocument();
  });

  it('shows the reference price of four weeks and a year ago when the history has it', async () => {
    const history = {
      ...priceHistory,
      series: [
        { week_start: '2025-11-10', mean_price: 1206, min_price: 1100, max_price: 1300 },
        { week_start: '2026-10-12', mean_price: 2923, min_price: 2800, max_price: 3000 },
        { week_start: '2026-11-09', mean_price: 3063, min_price: 2800, max_price: 3400 },
      ],
    };
    mockApi({ ...fullApi, '/api/prices/history': history });
    renderWithProviders(<ProductPage />);

    const figures = await screen.findByRole('group', { name: 'Cifras clave' });
    await vi.waitFor(() => expect(plain(figures.textContent)).toContain('Estaba en $ 2.923 /kg'));
    expect(plain(figures.textContent)).toContain('Estaba en $ 1.206 /kg');
  });

  it('says so when a change cannot be computed', async () => {
    mockApi(fullApi);
    renderWithProviders(<ProductPage />, '/producto?plaza=8');

    // Cartago has no price a year ago in the test data.
    expect(
      await screen.findByText('No hay precio de hace un año para comparar.'),
    ).toBeInTheDocument();
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

  it('shows the top six municipalities and the rest with "Ver más"', async () => {
    const names = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
    const origins = {
      ...supplyOrigins,
      municipalities: names.map((name, index) => ({
        code: `1500${index}`,
        name: `MUNICIPIO ${name}`,
        department: 'BOYACÁ',
        kg: 1000000 - index * 50000,
        share_pct: 10 - index * 0.5,
      })),
    };
    mockApi({ ...fullApi, '/api/supply/origins': origins });
    const user = userEvent.setup();
    renderWithProviders(<ProductPage />);

    const list = await screen.findByRole('list', { name: 'Origen por municipio' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(6);
    expect(screen.getByText(/Los 6 municipios que más carga enviaron/)).toBeInTheDocument();

    const more = screen.getByRole('button', { name: 'Ver más' });
    expect(more).toHaveAttribute('aria-expanded', 'false');
    await user.click(more);
    expect(within(list).getAllByRole('listitem')).toHaveLength(10);
    expect(screen.getByText(/Los 10 municipios que más carga enviaron/)).toBeInTheDocument();

    const less = screen.getByRole('button', { name: 'Ver menos' });
    expect(less).toHaveAttribute('aria-expanded', 'true');
    await user.click(less);
    expect(within(list).getAllByRole('listitem')).toHaveLength(6);
  });

  it('does not offer "Ver más" when there are six municipalities or fewer', async () => {
    mockApi(fullApi);
    renderWithProviders(<ProductPage />);

    await screen.findByRole('list', { name: 'Origen por municipio' });
    expect(screen.queryByRole('button', { name: 'Ver más' })).not.toBeInTheDocument();
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
    await vi.waitFor(() => expect(select).toHaveValue('Pereira, Mercasa'));
    await vi.waitFor(() =>
      expect(fetchMock.mock.calls.map(([url]) => String(url))).toContain(
        'http://localhost:8000/api/prices/history?product_id=1&market_id=6&from=2000-01-01',
      ),
    );

    await user.click(select);
    await user.click(screen.getByRole('option', { name: 'Cartago (Valle del Cauca)' }));
    expect(currentUrl()).toBe('/producto?producto=1&plaza=8');
  });

  it('falls back to an available market when the URL names one that does not sell the product', async () => {
    mockApi(fullApi);
    renderWithProviders(<ProductPage />, '/producto?plaza=4');

    const select = await screen.findByRole('combobox', { name: 'Plaza' });
    await vi.waitFor(() => expect(select).toHaveValue('Bogotá, D.C., Corabastos'));
  });
});
