import { Fragment } from 'react';
import type { Product } from '../../api/types';
import { ChangeBadge } from '../../components/ChangeBadge/ChangeBadge';
import table from '../../components/DataTable/DataTable.module.css';
import { PriceTag } from '../../components/PriceTag/PriceTag';
import { varietyLabel, type MarketGroup } from '../../lib/analysis';
import { LEVEL_LABELS } from '../../lib/chartTheme';

interface MarketsTableProps {
  groups: MarketGroup[];
  product: Product;
  horizon: number;
}

/** Markets of a product, cheapest first. Each comparable group (variety) has its own block. */
export function MarketsTable({ groups, product, horizon }: MarketsTableProps) {
  const severalGroups = groups.length > 1;
  return (
    <div className={table.wrapper}>
      <table className={table.table} style={{ minWidth: '44rem' }}>
        <caption className="visually-hidden">
          Precio de {product.canonical_name} por plaza, de la más barata a la más cara
        </caption>
        <thead>
          <tr>
            <th scope="col">Plaza</th>
            <th scope="col" className={table.left}>
              Ciudad
            </th>
            <th scope="col" className={table.left}>
              Variedad
            </th>
            <th scope="col">Último precio</th>
            <th scope="col">Frente a hace 4 semanas</th>
            <th scope="col">Frente a hace un año</th>
            <th scope="col">Pronóstico a {horizon} semanas</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => {
            const variety = varietyLabel(group.comparableGroup, product);
            return (
              <Fragment key={group.comparableGroup}>
                {severalGroups && (
                  <tr className={table.groupRow}>
                    <th colSpan={7} scope="colgroup">
                      Variedad: {variety}
                      <span className={table.secondary}>
                        Compare precios solo entre las plazas de este grupo.
                      </span>
                    </th>
                  </tr>
                )}
                {group.rows.map((row) => (
                  <tr key={row.marketId}>
                    <th scope="row">
                      {row.marketName}
                      <span className={table.secondary}>{LEVEL_LABELS[row.level]}</span>
                    </th>
                    <td className={table.left}>{row.city}</td>
                    <td className={table.left}>{variety}</td>
                    <td>
                      <PriceTag value={row.price} />
                    </td>
                    <td>
                      <ChangeBadge value={row.change4w} />
                    </td>
                    <td>
                      <ChangeBadge value={row.change52w} />
                    </td>
                    <td>
                      {row.forecastPrice === null ? (
                        'Sin pronóstico'
                      ) : (
                        <>
                          <PriceTag value={row.forecastPrice} />{' '}
                          <ChangeBadge value={row.forecastChangePct} />
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
