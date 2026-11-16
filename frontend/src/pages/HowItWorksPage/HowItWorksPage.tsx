import { BookOpen, Download, Newspaper, Store, Target, type LucideIcon } from 'lucide-react';
import { lazy, Suspense } from 'react';
import { useModelSummary } from '../../api/hooks';
import type { ModelSummary } from '../../api/types';
import { Card } from '../../components/Card/Card';
import table from '../../components/DataTable/DataTable.module.css';
import { KpiCard, KpiGrid } from '../../components/KpiCard/KpiCard';
import { PageHeader } from '../../components/layout/PageHeader';
import { ErrorState } from '../../components/states/ErrorState';
import { LoadingState } from '../../components/states/LoadingState';
import { formatLongDate, formatPercent, formatPesos } from '../../lib/format';
import page from '../page.module.css';
import styles from './HowItWorksPage.module.css';
import { ModelChoiceNote, ModelComparison } from './ModelComparison';

// The chart library is heavy, so it loads only when a chart is shown.
const ErrorByHorizonChart = lazy(() => import('./ErrorByHorizonChart'));

const weeksLabel = (horizon: number) => (horizon === 1 ? '1 semana' : `${horizon} semanas`);

interface Step {
  icon: LucideIcon;
  title: string;
  text: string;
}

/** The weekly path of the data. The summary fills in the real dates and numbers once it loads. */
function buildSteps(summary: ModelSummary | undefined): Step[] {
  const firstYear = summary?.splits.train?.start.slice(0, 4);
  const weeks = summary ? Math.max(...summary.horizons) : 4;
  const nominal = summary?.interval_nominal_pct ?? 80;
  return [
    {
      icon: Newspaper,
      title: 'El DANE publica los precios cada semana',
      text: 'Sus encuestadores visitan las centrales mayoristas y registran a cuánto se vende cada producto. Es la fuente oficial (SIPSA).',
    },
    {
      icon: Download,
      title: 'Mercao los descarga y los limpia',
      text: 'Unifica los nombres de productos y plazas y descarta los datos incompletos. No cambia ningún precio ni agrega datos propios.',
    },
    {
      icon: BookOpen,
      title: firstYear
        ? `El modelo aprende de los precios desde ${firstYear}`
        : 'El modelo aprende de los precios de años anteriores',
      text: 'Un programa busca patrones en la historia: las temporadas y las subidas y bajadas de cada producto en cada plaza.',
    },
    {
      icon: Target,
      title: `Estima el precio de las próximas ${weeks} semanas`,
      text: `Entrega un precio esperado y un rango: el precio real debería caer dentro de ese rango unas ${nominal} de cada 100 veces.`,
    },
    {
      icon: Store,
      title: 'La aplicación lo muestra por plaza',
      text: 'En Panorama, Producto y Oportunidades, junto al último precio real. Al pie de cada página aparece la última semana con datos.',
    },
  ];
}

