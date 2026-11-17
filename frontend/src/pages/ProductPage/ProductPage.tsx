import { lazy, Suspense, useState } from 'react';
import {
  useForecasts,
  useLatestPrices,
  usePriceHistory,
  useSeasonality,
  useSupplyOrigins,
} from '../../api/hooks';
import { FULL_HISTORY_START } from '../../api/prices';
import type { MarketForecast, MarketLatestPrice, PricePoint, Product } from '../../api/types';
import { Card } from '../../components/Card/Card';
import { KpiCard, KpiChangeCard, KpiGrid } from '../../components/KpiCard/KpiCard';
import { PageHeader } from '../../components/layout/PageHeader';
import { MarketSelector } from '../../components/MarketSelector/MarketSelector';
import { ProductSelector } from '../../components/ProductSelector/ProductSelector';
import { QueryBoundary } from '../../components/QueryBoundary/QueryBoundary';
import { RangeBar } from '../../components/RangeBar/RangeBar';
import { departmentItems, municipalityItems } from '../../components/ShareBars/originItems';
import { ShareBars, type ShareItem } from '../../components/ShareBars/ShareBars';
import { EmptyState } from '../../components/states/EmptyState';
import { LoadingState } from '../../components/states/LoadingState';
import { useMarketSelection, useProductSelection } from '../../hooks/urlSelection';
import { addDays, formatPesos, formatPricePerKg, formatWeek, lowerFirst } from '../../lib/format';
import page from '../page.module.css';
import {
  buildChartPoints,
  describeSeries,
  filterByRange,
  RANGE_LABELS,
  type HistoryRange,
} from './priceSeries';
import styles from './ProductPage.module.css';

// The chart library loads only when a chart is shown.
const PriceHistoryChart = lazy(() => import('./PriceHistoryChart'));
const SeasonalityChart = lazy(() => import('./SeasonalityChart'));
const RANGES: HistoryRange[] = ['1y', '3y', 'all'];

export function ProductPage() {
  const { product, productId, setProductId, productsQuery } = useProductSelection();
  const latestQuery = useLatestPrices(productId);
  const markets = latestQuery.data?.markets;
  const [marketId, setMarketId] = useMarketSelection(markets?.map((market) => market.market_id));
  const market = markets?.find((item) => item.market_id === marketId);

  // Desktop: selectors, key figures and price chart on the left; seasons and origins on the right.
  return (
    <div className={`${page.columns} ${page.wideFirst} ${page.alignBottoms}`}>
      <div className={page.stack}>
        <PageHeader
          title="Producto"
          description="La historia de un producto en una plaza: precios, temporadas, origen y pronóstico."
        >
          <ProductSelector value={productId} onChange={setProductId} />
          <MarketSelector markets={markets ?? []} value={marketId} onChange={setMarketId} />
        </PageHeader>
        {product ? (
          <QueryBoundary query={latestQuery} loadingMessage="Cargando los precios…">
            {() =>
              market ? (
                <ProductPrices product={product} market={market} />
              ) : (
                <Card>
                  <EmptyState title="No hay plazas con precios de este producto">
                    <p>
                      Ninguna plaza tiene precios suficientes de{' '}
                      {lowerFirst(product.canonical_name)} para mostrar su historia.
                    </p>
                  </EmptyState>
                </Card>
              )
            }
          </QueryBoundary>
        ) : (
          !productsQuery.isError && <LoadingState />
        )}
      </div>
      {product && market && (
        <div className={page.stack}>
          <ProductContext product={product} market={market} />
        </div>
      )}
    </div>
  );
}

interface ProductContentProps {
  product: Product;
  market: MarketLatestPrice;
}

