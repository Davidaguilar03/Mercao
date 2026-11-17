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

  // Desktop: title, summary and map on the left; the table and the origins on the right.
  return (
    <div className={`${page.columns} ${page.narrowFirst}`}>
      <div className={page.stack}>
        <PageHeader
          title="Panorama"
          description="Cómo está un producto esta semana en las principales plazas mayoristas del país."
        >
          <ProductSelector value={productId} onChange={setProductId} />
        </PageHeader>
        {product ? <PricesOnMap product={product} /> : !productsQuery.isError && <LoadingState />}
      </div>
      {product && (
        <div className={page.stack}>
          <PricesAndOrigins product={product} />
        </div>
      )}
    </div>
  );
}

/** Latest prices of the product with their forecasts, grouped by variety. Both columns use it. */
function useMarketGroups(product: Product) {
  const latestQuery = useLatestPrices(product.product_id);
  const forecastsQuery = useForecasts(product.product_id);
  // The forecasts add detail; the prices are shown even without them.
  const groups = buildMarketGroups(
    latestQuery.data?.markets ?? [],
    forecastsQuery.data?.markets ?? [],
    PANORAMA_HORIZON,
  );
  return { latestQuery, forecastsQuery, groups };
}

/** Summary sentence and map of the week. */
function PricesOnMap({ product }: { product: Product }) {
  const { latestQuery, groups } = useMarketGroups(product);
  const marketsQuery = useMarkets();

  return (
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

        return (
          <>
            {summary && <p className={page.summary}>{summary}</p>}
            <Card
              title="Precios en el mapa"
              subtitle={`Semana del ${formatWeek(latest.markets[0].week_start)}. Toque una plaza para ver su precio.`}
            >
              <Suspense fallback={<LoadingState message="Cargando el mapa…" />}>
                {/* The map frames the markets once, so each product gets its own map. */}
                <PriceMap
                  key={product.product_id}
                  productId={product.product_id}
                  markers={markers}
                  horizon={PANORAMA_HORIZON}
                />
              </Suspense>
              <MapLegend />
            </Card>
          </>
        );
      }}
    </QueryBoundary>
  );
}

/** Table of markets and origins of the product. */
function PricesAndOrigins({ product }: { product: Product }) {
  const { latestQuery, forecastsQuery, groups } = useMarketGroups(product);
  const originsQuery = useSupplyOrigins(product.product_id);
  const weekStart = latestQuery.data?.markets[0]?.week_start;

  return (
    <>
      {weekStart && (
        <Card
          title="Precios por plaza"
          subtitle={`Precio mayorista promedio por kilo en la semana del ${formatWeek(weekStart)}, de la plaza más barata a la más cara.`}
        >
          <MarketsTable groups={groups} product={product} horizon={PANORAMA_HORIZON} />
          <p className={`${page.caption} ${page.captionAfter}`}>
            El ícono junto a cada plaza compara su precio con el de las demás plazas de la misma
            variedad; no indica si el precio subió o bajó.
          </p>
          {forecastsQuery.isError && (
            <p className={`${page.caption} ${page.captionAfter}`} role="alert">
              No pudimos cargar los pronósticos; la tabla muestra solo los precios.
            </p>
          )}
        </Card>
      )}

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
    </>
  );
}
