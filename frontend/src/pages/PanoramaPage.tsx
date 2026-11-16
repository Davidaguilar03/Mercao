import { PlaceholderPage } from './PlaceholderPage';

export function PanoramaPage() {
  return (
    <PlaceholderPage
      title="Panorama"
      description="Cómo está un producto esta semana en las principales plazas mayoristas del país."
      contents={[
        'El precio de la última semana en cada plaza, de la más barata a la más cara.',
        'Un mapa de Colombia para ubicar las plazas y comparar sus precios.',
        'Cuánto subió o bajó el precio frente a hace cuatro semanas y frente a hace un año.',
      ]}
    />
  );
}