/** Key figures and weekly price chart of the product in the market. */
function ProductPrices({ product, market }: ProductContentProps) {
  const productId = product.product_id;
  const marketId = market.market_id;
  const [range, setRange] = useState<HistoryRange>('3y');
  const historyQuery = usePriceHistory(productId, marketId, { from: FULL_HISTORY_START });
  const forecastsQuery = useForecasts(productId, marketId);
  const forecast = forecastsQuery.data?.markets[0];

  return (
    <>
      <KeyFigures market={market} forecast={forecast} series={historyQuery.data?.series} />

      <Card
        title="Precio semana a semana"
        subtitle={`${product.canonical_name} en ${market.market_name}. Pesos por kilo.`}
        className={styles.chartCard}
        actions={
          <div className={styles.ranges} role="group" aria-label="Periodo de la gráfica">
            {RANGES.map((option) => (
              <button
                key={option}
                type="button"
                className={styles.rangeButton}
                aria-pressed={range === option}
                onClick={() => setRange(option)}
              >
                {RANGE_LABELS[option]}
              </button>
            ))}
          </div>
        }
      >
        <QueryBoundary query={historyQuery} loadingMessage="Cargando la historia de precios…">
          {(history) => {
            const series = filterByRange(history.series, range);
            if (series.length === 0) {
              return (
                <EmptyState title="Sin historia de precios">
                  <p>No hay precios semanales de este producto en esta plaza.</p>
                </EmptyState>
              );
            }
            return (
              <>
                <ul className={styles.legend}>
                  <li>
                    <span className={`${styles.swatch} ${styles.line}`} aria-hidden="true" />
                    Precio promedio de la semana
                  </li>
                  <li>
                    <span className={`${styles.swatch} ${styles.band}`} aria-hidden="true" />
                    Entre el mínimo y el máximo de la semana
                  </li>
                  <li>
                    <span className={`${styles.swatch} ${styles.dashed}`} aria-hidden="true" />
                    Pronóstico
                  </li>
                  <li>
                    <span
                      className={`${styles.swatch} ${styles.forecastBand}`}
                      aria-hidden="true"
                    />
                    Rango probable del pronóstico (8 de cada 10 veces)
                  </li>
                </ul>
                <div className={styles.priceChart}>
                  <Suspense fallback={null}>
                    <PriceHistoryChart points={buildChartPoints(series, forecast)} range={range} />
                  </Suspense>
                </div>
                <p className={`${page.caption} ${page.captionAfter}`}>
                  {describeSeries(series, forecast)}
                </p>
              </>
            );
          }}
        </QueryBoundary>
      </Card>
    </>
  );
}

/** Seasons and origins of the product in the market. */
function ProductContext({ product, market }: ProductContentProps) {
  const seasonalityQuery = useSeasonality(product.product_id, market.market_id);
  const originsQuery = useSupplyOrigins(product.product_id, market.market_id);
  const origins = originsQuery.data;

  return (
    <>
      <Card title="Temporadas" subtitle="Qué tan caro o barato suele estar en cada mes.">
        <QueryBoundary query={seasonalityQuery} loadingMessage="Cargando las temporadas…">
          {(seasonality) =>
            seasonality.months.length === 0 ? (
              <EmptyState title="Sin datos de temporada">
                <p>
                  {seasonality.message ??
                    'Hace falta al menos un año completo de precios para calcular las temporadas.'}
                </p>
              </EmptyState>
            ) : (
              <>
                <p>
                  Suele estar más barato en <strong>{seasonality.cheapest_month}</strong> y más caro
                  en <strong>{seasonality.most_expensive_month}</strong>.
                </p>
                <p className={page.caption}>
                  100 es el precio promedio del año; 112 quiere decir 12 % por encima. Calculado con
                  los años {seasonality.years_used[0]} a{' '}
                  {seasonality.years_used[seasonality.years_used.length - 1]}.
                </p>
                <div className={styles.seasonChart}>
                  <Suspense fallback={null}>
                    <SeasonalityChart seasonality={seasonality} />
                  </Suspense>
                </div>
                <ul className="visually-hidden">
                  {seasonality.months.map((month) => (
                    <li key={month.month}>
                      {month.month_name}: índice {Math.round(month.index)}
                    </li>
                  ))}
                </ul>
              </>
            )
          }
        </QueryBoundary>
      </Card>
      {origins && origins.total_kg > 0 && (
        <Card
          title="Departamentos de origen"
          subtitle={`De dónde llegó la carga a ${market.city} en las últimas 52 semanas con datos.`}
        >
          <ShareBars items={departmentItems(origins)} label="Origen por departamento" />
        </Card>
      )}

      {origins && origins.total_kg > 0 ? (
        <Municipalities
          // Each product and market starts with the short list again.
          key={`${product.product_id}-${market.market_id}`}
          items={municipalityItems(origins)}
          city={market.city}
        />
      ) : (
        <Card
          title="¿De dónde llega a esta plaza?"
          subtitle="Origen de la carga en las últimas 52 semanas con datos."
        >
          <QueryBoundary query={originsQuery} loadingMessage="Cargando el abastecimiento…">
            {(emptyOrigins) => (
              <EmptyState title="Sin datos de abastecimiento para esta plaza">
                <p>{emptyOrigins.message}</p>
                <p>
                  El DANE mide de dónde llega la carga solo en algunas plazas y para algunos
                  productos, y esta combinación no hace parte de esa medición. Los precios sí están
                  completos.
                </p>
              </EmptyState>
            )}
          </QueryBoundary>
        </Card>
      )}
    </>
  );
}

