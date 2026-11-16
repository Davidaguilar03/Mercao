import { useId } from 'react';
import type { Horizon } from '../../api/types';
import styles from './HorizonSelector.module.css';

interface HorizonSelectorProps {
  value: Horizon;
  onChange: (horizon: Horizon) => void;
  label?: string;
}

const HORIZONS: Horizon[] = [1, 2, 3, 4];

export function HorizonSelector({ value, onChange, label = 'Pronóstico a' }: HorizonSelectorProps) {
  const name = useId();
  return (
    <fieldset className={styles.fieldset}>
      <legend className={styles.legend}>{label}</legend>
      <div className={styles.options}>
        {HORIZONS.map((horizon) => (
          <label key={horizon} className={styles.option}>
            <input
              type="radio"
              className="visually-hidden"
              name={name}
              value={horizon}
              checked={value === horizon}
              onChange={() => onChange(horizon)}
            />
            <span className={styles.pill}>
              {horizon} {horizon === 1 ? 'semana' : 'semanas'}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
