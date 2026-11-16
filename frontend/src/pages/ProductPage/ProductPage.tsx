import { lazy, Suspense, useState } from 'react';
import {
  useForecasts,
  useLatestPrices,
  usePriceHistory,
  useSeasonality,
  useSupplyOrigins,
} from '../../api/hooks';
import type { MarketForecast, MarketLatestPrice, Product } from '../../api/types';
import { Card } from '../../components/Card/Card';
import { ChangeBadge } from '../../components/ChangeBadge/ChangeBadge';
import { PageHeader } from '../../components/layout/PageHeader';
import { MarketSelector } from '../../components/MarketSelector/MarketSelector';
import { PriceTag } from '../../components/PriceTag/PriceTag';
import { ProductSelector } from '../../components/ProductSelector/ProductSelector';
import { QueryBoundary } from '../../components/QueryBoundary/QueryBoundary';
import { departmentItems, municipalityItems } from '../../components/ShareBars/originItems';
import { ShareBars } from '../../components/ShareBars/ShareBars';
import { EmptyState } from '../../components/states/EmptyState';
import { LoadingState } from '../../components/states/LoadingState';
import { useMarketSelection, useProductSelection } from '../../hooks/urlSelection';
import { formatPesos, formatWeek, lowerFirst } from '../../lib/format';
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

/** Earlier than the first SIPSA bulletin, so the API returns the whole history. */
const HISTORY_START = '2000-01-01';
const RANGES: HistoryRange[] = ['1y', '3y', 'all'];

export function ProductPage() {
  const { product, productId, setProductId, productsQuery } = useProductSelection();
  const latestQuery = useLatestPrices(productId);
  const markets = latestQuery.data?.markets;
  const [marketId, setMarketId] = useMarketSelection(markets?.map((market) => market.market_id));
  const market = markets?.find((item) => item.market_id === marketId);

  return (
    <>
      <PageHeader
        title="Producto"
        description="La historia de un producto en una plaza: precios, temporadas, origen y pronóstico."
      />
      <div className={page.controls}>
        <ProductSelector value={productId} onChange={setProductId} />
        <MarketSelector markets={markets ?? []} value={marketId} onChange={setMarketId} />
      </div>
      {product ? (
        <QueryBoundary query={latestQuery} loadingMessage="Cargando los precios…">
          {() =>
            market ? (
              <ProductContent product={product} market={market} />
            ) : (
              <Card>
                <EmptyState title="No hay plazas con precios de este producto">
                  <p>
                    Ninguna plaza tiene precios suficientes de {lowerFirst(product.canonical_name)}{' '}
                    para mostrar su historia.
                  </p>
                </EmptyState>
              </Card>
            )
          }
        </QueryBoundary>
      ) : (
        !productsQuery.isError && <LoadingState />
      )}
    </>
  );
}

interface ProductContentProps {
  product: Product;
  market: MarketLatestPrice;
}

function ProductContent({ product, market }: ProductContentProps) {
  const productId = product.product_id;
  const marketId = market.market_id;
  const [range, setRange] = useState<HistoryRange>('3y');
  const historyQuery = usePriceHistory(productId, marketId, { from: HISTORY_START });
  const forecastsQuery = useForecasts(productId, marketId);
  const seasonalityQuery = useSeasonality(productId, marketId);
  const originsQuery = useSupplyOrigins(productId, marketId);
  const forecast = forecastsQuery.data?.markets[0];

  return (
    <div className={page.stack}>
      <KeyFigures market={market} forecast={forecast} />

      <Card
        title="Precio semana a semana"
        subtitle={`${product.canonical_name} en ${market.market_name}. Pesos por kilo.`}
      >
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

      <div className={page.grid}>
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
                    Suele estar más barato en <strong>{seasonality.cheapest_month}</strong> y más
                    caro en <strong>{seasonality.most_expensive_month}</strong>.
                  </p>
                  <p className={page.caption}>
                    100 es el precio promedio del año; 112 quiere decir 12 % por encima. Calculado
                    con los años {seasonality.years_used[0]} a{' '}
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

        <Card
          title="¿De dónde llega a esta plaza?"
          subtitle="Origen de la carga en las últimas 52 semanas con datos."
        >
          <QueryBoundary query={originsQuery} loadingMessage="Cargando el abastecimiento…">
            {(origins) =>
              origins.total_kg === 0 ? (
                <EmptyState title="Sin datos de abastecimiento para esta plaza">
                  <p>{origins.message}</p>
                  <p>
                    El DANE mide de dónde llega la carga solo en algunas plazas y para algunos
                    productos, y esta combinación no hace parte de esa medición. Los precios sí
                    están completos.
                  </p>
                </EmptyState>
              ) : (
                <>
                  <h3 className={page.subheading}>Departamentos</h3>
                  <ShareBars items={departmentItems(origins)} label="Origen por departamento" />
                  <h3 className={page.subheading}>Municipios que más aportan</h3>
                  <ShareBars items={municipalityItems(origins)} label="Origen por municipio" />
                </>
              )
            }
          </QueryBoundary>
        </Card>
      </div>
    </div>
  );
}

interface KeyFiguresProps {
  market: MarketLatestPrice;
  forecast: MarketForecast | undefined;
}

function KeyFigures({ market, forecast }: KeyFiguresProps) {
  const furthest = forecast?.forecasts[forecast.forecasts.length - 1];
  return (
    <dl className={page.figures}>
      <div className={page.figure}>
        <dt>Último precio</dt>
        <dd>
          <PriceTag value={market.mean_price} size="lg" />
        </dd>
        <span className={page.figureNote}>Semana del {formatWeek(market.week_start)}</span>
      </div>
      <div className={page.figure}>
        <dt>Frente a hace 4 semanas</dt>
        <dd>
          <ChangeBadge value={market.change_4w_pct} />
        </dd>
      </div>
      <div className={page.figure}>
        <dt>Frente a hace un año</dt>
        <dd>
          <ChangeBadge value={market.change_52w_pct} />
        </dd>
      </div>
      <div className={page.figure}>
        <dt>Pronóstico a {furthest?.horizon ?? 4} semanas</dt>
        <dd>{furthest ? <PriceTag value={furthest.predicted_price} size="lg" /> : 'Sin dato'}</dd>
        {furthest && (
          <span className={page.figureNote}>
            Semana del {formatWeek(furthest.target_week_start)}. Rango probable:{' '}
            {formatPesos(furthest.lower_price)} a {formatPesos(furthest.upper_price)}
          </span>
        )}
      </div>
    </dl>
  );
}
