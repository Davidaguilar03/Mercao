import {
  addDays,
  formatChange,
  formatLongDate,
  formatMonthYear,
  formatPercent,
  formatPesos,
  formatPlaceName,
  formatPricePerKg,
  formatTons,
  formatWeek,
  formatWeekRange,
  getTrend,
  lowerFirst,
} from './format';

// The helpers use non-breaking spaces so a price never wraps between the symbol and the number.
const plain = (text: string) => text.replace(/\u00a0/g, ' ');

describe('formatPesos', () => {
  it('uses the dot as thousands separator, as in Colombia', () => {
    expect(plain(formatPesos(2350))).toBe('$ 2.350');
    expect(plain(formatPesos(1234567))).toBe('$ 1.234.567');
  });

  it('rounds to whole pesos', () => {
    expect(plain(formatPesos(2349.6))).toBe('$ 2.350');
    expect(plain(formatPesos(0))).toBe('$ 0');
  });

  it('does not group numbers below one thousand', () => {
    expect(plain(formatPesos(950))).toBe('$ 950');
  });
});

describe('formatPricePerKg', () => {
  it('adds the unit', () => {
    expect(plain(formatPricePerKg(2350))).toBe('$ 2.350 /kg');
  });
});

describe('formatPercent', () => {
  it('uses the decimal comma and one decimal', () => {
    expect(plain(formatPercent(14))).toBe('14,0 %');
    expect(plain(formatPercent(81.64))).toBe('81,6 %');
    expect(plain(formatPercent(-57.1))).toBe('\u221257,1 %');
  });
});

describe('formatChange', () => {
  it('shows an explicit sign for rises and falls', () => {
    expect(plain(formatChange(12.5))).toBe('+12,5 %');
    expect(plain(formatChange(-10.4))).toBe('\u221210,4 %');
    expect(plain(formatChange(172.6))).toBe('+172,6 %');
  });

  it('shows no sign when the change rounds to zero', () => {
    expect(plain(formatChange(0))).toBe('0,0 %');
    expect(plain(formatChange(-0.04))).toBe('0,0 %');
  });
});

describe('getTrend', () => {
  it('classifies the change after rounding to one decimal', () => {
    expect(getTrend(3.2)).toBe('up');
    expect(getTrend(-3.2)).toBe('down');
    expect(getTrend(0.04)).toBe('flat');
  });
});

describe('dates', () => {
  it('formats a day in Spanish without shifting it by time zone', () => {
    expect(formatLongDate('2026-11-09')).toBe('9 de noviembre de 2026');
  });

  it('formats a week range the short way', () => {
    expect(formatWeekRange('2026-11-09', '2026-11-15')).toBe('9 al 15 de noviembre de 2026');
  });

  it('formats a week from its Monday, across months and years too', () => {
    expect(formatWeek('2026-11-16')).toBe('16 al 22 de noviembre de 2026');
    expect(formatWeek('2026-11-30')).toBe('30 de noviembre al 6 de diciembre de 2026');
    expect(formatWeek('2025-12-29')).toBe('29 de diciembre de 2025 al 4 de enero de 2026');
  });

  it('adds days to a plain date', () => {
    expect(addDays('2026-11-09', 6)).toBe('2026-11-15');
    expect(addDays('2026-12-28', 7)).toBe('2027-01-04');
  });

  it('formats a short month and year for chart axes', () => {
    expect(formatMonthYear(Date.UTC(2026, 10, 1))).toBe('nov 26');
  });
});

describe('places and weights', () => {
  it('writes DANE place names in sentence case', () => {
    expect(formatPlaceName('CUNDINAMARCA')).toBe('Cundinamarca');
    expect(formatPlaceName('NORTE DE SANTANDER')).toBe('Norte de Santander');
    expect(formatPlaceName('BOGOTÁ, D.C.')).toBe('Bogotá, D.C.');
    expect(formatPlaceName('VALLE DEL CAUCA')).toBe('Valle del Cauca');
    expect(formatPlaceName('VILLAPINZÓN')).toBe('Villapinzón');
  });

  it('formats kilograms as whole tonnes', () => {
    expect(formatTons(14282250).replace(/\s/g, ' ')).toBe('14.282 t');
    expect(formatTons(36000).replace(/\s/g, ' ')).toBe('36 t');
  });

  it('lowers only the first letter of a product name', () => {
    expect(lowerFirst('Mora de Castilla')).toBe('mora de Castilla');
  });
});
