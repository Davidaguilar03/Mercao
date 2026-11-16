import { PlaceholderPage } from './PlaceholderPage';

export function OpportunitiesPage() {
  return (
    <PlaceholderPage
      title="Oportunidades"
      description="Dónde convendría comprar y dónde vender un producto en las próximas semanas."
      contents={[
        'La plaza con el precio esperado más bajo y la plaza con el más alto, de una a cuatro semanas adelante.',
        'La diferencia entre las dos, en pesos por kilo y en porcentaje.',
        'Qué tan confiable es esa diferencia según el rango de cada pronóstico.',
      ]}
    />
  );
}
