import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { marketDetailPath } from '../../hooks/urlSelection';
import { currentUrl, renderWithProviders } from '../../test/utils';
import PriceMap, { type MapMarker } from './PriceMap';

const markers: MapMarker[] = [
  {
    marketId: 6,
    marketName: 'Pereira, Mercasa',
    city: 'Pereira',
    latitude: 4.814,
    longitude: -75.694,
    level: 'cheaper',
    price: 2317,
    change4w: -10.4,
    forecastPrice: 2254,
    forecastChangePct: -2.7,
  },
  {
    marketId: 4,
    marketName: 'Barranquilla, Barranquillita',
    city: 'Barranquilla',
    latitude: 10.964,
    longitude: -74.796,
    level: 'expensive',
    price: 3600,
    change4w: null,
    forecastPrice: null,
    forecastChangePct: null,
  },
];

function renderMap(route: string) {
  return renderWithProviders(
    <Routes>
      <Route path="/" element={<PriceMap productId={5} markers={markers} horizon={2} />} />
      <Route path="/producto" element={<h1>Producto</h1>} />
    </Routes>,
    route,
  );
}

describe('marketDetailPath', () => {
  it('points to the Producto view with the product and the market', () => {
    expect(marketDetailPath(5, 6, new URLSearchParams())).toBe('/producto?producto=5&plaza=6');
  });

  it('keeps the horizon of the current address and replaces any previous market', () => {
    const current = new URLSearchParams('producto=1&horizonte=3&plaza=2');
    expect(marketDetailPath(5, 6, current)).toBe('/producto?producto=5&horizonte=3&plaza=6');
  });
});

describe('PriceMap', () => {
  it('draws one marker per market, named with its city and price level', () => {
    renderMap('/');

    expect(screen.getByTitle('Pereira: más barata que la mayoría')).toBeInTheDocument();
    expect(screen.getByTitle('Barranquilla: más cara que la mayoría')).toBeInTheDocument();
  });

  it('opens a popup with a link to the detail of that market, keeping the selection', async () => {
    const user = userEvent.setup();
    renderMap('/?producto=5&horizonte=3');

    fireEvent.click(screen.getByTitle('Pereira: más barata que la mayoría'));
    expect(await screen.findByText('Pereira, Mercasa')).toBeInTheDocument();
    const link = screen.getByRole('link', { name: 'Ver detalle de esta plaza' });
    expect(link).toHaveAttribute('href', '/producto?producto=5&horizonte=3&plaza=6');

    await user.click(link);
    expect(screen.getByRole('heading', { name: 'Producto' })).toBeInTheDocument();
    expect(currentUrl()).toBe('/producto?producto=5&horizonte=3&plaza=6');
  });
});