export function HowItWorksPage() {
  const summary = useModelSummary();

  return (
    <>
      <PageHeader
        title="Cómo funciona"
        description="De dónde salen los precios que ve en Mercao, cómo se calculan los pronósticos y qué tanto se puede confiar en ellos."
      />

      <div className={page.stack}>
        <Card
          title="De los boletines del DANE al pronóstico"
          subtitle="Lo que pasa cada semana, paso a paso."
        >
          <ol className={styles.steps}>
            {buildSteps(summary.data).map((step, index) => (
              <li key={step.title} className={styles.step}>
                <span className={styles.stepMarker} aria-hidden="true">
                  <step.icon size={22} />
                  <span className={styles.stepNumber}>{index + 1}</span>
                </span>
                <div>
                  <h3 className={styles.stepTitle}>{step.title}</h3>
                  <p className={styles.stepText}>{step.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </Card>

        {summary.isPending && <LoadingState message="Cargando los resultados del modelo…" />}
        {summary.isError && (
          <ErrorState message={summary.error.message} onRetry={() => summary.refetch()} />
        )}
        {summary.data && <ModelSections summary={summary.data} />}

        <Card
          title="Lo que Mercao no hace"
          subtitle="Téngalo presente antes de tomar una decisión con estos datos."
          className={styles.limits}
        >
          <ul className={styles.limitations}>
            <li>
              <strong>No garantiza precios.</strong> El pronóstico es una estimación a partir de lo
              que ha pasado antes. Un paro, una helada o un derrumbe pueden cambiarlo todo de una
              semana a otra.
            </li>
            <li>
              <strong>No acierta mucho más que suponer que el precio sigue igual.</strong> La mejora
              es modesta. Úselo como una señal más, no como la única.
            </li>
            <li>
              <strong>No incluye el transporte.</strong> Las diferencias entre plazas no descuentan
              fletes, cargue, mermas ni intermediación, y la distancia se mide en línea recta.
            </li>
            <li>
              <strong>No muestra el precio que usted va a conseguir.</strong> Son precios mayoristas
              promedio; el suyo cambia con la calidad, la cantidad y el día de la semana.
            </li>
            <li>
              <strong>No ve igual de bien a lo lejos.</strong> El pronóstico a cuatro semanas falla
              más que el de una semana.
            </li>
          </ul>
        </Card>

        {summary.data && (
          <p className={styles.footnote}>
            Versión del modelo: {summary.data.model_version}. Entrenado el{' '}
            {formatLongDate(summary.data.created_at.slice(0, 10))}.
            {summary.data.splits.test && (
              <>
                {' '}
                Resultados medidos con semanas que el modelo nunca había visto, del{' '}
                {formatLongDate(summary.data.splits.test.start)} al{' '}
                {formatLongDate(summary.data.splits.test.end)}.
              </>
            )}
          </p>
        )}
      </div>
    </>
  );
}

function ModelSections({ summary }: { summary: ModelSummary }) {
  const chosen = summary.overall.find((row) => row.model === summary.model_type);
  const naive = summary.overall.find((row) => row.model === 'naive');
  const coverageByHorizon = new Map(
    summary.interval_coverage.map((row) => [row.horizon, row.coverage_pct]),
  );
  const maxImportance = Math.max(...summary.top_features.map((row) => row.importance_pct));

  return (
    <>
      {chosen && naive && (
        <section aria-labelledby="results-title">
          <div className={styles.sectionHeading}>
            <h2 id="results-title">Qué tan bien acierta</h2>
            <p>
              Resultados del modelo elegido ({summary.model_label}) al ponerlo a prueba con un año
              de precios que nunca había visto.
            </p>
          </div>
          <KpiGrid label="Resultados del modelo">
            <KpiCard label="Error promedio" value={formatPercent(chosen.mape_pct)}>
              Es lo que el pronóstico se aleja del precio real, en promedio. En plata, unos{' '}
              {formatPesos(chosen.mae)} por kilo.
            </KpiCard>
            <KpiCard label="Mejora frente al ingenuo" value={formatPercent(chosen.skill_mape_pct)}>
              El pronóstico ingenuo supone que el precio no cambia y falla en{' '}
              {formatPercent(naive.mape_pct)}. El modelo reduce ese error, pero poco.
            </KpiCard>
            {chosen.directional_accuracy_pct !== null && (
              <KpiCard
                label="Acierta si sube o baja"
                value={formatPercent(chosen.directional_accuracy_pct)}
              >
                De las veces que el precio cambió. Adivinar al azar daría cerca de 50 %.
              </KpiCard>
            )}
            <KpiCard
              label="Precios dentro del rango"
              value={formatPercent(summary.interval_coverage_overall_pct)}
            >
              Se esperaba {summary.interval_nominal_pct} %, así que el rango probable es confiable.
            </KpiCard>
          </KpiGrid>
        </section>
      )}

      <div className={page.grid}>
        <Card
          title={`Los ${summary.overall.length} modelos que se probaron`}
          subtitle="Error promedio de cada uno en la prueba. La barra más corta es la mejor."
        >
          <ModelComparison summary={summary} />
        </Card>

        {summary.top_features.length > 0 && (
          <Card
            title="En qué se fija el modelo"
            subtitle="Las variables que más pesan en el pronóstico y qué parte del peso tiene cada una."
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
            <p className={`${page.caption} ${page.captionAfter}`}>
              En palabras simples: el modelo mira sobre todo qué tan lejos está el precio de hoy de
              su nivel habitual, de qué producto se trata y en qué época del año estamos.
              {summary.importance_kind && <> Medida usada: {summary.importance_kind}.</>}
            </p>
          </Card>
        )}
      </div>

      <ModelChoiceNote summary={summary} />

      <Card
        title="Entre más lejos, menos preciso"
        subtitle="Error promedio en la prueba según a cuántas semanas se pronostica. Menos es mejor."
      >
        <div className={styles.chart}>
          <Suspense fallback={null}>
            <ErrorByHorizonChart byHorizon={summary.by_horizon} modelLabel={summary.model_label} />
          </Suspense>
        </div>

        <div className={`${table.wrapper} ${styles.tableWrapper}`}>
          <table className={table.table} style={{ minWidth: '36rem' }}>
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
    </>
  );
}
