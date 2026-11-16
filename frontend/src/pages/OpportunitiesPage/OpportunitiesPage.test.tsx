import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { currentUrl, mockApi, plain, renderWithProviders } from '../../test/utils';
import { emptyRecommendations, fullApi, recommendationsFor } from '../../test/viewFixtures';
import { OpportunitiesPage } from './OpportunitiesPage';

describe('OpportunitiesPage', () => {
  it('shows where to buy and where to sell, the difference and the target week', async () => {
    mockApi(fullApi);
    renderWithProviders(<OpportunitiesPage />);

    const buy = (await screen.findByText('Comprar en')).parentElement!;
    expect(plain(buy.textContent)).toContain('Pereira, Mercasa$ 2.254 /kg');
    const sell = screen.getByText('Vender en').parentElement!;
    expect(plain(sell.textContent)).toContain('Cartago (Valle del Cauca)$ 3.355 /kg');
    expect(plain(screen.getByText(/Diferencia esperada/).textContent)).toBe(
      'Diferencia esperada: $ 1.101 por kilo (48,8 %)',
    );
    expect(
      screen.getByText(/Pronóstico para la semana del 23 al 29 de noviembre de 2026/),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Variedad: parda pastusa' })).toBeInTheDocument();
  });

  it('explains a low confidence and shows the two ranges', async () => {
    mockApi(fullApi);
    renderWithProviders(<OpportunitiesPage />);

    expect(await screen.findByText('Confianza baja')).toBeInTheDocument();
    expect(
      screen.getByText(/Los rangos de precio de las dos plazas se cruzan/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('img', {
        name: /Rango probable en Pereira: de \$.1\.777 a \$.2\.769\. Rango probable en Cartago: de \$.2\.645 a \$.4\.120\./,
      }),
    ).toBeInTheDocument();
  });

  it('explains a high confidence', async () => {
    const high = recommendationsFor(2);
    high.groups[0].confidence = 'alta';
    mockApi({ ...fullApi, '/api/recommendations': high });
    renderWithProviders(<OpportunitiesPage />);

    expect(await screen.findByText('Confianza alta')).toBeInTheDocument();
    expect(screen.getByText(/no se cruzan/)).toBeInTheDocument();
  });

  it('ranks every market of the group from the cheapest forecast to the most expensive', async () => {
    mockApi(fullApi);
    renderWithProviders(<OpportunitiesPage />);

    const table = await screen.findByRole('table');
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows.map((row) => plain(row.textContent))).toEqual([
      'Pereira, MercasaComprar$ 2.254 /kg$ 1.777 a $ 2.769',
      'Bogotá, D.C., Corabastos$ 2.938 /kg$ 2.316 a $ 3.608',
      'Cartago (Valle del Cauca)Vender$ 3.355 /kg$ 2.645 a $ 4.120',
    ]);
  });

  it('always shows the note about costs and estimates, even without data', async () => {
    mockApi({});
    renderWithProviders(<OpportunitiesPage />);

    const note = screen.getByRole('note');
    expect(note).toHaveTextContent('no incluyen transporte, almacenamiento ni intermediación');
    expect(note).toHaveTextContent('son estimaciones, no precios garantizados');
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
