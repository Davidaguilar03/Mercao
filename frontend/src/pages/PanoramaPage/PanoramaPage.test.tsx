import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { currentUrl, mockApi, plain, renderWithProviders } from '../../test/utils';
import { emptySupplyOrigins, fullApi, latestPrices } from '../../test/viewFixtures';
import { PanoramaPage } from './PanoramaPage';
import type { MapMarker } from './PriceMap';

// Leaflet needs a real browser layout; the test replaces the map with the list of its markers.
vi.mock('./PriceMap', () => ({
  default: ({ markers }: { markers: MapMarker[] }) => (
    <ul aria-label="Mapa de plazas">
      {markers.map((marker) => (
        <li key={marker.marketId} data-level={marker.level}>
          {marker.city}
        </li>
      ))}
    </ul>
  ),
}));

describe('PanoramaPage', () => {
  it('shows the default product with its summary sentence', async () => {
    mockApi(fullApi);
    renderWithProviders(<PanoramaPage />);

    const summary = await screen.findByText(/Esta semana el precio más bajo/);
    expect(plain(summary.textContent)).toBe(
      'Esta semana el precio más bajo de papa parda pastusa está en Pereira ($ 2.317 /kg) y el ' +
        'más alto en Cartago ($ 3.477 /kg). Frente a hace cuatro semanas subió en 2 de 3 plazas.',
    );
    expect(screen.getByRole('combobox', { name: 'Producto' })).toHaveValue('Papa parda pastusa');
  });

  it('colors the markers by price against the median of the group', async () => {
    mockApi(fullApi);
    renderWithProviders(<PanoramaPage />);

    const map = await screen.findByRole('list', { name: 'Mapa de plazas' });
    const levels = within(map)
      .getAllByRole('listitem')
      .map((item) => `${item.textContent}: ${item.getAttribute('data-level')}`);
    expect(levels).toEqual(['Pereira: cheaper', 'Bogotá: similar', 'Cartago: expensive']);
    // The legend explains the three levels and that they are not price changes.
    const legend = screen.getByRole('list', { name: 'Nivel de precio de cada plaza' });
    expect(
      within(legend)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual([
      '$Más barata que la mayoría',
      '$$Precio parecido al de la mayoría',
      '$$$Más cara que la mayoría',
    ]);
    expect(
      screen.getByText(/No dicen si el precio subió o bajó.*en verde si sube y en rojo si baja/),
    ).toBeInTheDocument();
  });

  it('lists the markets from the cheapest to the most expensive with changes and forecast', async () => {
    mockApi(fullApi);
    renderWithProviders(<PanoramaPage />);

    const table = await screen.findByRole('table');
    // After the header row comes the row that names the variety of the group.
    const [group, ...rows] = within(table).getAllByRole('row').slice(1);
    expect(group).toHaveTextContent('Variedad: parda pastusa');
    // Each market carries the mark of its price level (one to three peso signs) and its meaning.
    expect(rows.map((row) => within(row).getByRole('rowheader').textContent)).toEqual([
      '$Pereira, MercasaMás barata',
      '$$Bogotá, D.C., CorabastosPrecio parecido',
      '$$$Cartago (Valle del Cauca)Más cara',
    ]);
    const pereira = plain(rows[0].textContent);
    expect(pereira).toContain('$ 2.317 /kg');
    expect(pereira).toContain('Bajó−10,4 %');
    expect(pereira).toContain('Subió+172,6 %');
    expect(pereira).toContain('$ 2.254 /kg');
    // Market convention: a rise is marked "up" (green) and a fall "down" (terracotta).
    const trends = [...rows[0].querySelectorAll('[data-trend]')].map((badge) =>
      badge.getAttribute('data-trend'),
    );
    expect(trends).toEqual(['down', 'up', 'down']);
    // Cartago has no price a year ago.
    expect(plain(rows[2].textContent)).toContain('Sin dato');
  });

  it('shows where the product comes from, with the rest and the imported part', async () => {
    mockApi(fullApi);
    renderWithProviders(<PanoramaPage />);

    const origins = await screen.findByRole('list', { name: /Origen de Papa parda pastusa/ });
    const items = within(origins)
      .getAllByRole('listitem')
      .map((item) => plain(item.textContent));
    expect(items).toEqual([
      'Nariño5.000 t50,0 %',
      'Cundinamarca3.000 t30,0 %',
      'Norte de Santander1.500 t15,0 %',
      'Importado500 t5,0 %',
    ]);
  });

  it('still shows the prices when the forecasts fail', async () => {
    const api: Record<string, unknown> = { ...fullApi };
    delete api['/api/forecasts'];
    mockApi(api);
    renderWithProviders(<PanoramaPage />);

    const table = await screen.findByRole('table');
    expect(await within(table).findAllByText('Sin pronóstico')).toHaveLength(3);
    expect(await screen.findByText(/No pudimos cargar los pronósticos/)).toBeInTheDocument();
  });

  it('explains when the product has no recent prices', async () => {
    mockApi({ ...fullApi, '/api/prices/latest': { ...latestPrices, markets: [] } });
    renderWithProviders(<PanoramaPage />);

    expect(
      await screen.findByText('No hay precios recientes de este producto'),
    ).toBeInTheDocument();
  });

  it('explains when there is no supply data', async () => {
    mockApi({ ...fullApi, '/api/supply/origins': emptySupplyOrigins });
    renderWithProviders(<PanoramaPage />);

    expect(await screen.findByText('Sin datos de abastecimiento')).toBeInTheDocument();
    expect(screen.getByText(emptySupplyOrigins.message!)).toBeInTheDocument();
  });

  it('shows an error with a retry button when the prices cannot be loaded', async () => {
    const api: Record<string, unknown> = { ...fullApi };
    delete api['/api/prices/latest'];
    mockApi(api);
    renderWithProviders(<PanoramaPage />);

    const alerts = await screen.findAllByRole('alert');
    expect(alerts[0]).toHaveTextContent('No encontrado.');
    expect(within(alerts[0]).getByRole('button', { name: /Reintentar/ })).toBeInTheDocument();
  });

  it('reads the product from the URL and writes it back when another one is chosen', async () => {
    const fetchMock = mockApi(fullApi);
    const user = userEvent.setup();
    renderWithProviders(<PanoramaPage />, '/?producto=6');

    const input = await screen.findByRole('combobox', { name: 'Producto' });
    await vi.waitFor(() => expect(input).toHaveValue('Zanahoria'));
    expect(fetchMock.mock.calls.map(([url]) => String(url))).toContain(
      'http://localhost:8000/api/prices/latest?product_id=6',
    );

    await user.click(input);
    await user.click(screen.getByRole('option', { name: /Cebolla junca/ }));
    expect(currentUrl()).toBe('/?producto=3');
  });
});
