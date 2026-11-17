import { LevelMark } from '../../components/LevelMark/LevelMark';
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
      <p className={styles.note}>
        Los íconos comparan el precio de cada plaza con el de las demás plazas que venden la misma
        variedad esta semana (parecido: a menos de {SIMILAR_THRESHOLD_PCT} % del precio del medio).
        No dicen si el precio cambió con el tiempo: las subidas y bajadas van aparte, en verde si
        sube y en rojo si baja. Si dos plazas quedan una encima de otra, acerque el mapa con el
        botón +.
      </p>
    </div>
  );
}
