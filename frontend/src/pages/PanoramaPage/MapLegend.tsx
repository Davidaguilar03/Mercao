import { LevelMark } from '../../components/LevelMark/LevelMark';
import { Notice } from '../../components/Notice/Notice';
import { SIMILAR_THRESHOLD_PCT, type PriceLevel } from '../../lib/analysis';
import { LEVEL_LABELS } from '../../lib/chartTheme';
import styles from './MapLegend.module.css';

const LEVELS: PriceLevel[] = ['cheaper', 'similar', 'expensive'];

/** Explains the icons of the map: price level against the other markets, not change over time. */
export function MapLegend() {
  return (
    <div className={styles.legend}>
      <ul className={styles.items} aria-label="Nivel de precio de cada plaza">
        {LEVELS.map((level) => (
          <li key={level} className={styles.item}>
            <LevelMark level={level} />
            {LEVEL_LABELS[level]}
          </li>
        ))}
      </ul>
      <Notice size="compact" className={styles.note}>
        <p>
          Cada ícono compara el precio de la plaza con el de las demás plazas que venden la misma
          variedad en la misma semana. Se considera parecido cuando difiere menos de{' '}
          {SIMILAR_THRESHOLD_PCT} % del precio central. El ícono no indica la variación del precio
          en el tiempo. Si dos plazas se superponen, el botón + acerca el mapa.
        </p>
      </Notice>
    </div>
  );
}
