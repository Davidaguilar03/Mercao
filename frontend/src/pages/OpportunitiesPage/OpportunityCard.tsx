import type {
  MarketForecast,
  Product,
  RecommendationGroup,
  RecommendationSide,
} from '../../api/types';
import { Card } from '../../components/Card/Card';
import table from '../../components/DataTable/DataTable.module.css';
import { PriceTag } from '../../components/PriceTag/PriceTag';
import { explainConfidence, varietyLabel } from '../../lib/analysis';
import { formatPercent, formatPesos, formatWeek } from '../../lib/format';
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

function Side({ title, side }: { title: string; side: RecommendationSide }) {
  return (
    <div className={styles.side}>
      <span className={styles.sideTitle}>{title}</span>
      <strong className={styles.sideMarket}>{side.market_name}</strong>
      <PriceTag value={side.predicted_price} size="lg" />
      <span className={page.caption}>precio esperado</span>
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
      <div className={styles.sides}>
        <Side title="Comprar en" side={buy} />
        <Side title="Vender en" side={sell} />
      </div>

      <p className={styles.difference}>
        Diferencia esperada:{' '}
        <strong className="tabular">
          {formatPesos(group.difference_per_kg)} por kilo ({formatPercent(group.difference_pct)})
        </strong>
      </p>

      <div className={`${styles.confidence} ${styles[group.confidence]}`}>
        <strong>Confianza {group.confidence}</strong>
        <p>{explainConfidence(group.confidence, buy.city, sell.city)}</p>
      </div>

      <h3 className={page.subheading}>Rango probable de precio en cada plaza</h3>
      <IntervalComparison buy={buy} sell={sell} />

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
                <th scope="col">Rango probable</th>
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
                  </td>
                  <td>
                    {formatPesos(forecast.lower_price)} a {formatPesos(forecast.upper_price)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
