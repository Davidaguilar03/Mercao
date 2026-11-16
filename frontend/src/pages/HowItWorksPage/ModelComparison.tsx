import type { ModelSummary } from '../../api/types';
import { formatLongDate, formatPercent } from '../../lib/format';
import styles from './ModelComparison.module.css';

// What each model does, in one plain line.
const DESCRIPTIONS: Record<string, string> = {
  lightgbm: 'Muchos árboles de decisión que se corrigen unos a otros.',
  random_forest: 'Muchos árboles de decisión que votan entre todos.',
  ridge: 'Una fórmula sencilla que suma el efecto de cada variable.',
  naive: 'Supone que el precio de las próximas semanas será el de hoy.',
  seasonal_naive: 'Supone que el precio cambiará como cambió hace un año por estas fechas.',
};

interface ModelComparisonProps {
  summary: ModelSummary;
}

/** The tested models ranked by their test error (the API sorts them), with the chosen one highlighted. */
export function ModelComparison({ summary }: ModelComparisonProps) {
  const maxError = Math.max(...summary.overall.map((row) => row.mape_pct));

  return (
    <ol className={styles.list}>
      {summary.overall.map((row) => {
        const isChosen = row.model === summary.model_type;
        return (
          <li key={row.model} className={`${styles.item} ${isChosen ? styles.chosen : ''}`}>
            <span className={styles.name}>
              {row.label}
              {isChosen && <span className={styles.tag}>Elegido</span>}
            </span>
            <span className={`${styles.value} tabular`}>{formatPercent(row.mape_pct)}</span>
            <span className={styles.track} aria-hidden="true">
              <span
                className={styles.bar}
                style={{ width: `${(row.mape_pct / maxError) * 100}%` }}
              />
            </span>
            {DESCRIPTIONS[row.model] && (
              <span className={styles.description}>{DESCRIPTIONS[row.model]}</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/** How the model was chosen, and the honest note when another one did slightly better in the test. */
export function ModelChoiceNote({ summary }: ModelComparisonProps) {
  // The API sorts the models from the lowest to the highest test error.
  const best = summary.overall[0];
  const chosen = summary.overall.find((row) => row.model === summary.model_type);
  const { validation } = summary.splits;

  return (
    <div className={styles.note}>
      <p>
        <strong>Cómo se eligió.</strong> Se escogió {summary.model_label} con esta regla: «
        {summary.selection_rule}»
        {validation && (
          <>
            {' '}
            Para eso se usaron los precios del {formatLongDate(validation.start)} al{' '}
            {formatLongDate(validation.end)}, antes de hacer la prueba.
          </>
        )}
      </p>
      {chosen && best && best.model !== chosen.model && (
        <p>
          En la prueba, {best.label} tuvo un error apenas menor ({formatPercent(best.mape_pct)}{' '}
          frente a {formatPercent(chosen.mape_pct)}). Se mantiene {summary.model_label} porque la
          elección se hace antes de ver la prueba, para no escoger con ventaja.
        </p>
      )}
    </div>
  );
}
