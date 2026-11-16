import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from './App';
import { health, modelSummary } from './test/fixtures';
import { mockApi, renderWithProviders } from './test/utils';

const plain = (text: string | null) => (text ?? '').replace(/\u00a0/g, ' ');

function renderApp(route = '/') {
  mockApi({ '/api/health': health, '/api/model/summary': modelSummary });
  return renderWithProviders(<App />, route);
}

describe('routing shell', () => {
  it('shows the brand, the tagline and the main navigation', () => {
    renderApp();

    const brand = screen.getByRole('link', { name: 'Mercao, ir al inicio' });
    expect(brand).toHaveAttribute('href', '/');
    expect(within(brand).getByText('Mercao')).toBeInTheDocument();
    expect(within(brand).getByText('Precios de plaza, claros.')).toBeInTheDocument();
    const nav = screen.getByRole('navigation', { name: 'Principal' });
    const links = within(nav)
      .getAllByRole('link')
      .map((link) => link.textContent);
    expect(links).toEqual(['Panorama', 'Producto', 'Oportunidades', 'Cómo funciona']);
  });

  it.each([
    ['/', 'Panorama'],
    ['/producto', 'Producto'],
    ['/oportunidades', 'Oportunidades'],
    ['/como-funciona', 'Cómo funciona'],
  ])('renders %s with its heading, page title and current link', (route, name) => {
    renderApp(route);

    expect(screen.getByRole('heading', { level: 1, name })).toBeInTheDocument();
    expect(document.title).toBe(`${name} | Mercao`);
    expect(screen.getByRole('link', { name, current: 'page' })).toBeInTheDocument();
  });

  it('navigates with the menu', async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getByRole('link', { name: 'Oportunidades' }));

    expect(screen.getByRole('heading', { level: 1, name: 'Oportunidades' })).toBeInTheDocument();
  });

  it('keeps the selected product and horizon in the links between the main pages', () => {
    renderApp('/producto?producto=5&horizonte=3&plaza=2');

    expect(screen.getByRole('link', { name: 'Oportunidades' })).toHaveAttribute(
      'href',
      '/oportunidades?producto=5&horizonte=3',
    );
    expect(screen.getByRole('link', { name: 'Panorama' })).toHaveAttribute(
      'href',
      '/?producto=5&horizonte=3',
    );
    expect(screen.getByRole('link', { name: 'Cómo funciona' })).toHaveAttribute(
      'href',
      '/como-funciona',
    );
  });

  it('opens and closes the mobile menu', async () => {
    const user = userEvent.setup();
    renderApp();

    const button = screen.getByRole('button', { name: 'Abrir menú' });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    await user.click(button);
    expect(screen.getByRole('button', { name: 'Cerrar menú' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    await user.keyboard('{Escape}');
    expect(screen.getByRole('button', { name: 'Abrir menú' })).toBeInTheDocument();
  });

  it('shows a Spanish 404 page for unknown routes', () => {
    renderApp('/no-existe');

    expect(screen.getByText('No encontramos esta página')).toBeInTheDocument();
    expect(document.title).toBe('Página no encontrada | Mercao');
    expect(screen.getByRole('link', { name: 'Volver al panorama de precios' })).toHaveAttribute(
      'href',
      '/',
    );
  });

  it('shows the data source and the latest data week in the footer', async () => {
    renderApp();

    const footer = screen.getByRole('contentinfo');
    expect(footer).toHaveTextContent('SIPSA');
    expect(footer).toHaveTextContent('DANE');
    expect(await within(footer).findByText(/Datos hasta la semana 46 de 2026/)).toBeInTheDocument();
    expect(footer).toHaveTextContent('Los pronósticos son estimaciones');
  });
});

describe('Cómo funciona', () => {
  it('shows the chosen model and its test results against the naive forecast', async () => {
    renderApp('/como-funciona');

    expect(await screen.findByRole('heading', { name: 'El modelo elegido' })).toBeInTheDocument();
    expect(screen.getByText('LightGBM')).toBeInTheDocument();
    // Random Forest did slightly better in the test and the page says so.
    expect(screen.getByText(/Random Forest tuvo un error apenas menor/)).toBeInTheDocument();

    const improvement = screen.getByText('Mejora frente al ingenuo').parentElement!;
    expect(plain(improvement.textContent)).toContain('6,1 %');
    const row = screen.getByRole('row', { name: /^1 semana/ });
    expect(plain(row.textContent)).toBe('1 semana9,7 %10,1 %3,6 %58,9 %82,2 %');
    expect(screen.getByText('Precio vs. media 52 sem.')).toBeInTheDocument();
    expect(screen.getByText(/No incluye el transporte/)).toBeInTheDocument();
  });

  it('explains the failure and offers a retry when the summary cannot be loaded', async () => {
    mockApi({ '/api/health': health });
    renderWithProviders(<App />, '/como-funciona');

    expect(await screen.findByRole('alert')).toHaveTextContent('No encontrado.');
    expect(screen.getByRole('button', { name: /Reintentar/ })).toBeInTheDocument();
    // The limitations do not depend on the API.
    expect(screen.getByText(/Es una estimación/)).toBeInTheDocument();
  });
});
