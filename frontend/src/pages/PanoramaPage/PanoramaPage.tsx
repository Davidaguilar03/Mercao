import { lazy, Suspense } from 'react';
import { useForecasts, useLatestPrices, useMarkets, useSupplyOrigins } from '../../api/hooks';
import type { Product } from '../../api/types';
import { Card } from '../../components/Card/Card';
import { PageHeader } from '../../components/layout/PageHeader';
import { ProductSelector } from '../../components/ProductSelector/ProductSelector';
import { QueryBoundary } from '../../components/QueryBoundary/QueryBoundary';
import { departmentItems } from '../../components/ShareBars/originItems';
import { ShareBars } from '../../components/ShareBars/ShareBars';
import { EmptyState } from '../../components/states/EmptyState';
import { LoadingState } from '../../components/states/LoadingState';
import { useProductSelection } from '../../hooks/urlSelection';
import { buildMarketGroups, buildSummary } from '../../lib/analysis';
import { addDays, formatLongDate, formatTons, formatWeek, lowerFirst } from '../../lib/format';
import page from '../page.module.css';
import { MapLegend } from './MapLegend';
import { MarketsTable } from './MarketsTable';
import type { MapMarker } from './PriceMap';

// Leaflet is heavy, so the map loads apart from the rest of the page.
const PriceMap = lazy(() => import('./PriceMap'));

/** Forecast shown next to the latest prices: two weeks ahead. */
const PANORAMA_HORIZON = 2;

export function PanoramaPage() {
  const { product, productId, setProductId, productsQuery } = useProductSelection();

  return (
    <>
      <PageHeader
        title="Panorama"
        description="Cómo está un producto esta semana en las principales plazas mayoristas del país."
      />
      <div className={page.controls}>
        <ProductSelector value={productId} onChange={setProductId} />
      </div>
      {product ? <PanoramaContent product={product} /> : !productsQuery.isError && <LoadingState />}
    </>
  );
}

function PanoramaContent({ product }: { product: Product }) {
  const latestQuery = useLatestPrices(product.product_id);
  const forecastsQuery = useForecasts(product.product_id);
  const marketsQuery = useMarkets();
  const originsQuery = useSupplyOrigins(product.product_id);

  return (
    <div className={page.stack}>
      <QueryBoundary query={latestQuery} loadingMessage="Cargando los precios de la semana…">
        {(latest) => {
          if (latest.markets.length === 0) {
            return (
              <Card>
                <EmptyState title="No hay precios recientes de este producto">
                  <p>
                    Ninguna de las plazas tiene precios suficientes de{' '}
                    {lowerFirst(product.canonical_name)} para mostrarlos.
                  </p>
                </EmptyState>
              </Card>
            );
          }
          // The forecasts and the coordinates add detail; the prices are shown even without them.
          const groups = buildMarketGroups(
            latest.markets,
            forecastsQuery.data?.markets ?? [],
            PANORAMA_HORIZON,
          );
          const coordinates = new Map(
            (marketsQuery.data ?? []).map((market) => [market.market_id, market]),
          );
          const markers = groups
            .flatMap((group) => group.rows)
            .flatMap((row): MapMarker[] => {
              const market = coordinates.get(row.marketId);
              return market
                ? [{ ...row, latitude: market.latitude, longitude: market.longitude }]
                : [];
            });
          const summary = buildSummary(product.canonical_name, groups);
          const weekStart = latest.markets[0].week_start;

          return (
            <>
              {summary && <p className={page.summary}>{summary}</p>}
              <Card
                title="Precios en el mapa"
                subtitle={`Semana del ${formatWeek(weekStart)}. Toque una plaza para ver su precio.`}
              >
                <Suspense fallback={<LoadingState message="Cargando el mapa…" />}>
                  {/* The map frames the markets once, so each product gets its own map. */}
                  <PriceMap key={product.product_id} markers={markers} horizon={PANORAMA_HORIZON} />
                </Suspense>
                <MapLegend />
              </Card>
              <Card
                title="Precios por plaza"
                subtitle={`Precio mayorista promedio por kilo en la semana del ${formatWeek(weekStart)}, de la plaza más barata a la más cara.`}
              >
                <MarketsTable groups={groups} product={product} horizon={PANORAMA_HORIZON} />
                {forecastsQuery.isError && (
                  <p className={`${page.caption} ${page.captionAfter}`} role="alert">
                    No pudimos cargar los pronósticos; la tabla muestra solo los precios.
                  </p>
                )}
              </Card>
            </>
          );
        }}
      </QueryBoundary>

      <Card
        title="¿De dónde viene?"
        subtitle="Departamentos que más abastecieron a las plazas en las últimas 52 semanas con datos."
      >
        <QueryBoundary query={originsQuery} loadingMessage="Cargando el abastecimiento…">
          {(origins) =>
            origins.total_kg === 0 ? (
              <EmptyState title="Sin datos de abastecimiento">
                <p>{origins.message}</p>
                <p>El DANE no registra el abastecimiento de todos los productos.</p>
              </EmptyState>
            ) : (
              <>
                <ShareBars
                  items={departmentItems(origins)}
                  label={`Origen de ${product.canonical_name} por departamento`}
                />
                <p className={`${page.caption} ${page.captionAfter}`}>
                  {formatTons(origins.total_kg)} (toneladas) entre todas las plazas
                  {origins.first_week_start && origins.last_week_start && (
                    <>
                      , entre el {formatLongDate(origins.first_week_start)} y el{' '}
                      {formatLongDate(addDays(origins.last_week_start, 6))}
                    </>
                  )}
                  .{' '}
                  {origins.imported_kg > 0
                    ? 'Una parte llega importada de otros países.'
                    : 'No se registró producto importado.'}
                </p>
              </>
            )
          }
        </QueryBoundary>
      </Card>
    </div>
  );
}
