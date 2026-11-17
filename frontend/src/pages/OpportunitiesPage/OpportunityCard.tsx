import { ArrowLeftRight, Gauge, Route } from 'lucide-react';
import type {
  MarketForecast,
  Product,
  RecommendationGroup,
  RecommendationSide,
} from '../../api/types';
import { Card } from '../../components/Card/Card';
import { ChangeBadge } from '../../components/ChangeBadge/ChangeBadge';
import table from '../../components/DataTable/DataTable.module.css';
import { Notice } from '../../components/Notice/Notice';
import { PriceTag } from '../../components/PriceTag/PriceTag';
import { explainConfidence, varietyLabel } from '../../lib/analysis';
import {
  formatInteger,
  formatPercent,
  formatPesos,
  formatPricePerKg,
  formatWeek,
} from '../../lib/format';
import page from '../page.module.css';
import { IntervalComparison } from './IntervalComparison';
import styles from './OpportunityCard.module.css';

interface OpportunityCardProps {
  group: RecommendationGroup;
  product: Product;
  horizon: number;
  /** Forecasts of every market of the product, for the ranking; undefined while they load. */
  forecasts: MarketForecast[] | undefined;
}

interface SideProps {
  title: string;
  side: RecommendationSide;
  tone: 'buy' | 'sell';
}

function Side({ title, side, tone }: SideProps) {
  return (
    <div className={`${styles.tile} ${styles.side} ${styles[tone]}`}>
      <span className={styles.label}>{title}</span>
      {/* The city on one line, with the full market name under it, so long names never wrap. */}
      <span className={styles.group}>
        <strong className={styles.sideMarket} title={side.market_name}>
          {side.city}
        </strong>
        <span className={styles.sideMarketFull} title={side.market_name}>
          {side.market_name}
        </span>
      </span>
      {/* Expected price on the left and, on the same baseline, its change against the latest price. */}
      <span className={styles.group}>
        <span className={styles.priceRow}>
          <span className={styles.value} title="Precio esperado">
            <span className="visually-hidden">Precio esperado: </span>
            <PriceTag value={side.predicted_price} size="lg" />
          </span>
          <ChangeBadge value={side.expected_change_percent} size="lg" />
        </span>
        {side.latest_price !== null && (
          <span className={styles.detail}>
            frente al último precio ({formatPricePerKg(side.latest_price)})
          </span>
        )}
      </span>
    </div>
  );
}

/** Where to buy and where to sell within one comparable group, with the ranking of its markets. */
export function OpportunityCard({ group, product, horizon, forecasts }: OpportunityCardProps) {
  const { buy, sell } = group;
  const ranking = (forecasts ?? [])
    .filter((market) => market.comparable_group === group.comparable_group)
    .flatMap((market) => {
      const forecast = market.forecasts.find((item) => item.horizon === horizon);
      return forecast ? [{ market, forecast }] : [];
    })
    .sort((a, b) => a.forecast.predicted_price - b.forecast.predicted_price);

  return (
    <Card
      title={`Variedad: ${varietyLabel(group.comparable_group, product)}`}
      subtitle={`Pronóstico para la semana del ${formatWeek(buy.target_week_start)}. Se compararon ${group.markets_compared} plazas.`}
    >
      {/* Desktop: the two markets on the left; difference and distance stacked on the right. */}
      <div className={styles.overview}>
        <div className={styles.sides}>
          <Side title="Comprar en" side={buy} tone="buy" />
          <Side title="Vender en" side={sell} tone="sell" />
        </div>
        <div className={styles.facts}>
          <dl className={`${styles.tile} ${styles.fact}`}>
            <dt className={styles.label}>
              <ArrowLeftRight size={16} strokeWidth={1.75} aria-hidden="true" />
              Diferencia esperada
            </dt>
            <dd className={styles.factRow}>
              <span className={styles.value}>
                <PriceTag value={group.difference_per_kg} size="lg" />
              </span>
              <span className={styles.detail}>
                {formatPercent(group.difference_pct)} sobre el precio de compra
              </span>
            </dd>
          </dl>
          <dl className={`${styles.tile} ${styles.fact}`}>
            <dt className={styles.label}>
              <Route size={16} strokeWidth={1.75} aria-hidden="true" />
              Distancia aproximada en línea recta
            </dt>
            <dd className={styles.factRow}>
              <span className={`${styles.value} ${styles.distance} tabular`}>
                {formatInteger(group.distance_km)}
                <span className={styles.unit}>{' km'}</span>
              </span>
              <span className={styles.detail}>
                entre {buy.city} y {sell.city}
              </span>
            </dd>
          </dl>
        </div>
      </div>

      <Notice
        icon={Gauge}
        size="compact"
        tone={group.confidence === 'alta' ? 'brand' : 'info'}
        title={`Confianza ${group.confidence}`}
        className={styles.confidence}
      >
        <p>{explainConfidence(group.confidence, buy.city, sell.city)}</p>
      </Notice>

      {/* Desktop: the two ranges on the left and the list of markets on the right. */}
      <div className={styles.details}>
        <div className={styles.ranges}>
          <h3 className={page.subheading}>Rango probable de precio en cada plaza</h3>
          <IntervalComparison buy={buy} sell={sell} />
          <p className={`${page.caption} ${page.captionAfter}`}>
            El círculo indica el precio esperado; la barra, el rango en el que se espera el precio
            en 8 de cada 10 casos.
          </p>
        </div>
        <div>
          <h3 className={page.subheading}>Todas las plazas, de la más barata a la más cara</h3>
          {forecasts === undefined ? (
            <p className={page.caption}>Cargando las demás plazas…</p>
          ) : (
            <div className={table.wrapper}>
              <table className={table.table}>
                <caption className="visually-hidden">
                  Pronóstico por plaza a {horizon} semanas, de la más barata a la más cara
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Plaza</th>
                    <th scope="col">Precio esperado</th>
                    <th scope="col" className={table.hideNarrow}>
                      Rango probable
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {ranking.map(({ market, forecast }) => (
                    <tr key={market.market_id}>
                      <th scope="row">
                        {market.market_name}
                        {market.market_id === buy.market_id && (
                          <span className={`${table.tag} ${table.tagBuy}`}>Comprar</span>
                        )}
                        {market.market_id === sell.market_id && (
                          <span className={`${table.tag} ${table.tagSell}`}>Vender</span>
                        )}
                      </th>
                      <td>
                        <PriceTag value={forecast.predicted_price} />
                        {/* On phones the range goes under the price instead of in its own column. */}
                        <span className={`${table.secondary} ${table.onlyNarrow}`}>
                          {formatPesos(forecast.lower_price)} a {formatPesos(forecast.upper_price)}
                        </span>
                      </td>
                      <td className={table.hideNarrow}>
                        {formatPesos(forecast.lower_price)} a {formatPesos(forecast.upper_price)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
