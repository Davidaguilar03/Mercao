import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from './App';
import { health, modelSummary } from './test/fixtures';
import { mockApi, renderWithProviders } from './test/utils';

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
