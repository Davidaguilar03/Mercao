import { PlaceholderPage } from './PlaceholderPage';

export function ProductPage() {
  return (
    <PlaceholderPage
      title="Producto"
      description="La historia de un producto en una plaza: precios, temporadas, origen y pronóstico."
      contents={[
        'La historia del precio semana a semana durante los últimos años.',
        'Los meses en que suele estar más barato y más caro.',
        'De qué departamentos y municipios llega el producto a la plaza.',
        'El pronóstico del precio para las próximas cuatro semanas, con su rango probable.',
      ]}
    />
  );
}
