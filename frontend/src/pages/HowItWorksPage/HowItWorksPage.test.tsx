import { screen, within } from '@testing-library/react';
import { health, modelSummary } from '../../test/fixtures';
import { mockApi, plain, renderWithProviders } from '../../test/utils';
import { HowItWorksPage } from './HowItWorksPage';

function renderPage() {
  mockApi({ '/api/health': health, '/api/model/summary': modelSummary });
  return renderWithProviders(<HowItWorksPage />, '/como-funciona');
}

describe('HowItWorksPage', () => {
  it('explains the path of the data in five numbered steps', async () => {
    renderPage();

    const flow = screen
      .getByRole('heading', { name: 'De los boletines del DANE al pronóstico' })
      .closest('section')!;
    const steps = within(flow).getAllByRole('listitem');
    expect(steps).toHaveLength(5);
    expect(steps.map((step) => within(step).getByRole('heading').textContent)).toEqual([
      'El DANE publica los precios cada semana',
      'Mercao los descarga y los limpia',
      'El modelo aprende de los precios de años anteriores',
      'Estima el precio de las próximas 4 semanas',
      'La aplicación lo muestra por plaza',
    ]);
    expect(steps.map((step) => step.textContent?.charAt(0))).toEqual(['1', '2', '3', '4', '5']);

    // Once the summary loads, the steps use its real dates and numbers.
    expect(
      await screen.findByRole('heading', { name: 'El modelo aprende de los precios desde 2017' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Estima el precio de las próximas 2 semanas' }),
    ).toBeInTheDocument();
    expect(within(flow).getByText(/unas 80 de cada 100 veces/)).toBeInTheDocument();
  });

  it('shows the four key results as large figures with a plain explanation', async () => {
    renderPage();

    const results = await screen.findByRole('group', { name: 'Resultados del modelo' });
    const tiles = [...results.children].map((tile) => plain(tile.textContent));
    expect(tiles).toHaveLength(4);
    expect(tiles[0]).toContain('Error promedio14,0 %');
    expect(tiles[0]).toContain('unos $ 496 por kilo');
    expect(tiles[1]).toContain('Mejora frente al ingenuo6,1 %');
    expect(tiles[1]).toContain('falla en 14,9 %');
    expect(tiles[2]).toContain('Acierta si sube o baja60,5 %');
    expect(tiles[3]).toContain('Precios dentro del rango81,6 %');
    expect(tiles[3]).toContain('Se esperaba 80 %');
  });

  it('ranks the tested models by error and highlights the chosen one', async () => {
    renderPage();

    const card = (
      await screen.findByRole('heading', { name: 'Los 3 modelos que se probaron' })
    ).closest('section')!;
    const models = within(card)
      .getAllByRole('listitem')
      .map((item) => plain(item.textContent));
    expect(models[0]).toContain('Random Forest13,9 %');
    expect(models[1]).toContain('LightGBMElegido14,0 %');
    expect(models[2]).toContain('Ingenuo14,9 %');
    expect(models[2]).toContain('Supone que el precio de las próximas semanas será el de hoy.');
  });

  it('says honestly that another model did slightly better in the test', async () => {
    renderPage();

    const note = await screen.findByText(/Random Forest obtuvo un error ligeramente menor/);
    expect(plain(note.textContent)).toContain('(13,9 % frente a 14,0 %)');
    expect(screen.getByText(/Se seleccionó LightGBM con la siguiente regla/)).toBeInTheDocument();
  });

  it('keeps the results by horizon and the main variables', async () => {
    renderPage();

    const row = await screen.findByRole('row', { name: /^1 semana/ });
    expect(plain(row.textContent)).toBe('1 semana9,7 %10,1 %3,6 %58,9 %82,2 %');
    expect(screen.getByText('Precio vs. media 52 sem.')).toBeInTheDocument();
  });

  it('lists what Mercao does not do and gives the model version as a footnote', async () => {
    renderPage();

    const limits = screen
      .getByRole('heading', { name: 'Lo que Mercao no hace' })
      .closest('section')!;
    expect(within(limits).getAllByRole('listitem')).toHaveLength(5);
    expect(within(limits).getByText('No incluye el transporte.')).toBeInTheDocument();
    expect(within(limits).getByText('No garantiza precios.')).toBeInTheDocument();

    const footnote = await screen.findByText(/Versión del modelo: lightgbm-202611160849/);
    expect(footnote).toHaveTextContent('Entrenado el 16 de noviembre de 2026.');
    expect(footnote).toHaveTextContent('del 17 de noviembre de 2025 al 15 de noviembre de 2026');
  });

  it('keeps the steps and the limitations when the results cannot be loaded', async () => {
    mockApi({ '/api/health': health });
    renderWithProviders(<HowItWorksPage />, '/como-funciona');

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('No encontrado.');
    expect(within(alert).getByRole('button', { name: /Reintentar/ })).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Mercao los descarga y los limpia' }),
    ).toBeInTheDocument();
    expect(screen.getByText('No garantiza precios.')).toBeInTheDocument();
    expect(screen.queryByText(/Versión del modelo/)).not.toBeInTheDocument();
  });
});
