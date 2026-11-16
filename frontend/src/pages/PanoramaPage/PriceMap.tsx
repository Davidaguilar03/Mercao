import 'leaflet/dist/leaflet.css';

import L from 'leaflet';
import { useState } from 'react';
import { MapContainer, Marker, Popup, TileLayer, Tooltip } from 'react-leaflet';
import { ChangeBadge } from '../../components/ChangeBadge/ChangeBadge';
import { PriceTag } from '../../components/PriceTag/PriceTag';
import type { PriceLevel } from '../../lib/analysis';
import { LEVEL_LABELS } from '../../lib/chartTheme';
import styles from './PriceMap.module.css';

export interface MapMarker {
  marketId: number;
  marketName: string;
  city: string;
  latitude: number;
  longitude: number;
  level: PriceLevel;
  price: number;
  change4w: number | null;
  forecastPrice: number | null;
  forecastChangePct: number | null;
}

interface PriceMapProps {
  markers: MapMarker[];
  /** Weeks ahead of the forecast shown in the popups. */
  horizon: number;
}

// Mainland Colombia where the wholesale markets are; used when there is nothing to frame.
const COLOMBIA_BOUNDS = L.latLngBounds([2.2, -77.6], [11.6, -72.4]);

/** Frames the markets of the product, with some air around them, so they overlap less. */
function boundsOf(markers: MapMarker[]): L.LatLngBounds {
  if (markers.length === 0) return COLOMBIA_BOUNDS;
  const points = markers.map((marker) => L.latLng(marker.latitude, marker.longitude));
  return L.latLngBounds(points).pad(0.2);
}

// The symbol repeats what the color says, for people who do not tell green from red.
const SYMBOL_PATHS: Record<PriceLevel, string> = {
  cheaper: 'M12 5v14M6 13l6 6 6-6',
  similar: 'M6 9h12M6 15h12',
  expensive: 'M12 19V5M6 11l6-6 6 6',
};

function levelIcon(level: PriceLevel) {
  return L.divIcon({
    className: `${styles.marker} ${styles[level]}`,
    html:
      '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" ' +
      `stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="${SYMBOL_PATHS[level]}"/></svg>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -14],
  });
}

const ICONS: Record<PriceLevel, L.DivIcon> = {
  cheaper: levelIcon('cheaper'),
  similar: levelIcon('similar'),
  expensive: levelIcon('expensive'),
};

/** Map of the markets where the product is sold, colored by price level. */
export default function PriceMap({ markers, horizon }: PriceMapProps) {
  // Without internet the background tiles do not load. The markers still show where each market
  // is, and their names are shown all the time to make up for the missing map.
  const [tilesFailed, setTilesFailed] = useState(false);

  return (
    <div>
      {tilesFailed && (
        <p className={styles.notice} role="status">
          No se pudo cargar el mapa de fondo (revise su conexión a internet). Los puntos muestran la
          ubicación aproximada de cada plaza.
        </p>
      )}
      <MapContainer
        bounds={boundsOf(markers)}
        boundsOptions={{ maxZoom: 9 }}
        scrollWheelZoom={false}
        className={styles.map}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; Colaboradores de <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          eventHandlers={{ tileerror: () => setTilesFailed(true) }}
        />
        {markers.map((marker) => (
          <Marker
            // A permanent label cannot be switched on after the marker exists, so it is recreated.
            key={`${marker.marketId}-${tilesFailed}`}
            position={[marker.latitude, marker.longitude]}
            icon={ICONS[marker.level]}
            title={`${marker.city}: ${LEVEL_LABELS[marker.level].toLowerCase()}`}
            alt={`${marker.city}: ${LEVEL_LABELS[marker.level].toLowerCase()}`}
          >
            {tilesFailed && (
              <Tooltip permanent direction="right" offset={[14, 0]}>
                {marker.city}
              </Tooltip>
            )}
            <Popup>
              <div className={styles.popup}>
                <strong>{marker.marketName}</strong>
                <span>
                  <PriceTag value={marker.price} /> esta semana
                </span>
                <span className={styles.popupLevel}>{LEVEL_LABELS[marker.level]}</span>
                <span>
                  <ChangeBadge value={marker.change4w} /> frente a hace 4 semanas
                </span>
                {marker.forecastPrice !== null && (
                  <span>
                    <ChangeBadge value={marker.forecastChangePct} /> esperado en {horizon} semanas (
                    <PriceTag value={marker.forecastPrice} />)
                  </span>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
