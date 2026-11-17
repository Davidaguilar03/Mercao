import { SearchSelect } from '../SearchSelect/SearchSelect';

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

/** Searchable select with the markets of a product, in alphabetical order. */
export function MarketSelector({ markets, value, onChange, label = 'Plaza' }: MarketSelectorProps) {
  const options = [...markets]
    .sort((a, b) => a.market_name.localeCompare(b.market_name, 'es'))
    .map((market) => ({ id: market.market_id, name: market.market_name }));
  return (
    <SearchSelect
      label={label}
      groups={[{ key: 'markets', options }]}
      value={value}
      onChange={onChange}
      placeholder={markets.length === 0 ? 'Sin plazas disponibles' : 'Busque una plaza'}
      disabled={markets.length === 0}
      noResults={(query) => `Ninguna plaza coincide con «${query}».`}
    />
  );
}
