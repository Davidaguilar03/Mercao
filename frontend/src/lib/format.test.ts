import {
  formatChange,
  formatLongDate,
  formatPercent,
  formatPesos,
  formatPricePerKg,
  formatWeekRange,
  getTrend,
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

  it('formats a week range', () => {
    expect(formatWeekRange('2026-11-09', '2026-11-15')).toBe(
      '9 de noviembre al 15 de noviembre de 2026',
    );
  });
});
