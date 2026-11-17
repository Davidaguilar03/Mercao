import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { currentUrl, mockApi, plain, renderWithProviders } from '../../test/utils';
import {
  emptyRecommendations,
  fullApi,
  priceHistory,
  recommendationsFor,
} from '../../test/viewFixtures';
import { OpportunitiesPage } from './OpportunitiesPage';

describe('OpportunitiesPage', () => {
  it('shows where to buy and where to sell, the difference and the target week', async () => {
    mockApi(fullApi);
    renderWithProviders(<OpportunitiesPage />);

    const buy = (await screen.findByText('Comprar en')).parentElement!;
    expect(plain(buy.textContent)).toContain('Pereira, Mercasa');
    expect(plain(buy.textContent)).toContain('Precio esperado: $ 2.254 /kg');
    const sell = screen.getByText('Vender en').parentElement!;
    expect(plain(sell.textContent)).toContain('Cartago (Valle del Cauca)');
    expect(plain(sell.textContent)).toContain('Precio esperado: $ 3.355 /kg');
    expect(plain(screen.getByText('Diferencia esperada').parentElement!.textContent)).toBe(
      'Diferencia esperada$ 1.101 /kg48,8 % sobre el precio de compra',
    );
    expect(
      screen.getByText(/Pronóstico para la semana del 23 al 29 de noviembre de 2026/),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Variedad: parda pastusa' })).toBeInTheDocument();
  });

  it('shows the expected change of each market against its latest price', async () => {
    mockApi(fullApi);
    renderWithProviders(<OpportunitiesPage />);

    // The market with the expected change at its right, then the expected price and the latest one.
    const buy = (await screen.findByText('Comprar en')).closest<HTMLElement>('.side')!;
    expect(within(buy).getByText('Pereira')).toHaveAttribute('title', 'Pereira, Mercasa');
    expect(plain(buy.textContent)).toBe(
      'Comprar enPereiraPereira, MercasaBajó−2,7 %' +
        'Precio esperado: $ 2.254 /kgfrente al último precio ($ 2.317 /kg)',
    );
    const sell = screen.getByText('Vender en').closest('.side')!;
    expect(plain(sell.textContent)).toContain(
      'Bajó\u22123,5 %Precio esperado: $ 3.355 /kgfrente al último precio ($ 3.477 /kg)',
    );
    const change = sell.querySelector('[data-trend]');
    expect(change).toHaveAttribute('data-trend', 'down');
    expect(change).toHaveClass('lg', 'down');
  });

  it('draws the recent prices of each market and the forecast point colored by direction', async () => {
    const recommendations = recommendationsFor(2);
    recommendations.groups[0].sell.expected_change_percent = 4.2;
    const fetchMock = mockApi({ ...fullApi, '/api/recommendations': recommendations });
    renderWithProviders(<OpportunitiesPage />);

    const sparklines = () =>
      screen.queryAllByRole('img', { name: 'Precio de las últimas 12 semanas y pronóstico' });
    await waitFor(() => expect(sparklines()).toHaveLength(2));
    const [buy, sell] = sparklines();
    expect(buy).toHaveAttribute('title', 'Precio de las últimas 12 semanas y pronóstico');
    // Only the weeks inside the last 12 are drawn: two of the four in the mocked history.
    expect(buy.querySelector('.line')).toHaveAttribute(
      'd',
      expect.stringMatching(/^M[^L]+L[^L]+$/),
    );
    expect(buy.querySelector('.forecastLine')).not.toBeNull();
    expect(buy.querySelector('.dot')).toHaveAttribute('data-trend', 'down');
    expect(buy.querySelector('.dot')).toHaveClass('down');
    expect(sell.querySelector('.dot')).toHaveAttribute('data-trend', 'up');
    expect(sell.querySelector('.dot')).toHaveClass('up');
    // One history request per market, the same query the Producto view uses.
    const history = fetchMock.mock.calls
      .map(([url]) => String(url))
      .filter((url) => url.includes('/api/prices/history'));
    expect(history).toHaveLength(2);
    expect(history.every((url) => url.includes('from=2000-01-01'))).toBe(true);
  });

  it('leaves the sparkline space empty when the market has no recent prices', async () => {
    mockApi({
      ...fullApi,
      '/api/prices/history': { ...priceHistory, series: [] },
    });
    renderWithProviders(<OpportunitiesPage />);

    await screen.findByText('Comprar en');
    expect(
      screen.queryByRole('img', { name: 'Precio de las últimas 12 semanas y pronóstico' }),
    ).not.toBeInTheDocument();
  });

  it('says there is no data when a market has no latest price', async () => {
    const withoutLatest = recommendationsFor(2);
    withoutLatest.groups[0].buy.latest_price = null;
    withoutLatest.groups[0].buy.expected_change_percent = null;
    mockApi({ ...fullApi, '/api/recommendations': withoutLatest });
    renderWithProviders(<OpportunitiesPage />);

    const buy = (await screen.findByText('Comprar en')).closest('.side')!;
    expect(buy).toHaveTextContent('Sin dato');
    expect(buy).not.toHaveTextContent('frente al último precio');
  });

  it('shows the straight-line distance between the two cities', async () => {
    mockApi(fullApi);
    renderWithProviders(<OpportunitiesPage />);

    const label = await screen.findByText('Distancia aproximada en línea recta');
    expect(plain(label.parentElement!.textContent)).toBe(
      'Distancia aproximada en línea recta25 kmentre Pereira y Cartago',
    );
  });

  it('explains a low confidence and shows the two ranges', async () => {
    mockApi(fullApi);
    renderWithProviders(<OpportunitiesPage />);

    expect(await screen.findByText('Confianza baja')).toBeInTheDocument();
    expect(
      screen.getByText(/Los rangos probables de las dos plazas se superponen/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('img', {
        name: /Rango probable en Pereira: de \$.1\.777 a \$.2\.769\. Rango probable en Cartago: de \$.2\.645 a \$.4\.120\. Los rangos se cruzan entre \$.2\.645 y \$.2\.769\./,
      }),
    ).toBeInTheDocument();
    // The stretch both ranges share is marked and named.
    expect(screen.getByText('Zona donde los rangos se cruzan')).toBeInTheDocument();
  });

  it('explains a high confidence', async () => {
    const high = recommendationsFor(2);
    high.groups[0].confidence = 'alta';
    high.groups[0].sell.lower_price = 2800;
    mockApi({ ...fullApi, '/api/recommendations': high });
    renderWithProviders(<OpportunitiesPage />);

    expect(await screen.findByText('Confianza alta')).toBeInTheDocument();
    expect(screen.getByText(/no se superponen/)).toBeInTheDocument();
    expect(screen.queryByText('Zona donde los rangos se cruzan')).not.toBeInTheDocument();
  });

  it('ranks every market of the group from the cheapest forecast to the most expensive', async () => {
    mockApi(fullApi);
    renderWithProviders(<OpportunitiesPage />);

    const table = await screen.findByRole('table');
    const rows = within(table).getAllByRole('row').slice(1);
    // Header cell (market and tag), then price and range; the price cell repeats the range for
    // phones, where the range column is hidden.
    const cells = rows.map((row) =>
      [within(row).getByRole('rowheader'), ...within(row).getAllByRole('cell')].map((cell) =>
        plain(cell.textContent),
      ),
    );
    expect(cells).toEqual([
      ['Pereira, MercasaComprar', '$ 2.254 /kg$ 1.777 a $ 2.769', '$ 1.777 a $ 2.769'],
      ['Bogotá, D.C., Corabastos', '$ 2.938 /kg$ 2.316 a $ 3.608', '$ 2.316 a $ 3.608'],
      ['Cartago (Valle del Cauca)Vender', '$ 3.355 /kg$ 2.645 a $ 4.120', '$ 2.645 a $ 4.120'],
    ]);
  });

  it('always shows the note about costs and estimates, even without data', async () => {
    mockApi({});
    renderWithProviders(<OpportunitiesPage />);

    const note = screen.getByRole('note');
    expect(note).toHaveTextContent(
      'no incluyen costos de transporte, almacenamiento ni intermediación',
    );
    expect(note).toHaveTextContent('constituyen estimaciones, no precios garantizados');
    expect(note).toHaveTextContent('es menor que el recorrido por carretera');
  });

  it('explains when there are not two markets to compare', async () => {
    mockApi({ ...fullApi, '/api/recommendations': emptyRecommendations });
    renderWithProviders(<OpportunitiesPage />);

    expect(await screen.findByText('No hay plazas para comparar')).toBeInTheDocument();
    expect(screen.getByText(emptyRecommendations.message!)).toBeInTheDocument();
    expect(screen.getByRole('note')).toBeInTheDocument();
  });

  it('shows an error with a retry button when the recommendations cannot be loaded', async () => {
    const api: Record<string, unknown> = { ...fullApi };
    delete api['/api/recommendations'];
    mockApi(api);
    renderWithProviders(<OpportunitiesPage />);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('No encontrado.');
    expect(within(alert).getByRole('button', { name: /Reintentar/ })).toBeInTheDocument();
  });

  it('uses two weeks by default, reads the horizon from the URL and writes it back', async () => {
    const fetchMock = mockApi(fullApi);
    const user = userEvent.setup();
    const requested = () => fetchMock.mock.calls.map(([url]) => String(url));
    const view = renderWithProviders(<OpportunitiesPage />);

    expect(screen.getByRole('radio', { name: '2 semanas' })).toBeChecked();
    await screen.findByText('Comprar en');
    expect(requested()).toContain(
      'http://localhost:8000/api/recommendations?product_id=1&horizon=2',
    );
    view.unmount();

    renderWithProviders(<OpportunitiesPage />, '/oportunidades?producto=1&horizonte=4');
    expect(screen.getByRole('radio', { name: '4 semanas' })).toBeChecked();
    expect(
      await screen.findByText(/Pronóstico para la semana del 7 al 13 de diciembre de 2026/),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: '1 semana' }));
    expect(currentUrl()).toBe('/oportunidades?producto=1&horizonte=1');
    expect(
      await screen.findByText(/Pronóstico para la semana del 16 al 22 de noviembre de 2026/),
    ).toBeInTheDocument();
  });

  it('ignores a horizon outside 1 to 4 weeks', () => {
    mockApi(fullApi);
    renderWithProviders(<OpportunitiesPage />, '/oportunidades?horizonte=9');

    expect(screen.getByRole('radio', { name: '2 semanas' })).toBeChecked();
  });
});
