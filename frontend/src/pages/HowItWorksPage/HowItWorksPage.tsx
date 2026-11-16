import { lazy, Suspense } from 'react';
import { useModelSummary } from '../../api/hooks';
import type { ModelSummary } from '../../api/types';
import { Card } from '../../components/Card/Card';
import { PageHeader } from '../../components/layout/PageHeader';
import { PriceTag } from '../../components/PriceTag/PriceTag';
import { ErrorState } from '../../components/states/ErrorState';
import { LoadingState } from '../../components/states/LoadingState';
import { formatLongDate, formatPercent } from '../../lib/format';
import styles from './HowItWorksPage.module.css';

// The chart library is heavy, so it loads only when a chart is shown.
const ErrorByHorizonChart = lazy(() => import('./ErrorByHorizonChart'));

const weeksLabel = (horizon: number) => (horizon === 1 ? '1 semana' : `${horizon} semanas`);

export function HowItWorksPage() {
  const summary = useModelSummary();

  return (
    <>
      <PageHeader
        title="Cómo funciona"
        description="De dónde salen los precios que ve en Mercao, cómo se calculan los pronósticos y qué tanto se puede confiar en ellos."
      />

      <div className={styles.grid}>
        <Card title="De dónde vienen los datos">
          <div className={styles.prose}>
            <p>
              Todos los precios vienen del Sistema de Información de Precios y Abastecimiento del
              Sector Agropecuario (SIPSA) del DANE, la entidad oficial de estadísticas de Colombia.
            </p>
            <p>
              El DANE visita las centrales mayoristas del país y registra a cuánto se vende cada
              producto y cuánta carga entra desde cada municipio. Mercao toma esos boletines y los
              organiza; no cambia los precios ni agrega datos propios.
            </p>
          </div>
        </Card>

        <Card title="Cada cuánto se actualiza">
          <div className={styles.prose}>
            <p>
              El DANE publica los precios mayoristas cada semana. Por eso en Mercao todo se mide por
              semanas, de lunes a domingo.
            </p>
            <p>
              Cuando se carga un boletín nuevo se recalculan los pronósticos. Al pie de cada página
              aparece la última semana con datos. La información de abastecimiento (de dónde llega
              la carga) se publica con algunos días de retraso frente a los precios.
            </p>
          </div>
        </Card>
      </div>

      {summary.isPending && <LoadingState message="Cargando los resultados del modelo…" />}
      {summary.isError && (
        <ErrorState message={summary.error.message} onRetry={() => summary.refetch()} />
      )}
      {summary.data && <ModelSections summary={summary.data} />}

      <Card title="Lo que debe tener en cuenta" className={styles.section}>
        <ul className={styles.limitations}>
          <li>
            <strong>Es una estimación.</strong> El pronóstico dice hacia dónde podría ir el precio
            según lo que ha pasado antes. Un paro, una helada o un derrumbe pueden cambiarlo todo de
            una semana a otra.
          </li>
          <li>
            <strong>La mejora es modesta.</strong> El modelo se equivoca un poco menos que suponer
            que el precio no cambia, pero no mucho menos. Úselo como una señal más, no como la
            única.
          </li>
          <li>
            <strong>No incluye el transporte.</strong> Las diferencias de precio entre plazas no
            descuentan fletes, cargue, mermas ni intermediación. Una diferencia que se ve buena
            puede no alcanzar para cubrir el viaje.
          </li>
          <li>
            <strong>Son precios mayoristas promedio.</strong> El precio que usted consiga puede ser
            distinto según la calidad, la cantidad y el día de la semana.
          </li>
          <li>
            <strong>Entre más lejos, menos preciso.</strong> El pronóstico a cuatro semanas falla
            más que el de una semana.
          </li>
        </ul>
      </Card>
    </>
  );
}

