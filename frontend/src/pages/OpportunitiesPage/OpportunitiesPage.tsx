import { Info } from 'lucide-react';
import { useForecasts, useRecommendations } from '../../api/hooks';
import type { Horizon, Product } from '../../api/types';
import { Card } from '../../components/Card/Card';
import { HorizonSelector } from '../../components/HorizonSelector/HorizonSelector';
import { PageHeader } from '../../components/layout/PageHeader';
import { ProductSelector } from '../../components/ProductSelector/ProductSelector';
import { QueryBoundary } from '../../components/QueryBoundary/QueryBoundary';
import { EmptyState } from '../../components/states/EmptyState';
import { LoadingState } from '../../components/states/LoadingState';
import { useHorizonSelection, useProductSelection } from '../../hooks/urlSelection';
import page from '../page.module.css';
import styles from './OpportunitiesPage.module.css';
import { OpportunityCard } from './OpportunityCard';

export function OpportunitiesPage() {
  const { product, productId, setProductId, productsQuery } = useProductSelection();
  const [horizon, setHorizon] = useHorizonSelection();

  return (
    <>
      <PageHeader
        title="Oportunidades"
        description="Dónde convendría comprar y dónde vender un producto en las próximas semanas."
      />
      <div className={page.controls}>
        <ProductSelector value={productId} onChange={setProductId} />
        <HorizonSelector value={horizon} onChange={setHorizon} />
      </div>

      {/* Always visible, whatever the data says. */}
      <p className={styles.notice} role="note">
        <Info size={20} aria-hidden="true" className={styles.noticeIcon} />
        <span>
          <strong>Tenga en cuenta:</strong> las diferencias no incluyen transporte, almacenamiento
          ni intermediación. Los precios son pronósticos del precio mayorista promedio: son
          estimaciones, no precios garantizados.
        </span>
      </p>

      {product ? (
        <OpportunitiesContent product={product} horizon={horizon} />
      ) : (
        !productsQuery.isError && <LoadingState />
      )}
    </>
  );
}

function OpportunitiesContent({ product, horizon }: { product: Product; horizon: Horizon }) {
  const recommendationsQuery = useRecommendations(product.product_id, horizon);
  const forecastsQuery = useForecasts(product.product_id);

  return (
    <QueryBoundary query={recommendationsQuery} loadingMessage="Buscando oportunidades…">
      {(recommendations) =>
        recommendations.groups.length === 0 ? (
          <Card>
            <EmptyState title="No hay plazas para comparar">
              <p>
                {recommendations.message ??
                  'Este producto no tiene pronóstico en dos o más plazas que vendan la misma variedad.'}
              </p>
              <p>
                Para recomendar dónde comprar y dónde vender se necesitan al menos dos plazas con la
                misma variedad.
              </p>
            </EmptyState>
          </Card>
        ) : (
          <div className={page.stack}>
            {recommendations.groups.map((group) => (
              <OpportunityCard
                key={group.comparable_group}
                group={group}
                product={product}
                horizon={horizon}
                forecasts={forecastsQuery.data?.markets}
              />
            ))}
          </div>
        )
      }
    </QueryBoundary>
  );
}