/** How many municipalities are shown before "Ver más". */
const MUNICIPALITIES_SHORT = 6;

/** The municipalities that send the most: the first six, and the rest on demand. */
function Municipalities({ items, city }: { items: ShareItem[]; city: string }) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? items : items.slice(0, MUNICIPALITIES_SHORT);
  return (
    <Card
      title="Municipios que más aportan"
      subtitle={`Los ${shown.length} municipios que más carga enviaron a ${city}.`}
    >
      <ShareBars items={shown} label="Origen por municipio" />
      {items.length > MUNICIPALITIES_SHORT && (
        <button
          type="button"
          className={styles.moreButton}
          aria-expanded={expanded}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? 'Ver menos' : 'Ver más'}
        </button>
      )}
    </Card>
  );
}

interface KeyFiguresProps {
  market: MarketLatestPrice;
  forecast: MarketForecast | undefined;
  /** Weekly prices of the pair, to show what the price was 4 and 52 weeks ago. */
  series: PricePoint[] | undefined;
}

function price(value: number) {
  return (
    <>
      {formatPesos(value)} <small>/kg</small>
    </>
  );
}

function KeyFigures({ market, forecast, series }: KeyFiguresProps) {
  const furthest = forecast?.forecasts[forecast.forecasts.length - 1];
  const reference = (weeks: number) => {
    const weekStart = addDays(market.week_start, -7 * weeks);
    const past = series?.find((point) => point.week_start === weekStart)?.mean_price;
    return past === undefined ? null : <>Estaba en {formatPricePerKg(past)}</>;
  };

  return (
    <KpiGrid label="Cifras clave" layout="inline">
      <KpiCard label="Último precio" value={price(market.mean_price)}>
        Semana del {formatWeek(market.week_start)}
      </KpiCard>
      <KpiChangeCard
        label="Frente a hace 4 semanas"
        value={market.change_4w_pct}
        explanations={{
          up: 'Hoy está más caro',
          down: 'Hoy está más barato',
          flat: 'Hoy está igual',
        }}
        missing="No hay precio de hace 4 semanas para comparar."
      >
        {reference(4)}
      </KpiChangeCard>
      <KpiChangeCard
        label="Frente a hace un año"
        value={market.change_52w_pct}
        explanations={{
          up: 'Hoy está más caro',
          down: 'Hoy está más barato',
          flat: 'Hoy está igual',
        }}
        missing="No hay precio de hace un año para comparar."
      >
        {reference(52)}
      </KpiChangeCard>
      {furthest ? (
        <KpiCard
          label={`Pronóstico a ${furthest.horizon} semanas`}
          value={price(furthest.predicted_price)}
          title={`Para la semana del ${formatWeek(furthest.target_week_start)}`}
        >
          Rango probable
          <RangeBar
            lower={furthest.lower_price}
            upper={furthest.upper_price}
            value={furthest.predicted_price}
          />
        </KpiCard>
      ) : (
        <KpiCard label="Pronóstico a 4 semanas" value="Sin dato">
          Esta plaza no tiene pronóstico para este producto.
        </KpiCard>
      )}
    </KpiGrid>
  );
}