function ModelSections({ summary }: { summary: ModelSummary }) {
  const chosen = summary.overall.find((row) => row.model === summary.model_type);
  const naive = summary.overall.find((row) => row.model === 'naive');
  // The API sorts the models from the lowest to the highest test error.
  const best = summary.overall[0];
  const { train, validation, test } = summary.splits;
  const firstHorizon = Math.min(...summary.horizons);
  const lastHorizon = Math.max(...summary.horizons);
  const coverageByHorizon = new Map(
    summary.interval_coverage.map((row) => [row.horizon, row.coverage_pct]),
  );
  const maxImportance = Math.max(...summary.top_features.map((row) => row.importance_pct));

  return (
    <>
      <div className={`${styles.grid} ${styles.section}`}>
        <Card title="Qué hace el modelo">
          <div className={styles.prose}>
            <p>
              El modelo es un programa que aprende de los precios de años anteriores
              {train && <> (desde el {formatLongDate(train.start)})</>} y estima el precio mayorista
              promedio de cada producto en cada plaza de {firstHorizon} a {lastHorizon} semanas
              adelante.
            </p>
            <p>
              Además del precio esperado entrega un rango: el precio real debería caer dentro de ese
              rango unas {summary.interval_nominal_pct} de cada 100 veces.
            </p>
          </div>
        </Card>

        <Card title="El modelo elegido">
          <div className={styles.prose}>
            <p>
              Se probaron {summary.overall.length} formas de pronosticar y se eligió{' '}
              <strong>{summary.model_label}</strong>. La regla fue: «{summary.selection_rule}»
            </p>
            {validation && test && (
              <p>
                Se eligió con los precios del {formatLongDate(validation.start)} al{' '}
                {formatLongDate(validation.end)} y después se puso a prueba con semanas que nunca
                había visto: del {formatLongDate(test.start)} al {formatLongDate(test.end)}. Los
                resultados de esta página son los de esa prueba.
              </p>
            )}
            {chosen && best && best.model !== chosen.model && (
              <p>
                En la prueba, {best.label} tuvo un error apenas menor (
                {formatPercent(best.mape_pct)} frente a {formatPercent(chosen.mape_pct)}). Se
                mantiene {summary.model_label} porque la elección se hace antes de ver la prueba,
                para no escoger con ventaja.
              </p>
            )}
            <p className={styles.meta}>
              Versión {summary.model_version}, entrenado el{' '}
              {formatLongDate(summary.created_at.slice(0, 10))}.
            </p>
          </div>
        </Card>
      </div>

      {chosen && naive && (
        <Card
          title="Qué tan bien acierta"
          subtitle="Se compara con el pronóstico ingenuo: suponer que el precio de las próximas semanas será igual al de esta semana."
          className={styles.section}
        >
          <dl className={styles.stats}>
            <div className={styles.stat}>
              <dt>Error promedio del modelo</dt>
              <dd className="tabular">{formatPercent(chosen.mape_pct)}</dd>
              <p>
                Ingenuo: {formatPercent(naive.mape_pct)}. En plata, el modelo falla en promedio por{' '}
                <PriceTag value={chosen.mae} /> y el ingenuo por <PriceTag value={naive.mae} />.
              </p>
            </div>
            <div className={styles.stat}>
              <dt>Mejora frente al ingenuo</dt>
              <dd className="tabular">{formatPercent(chosen.skill_mape_pct)}</dd>
              <p>Es lo que se reduce el error al usar el modelo. Es una mejora modesta.</p>
            </div>
            {chosen.directional_accuracy_pct !== null && (
              <div className={styles.stat}>
                <dt>Acierta si sube o baja</dt>
                <dd className="tabular">{formatPercent(chosen.directional_accuracy_pct)}</dd>
                <p>De las veces que el precio cambió. Adivinar al azar daría cerca de 50 %.</p>
              </div>
            )}
            <div className={styles.stat}>
              <dt>Precios reales dentro del rango</dt>
              <dd className="tabular">{formatPercent(summary.interval_coverage_overall_pct)}</dd>
              <p>Se esperaba {summary.interval_nominal_pct} %, así que el rango es confiable.</p>
            </div>
          </dl>

          <h3 className={styles.subheading}>Error promedio según qué tan lejos se pronostica</h3>
          <p className={styles.caption}>
            Porcentaje de error promedio en la prueba. Menos es mejor.
          </p>
          <div className={styles.chart}>
            <Suspense fallback={null}>
              <ErrorByHorizonChart
                byHorizon={summary.by_horizon}
                modelLabel={summary.model_label}
              />
            </Suspense>
          </div>

          <div className={styles.tableWrapper}>
            <table className={`${styles.table} tabular`}>
              <caption className="visually-hidden">Resultados de la prueba por horizonte</caption>
              <thead>
                <tr>
                  <th scope="col">Pronóstico a</th>
                  <th scope="col">Error del modelo</th>
                  <th scope="col">Error del ingenuo</th>
                  <th scope="col">Mejora</th>
                  <th scope="col">Acierta la dirección</th>
                  <th scope="col">Dentro del rango</th>
                </tr>
              </thead>
              <tbody>
                {summary.by_horizon.map((row) => {
                  const direction = row.model.directional_accuracy_pct;
                  const coverage = coverageByHorizon.get(row.horizon);
                  return (
                    <tr key={row.horizon}>
                      <th scope="row">{weeksLabel(row.horizon)}</th>
                      <td>{formatPercent(row.model.mape_pct)}</td>
                      <td>{formatPercent(row.naive.mape_pct)}</td>
                      <td>{formatPercent(row.model.skill_mape_pct)}</td>
                      <td>{direction === null ? 'Sin dato' : formatPercent(direction)}</td>
                      <td>{coverage === undefined ? 'Sin dato' : formatPercent(coverage)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {summary.top_features.length > 0 && (
        <Card
          title="En qué se fija el modelo"
          subtitle="Las variables que más pesan en el pronóstico y qué parte del peso total tiene cada una."
          className={styles.section}
        >
          <ol className={styles.features}>
            {summary.top_features.map((feature) => (
              <li key={feature.feature} className={styles.feature}>
                <span>{feature.label}</span>
                <span className="tabular">{formatPercent(feature.importance_pct)}</span>
                <span className={styles.featureTrack} aria-hidden="true">
                  <span
                    className={styles.featureBar}
                    style={{ width: `${(feature.importance_pct / maxImportance) * 100}%` }}
                  />
                </span>
              </li>
            ))}
          </ol>
          <p className={styles.caption}>
            En palabras simples: el modelo mira sobre todo qué tan lejos está el precio de hoy de su
            nivel habitual, de qué producto se trata y en qué época del año estamos.
            {summary.importance_kind && <> Medida usada: {summary.importance_kind}.</>}
          </p>
        </Card>
      )}
    </>
  );
}
