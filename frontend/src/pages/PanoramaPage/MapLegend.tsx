import { ArrowDown, ArrowUp, Equal } from 'lucide-react';
import { SIMILAR_THRESHOLD_PCT, type PriceLevel } from '../../lib/analysis';
import { LEVEL_LABELS } from '../../lib/chartTheme';
import styles from './MapLegend.module.css';

const ICONS = { cheaper: ArrowDown, similar: Equal, expensive: ArrowUp };
const LEVELS: PriceLevel[] = ['cheaper', 'similar', 'expensive'];

/** Explains the colors and symbols of the map markers. */
export function MapLegend() {
  return (
    <div className={styles.legend}>
      <ul className={styles.items}>
        {LEVELS.map((level) => {
          const Icon = ICONS[level];
          return (
            <li key={level} className={styles.item}>
              <span className={`${styles.swatch} ${styles[level]}`} aria-hidden="true">
                <Icon size={14} strokeWidth={3} />
              </span>
              {LEVEL_LABELS[level]}
            </li>
          );
        })}
      </ul>
      <p className={styles.note}>
        Cada plaza se compara con el precio del medio entre las plazas que venden la misma variedad.
        Se considera parecido si está a menos de {SIMILAR_THRESHOLD_PCT} % de ese precio. Si dos
        plazas quedan una encima de otra, acerque el mapa con el botón +.
      </p>
    </div>
  );
}
