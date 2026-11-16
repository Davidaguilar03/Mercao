import { products } from '../test/fixtures';
import { plain } from '../test/utils';
import { forecasts, latestPrices } from '../test/viewFixtures';
import {
  buildMarketGroups,
  buildSummary,
  classifyPriceLevel,
  explainConfidence,
  median,
  percentChange,
  varietyLabel,
} from './analysis';

describe('median', () => {
  it('takes the middle value or the average of the two middle values', () => {
    expect(median([3477, 2317, 3063])).toBe(3063);
    expect(median([1000, 2000, 3000, 5000])).toBe(2500);
  });
});

describe('classifyPriceLevel', () => {
  it('compares a price with the median of its group, with a 5 % margin', () => {
    expect(classifyPriceLevel(900, 1000)).toBe('cheaper');
    expect(classifyPriceLevel(950, 1000)).toBe('cheaper');
    expect(classifyPriceLevel(960, 1000)).toBe('similar');
    expect(classifyPriceLevel(1040, 1000)).toBe('similar');
    expect(classifyPriceLevel(1050, 1000)).toBe('expensive');
    expect(classifyPriceLevel(1400, 1000)).toBe('expensive');
  });
});

describe('percentChange', () => {
  it('rounds to one decimal', () => {
    expect(percentChange(2317, 2254)).toBe(-2.7);
    expect(percentChange(1000, 1500)).toBe(50);
  });
});

describe('buildMarketGroups', () => {
  const groups = buildMarketGroups(latestPrices.markets, forecasts.markets, 2);

  it('sorts the markets of a group from the cheapest to the most expensive', () => {
    expect(groups).toHaveLength(1);
    expect(groups[0].rows.map((row) => row.city)).toEqual(['Pereira', 'Bogotá', 'Cartago']);
  });

  it('gives every market its level against the median of the group', () => {
    expect(groups[0].rows.map((row) => row.level)).toEqual(['cheaper', 'similar', 'expensive']);
  });

  it('adds the forecast of the horizon and its change against the latest price', () => {
    const [pereira] = groups[0].rows;
    expect(pereira.forecastPrice).toBe(2254);
    expect(pereira.forecastChangePct).toBe(-2.7);
  });

  it('keeps the markets without forecast', () => {
    const [group] = buildMarketGroups(latestPrices.markets, [], 2);
    expect(group.rows).toHaveLength(3);
    expect(group.rows[0].forecastPrice).toBeNull();
    expect(group.rows[0].forecastChangePct).toBeNull();
  });

  it('separates the comparable groups, largest first, and does not rank a market that is alone', () => {
    const other = {
      ...latestPrices.markets[0],
      market_id: 99,
      comparable_group: 'papa-criolla|kg',
    };
    const result = buildMarketGroups([other, ...latestPrices.markets], [], 2);
    expect(result.map((group) => group.comparableGroup)).toEqual([
      'papa-parda-pastusa|kg',
      'papa-criolla|kg',
    ]);
    expect(result[1].rows[0].level).toBe('similar');
  });
});

describe('buildSummary', () => {
  const groups = buildMarketGroups(latestPrices.markets, forecasts.markets, 2);

  it('names the cheapest and the most expensive city and the trend of the last four weeks', () => {
    expect(plain(buildSummary('Papa parda pastusa', groups))).toBe(
      'Esta semana el precio más bajo de papa parda pastusa está en Pereira ($ 2.317 /kg) y el ' +
        'más alto en Cartago ($ 3.477 /kg). Frente a hace cuatro semanas subió en 2 de 3 plazas.',
    );
  });

  it('says the price fell when most markets went down', () => {
    const falling = latestPrices.markets.map((market) => ({ ...market, change_4w_pct: -5 }));
    expect(buildSummary('Tomate chonto', buildMarketGroups(falling, [], 2))).toContain(
      'Frente a hace cuatro semanas bajó en 3 de 3 plazas.',
    );
  });

  it('leaves the trend out when rises and falls are tied or unknown', () => {
    const unknown = latestPrices.markets.map((market) => ({ ...market, change_4w_pct: null }));
    expect(buildSummary('Lulo', buildMarketGroups(unknown, [], 2))).not.toContain('Frente a');
  });

  it('handles a product with a single market', () => {
    const single = buildMarketGroups([latestPrices.markets[0]], [], 2);
    expect(plain(buildSummary('Mora de Castilla', single))).toBe(
      'Esta semana solo hay precio de mora de Castilla en Pereira: $ 2.317 /kg.',
    );
  });

  it('returns nothing without markets', () => {
    expect(buildSummary('Lulo', [])).toBeNull();
  });
});

describe('explainConfidence', () => {
  it('explains a high confidence: the ranges do not cross', () => {
    const text = explainConfidence('alta', 'Bucaramanga', 'Medellín');
    expect(text).toContain('no se cruzan');
    expect(text).toContain('Bucaramanga');
    expect(text).toContain('la diferencia se mantiene');
  });

  it('explains a low confidence: the ranges cross', () => {
    const text = explainConfidence('baja', 'Pereira', 'Cartago');
    expect(text).toContain('se cruzan');
    expect(text).toContain('puede ser menor o no darse');
  });
});

describe('varietyLabel', () => {
  const potato = products[0];

  it('uses the variety of the product for its own group', () => {
    expect(varietyLabel('papa-parda-pastusa|kg', potato)).toBe('parda pastusa');
  });

  it('reads the name of any other group from its key', () => {
    expect(varietyLabel('papa-criolla|kg', potato)).toBe('papa criolla');
  });

  it('says the variety is the only one when the product has none', () => {
    const carrot = products.find((product) => product.variety === '')!;
    expect(varietyLabel(carrot.comparable_group, carrot)).toBe('Única');
  });
});
