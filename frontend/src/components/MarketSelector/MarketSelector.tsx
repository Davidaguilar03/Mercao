import { useId } from 'react';
import styles from './MarketSelector.module.css';

interface MarketOption {
  market_id: number;
  market_name: string;
}

interface MarketSelectorProps {
  /** Markets where the selected product is sold. */
  markets: MarketOption[];
  value: number | null;
  onChange: (marketId: number) => void;
  label?: string;
}

export function MarketSelector({ markets, value, onChange, label = 'Plaza' }: MarketSelectorProps) {
  const id = useId();
  const sorted = [...markets].sort((a, b) => a.market_name.localeCompare(b.market_name, 'es'));
  return (
    <div className={styles.wrapper}>
      <label className={styles.label} htmlFor={id}>
        {label}
      </label>
      <select
        id={id}
        className={styles.select}
        value={value ?? ''}
        disabled={markets.length === 0}
        onChange={(event) => onChange(Number(event.target.value))}
      >
        {markets.length === 0 && <option value="">Sin plazas disponibles</option>}
        {sorted.map((market) => (
          <option key={market.market_id} value={market.market_id}>
            {market.market_name}
          </option>
        ))}
      </select>
    </div>
  );
}
