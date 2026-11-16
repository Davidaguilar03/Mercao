import { LevelMark } from '../../components/LevelMark/LevelMark';
import { SIMILAR_THRESHOLD_PCT, type PriceLevel } from '../../lib/analysis';
import { LEVEL_LABELS } from '../../lib/chartTheme';
import styles from './MapLegend.module.css';

const LEVELS: PriceLevel[] = ['cheaper', 'similar', 'expensive'];

/** Explains the marks of the map: price level against the other markets, not price change. */
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
        Las marcas comparan cada plaza con el precio del medio entre las que venden la misma
        variedad (parecido: a menos de {SIMILAR_THRESHOLD_PCT} %). No dicen si el precio subió o
        bajó: eso va con flechas, en verde si sube y en rojo si baja. Si dos plazas quedan una
        encima de otra, acerque el mapa con el botón +.
      </p>
    </div>
  );
}
