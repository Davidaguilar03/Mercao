import 'leaflet/dist/leaflet.css';

import L from 'leaflet';
import { useState } from 'react';
import { MapContainer, Marker, Popup, TileLayer, Tooltip, ZoomControl } from 'react-leaflet';
import { Link, useSearchParams } from 'react-router-dom';
import { ChangeBadge } from '../../components/ChangeBadge/ChangeBadge';
import { LevelMark } from '../../components/LevelMark/LevelMark';
import { levelMarkHtml } from '../../components/LevelMark/levelSymbols';
import { PriceTag } from '../../components/PriceTag/PriceTag';
import { marketDetailPath } from '../../hooks/urlSelection';
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
  /** Product shown on the map; the popups link to its detail in each market. */
  productId: number;
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

// The same mark as the legend and the table: an arrow or an equal sign on corn yellow, white or ink.
function levelIcon(level: PriceLevel) {
  return L.divIcon({
    className: styles.marker,
    html: levelMarkHtml(level),
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

/** Map of the markets where the product is sold, marked by price level. */
export default function PriceMap({ productId, markers, horizon }: PriceMapProps) {
  const [searchParams] = useSearchParams();
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
        zoomControl={false}
        className={styles.map}
      >
        {/* At the bottom, so the popups (which open upwards) never end up under the buttons. */}
        <ZoomControl position="bottomleft" zoomInTitle="Acercar" zoomOutTitle="Alejar" />
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
            {/* Narrow enough to fit inside the map on a 360 px phone. */}
            <Popup maxWidth={230}>
              <div className={styles.popup}>
                <strong>{marker.marketName}</strong>
                <span>
                  <PriceTag value={marker.price} /> esta semana
                </span>
                <span className={styles.popupLevel}>
                  <LevelMark level={marker.level} />
                  {LEVEL_LABELS[marker.level]}
                </span>
                <span>
                  <ChangeBadge value={marker.change4w} /> frente a hace 4 semanas
                </span>
                {marker.forecastPrice !== null && (
                  <span>
                    <ChangeBadge value={marker.forecastChangePct} /> esperado en {horizon} semanas (
                    <PriceTag value={marker.forecastPrice} />)
                  </span>
                )}
                <Link
                  className={styles.popupLink}
                  to={marketDetailPath(productId, marker.marketId, searchParams)}
                >
                  Ver detalle de esta plaza
                </Link>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
