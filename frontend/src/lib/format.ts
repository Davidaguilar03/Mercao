// Formatting helpers for everything the user reads: Colombian pesos, percentages and dates (es-CO).

const LOCALE = 'es-CO';
const NBSP = '\u00a0';
const MINUS = '\u2212';

const integerFormat = new Intl.NumberFormat(LOCALE, {
  maximumFractionDigits: 0,
  useGrouping: 'always',
});

const oneDecimalFormat = new Intl.NumberFormat(LOCALE, {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
  useGrouping: 'always',
});

/** 2350 -> "$ 2.350" */
export function formatPesos(value: number): string {
  const rounded = Math.round(value);
  const sign = rounded < 0 ? MINUS : '';
  return `${sign}$${NBSP}${integerFormat.format(Math.abs(rounded))}`;
}

/** 2350 -> "$ 2.350 /kg" */
export function formatPricePerKg(value: number): string {
  return `${formatPesos(value)}${NBSP}/kg`;
}

/** 14 -> "14,0 %" */
export function formatPercent(value: number): string {
  const sign = value < 0 ? MINUS : '';
  return `${sign}${oneDecimalFormat.format(Math.abs(value))}${NBSP}%`;
}

/** Percentage change with an explicit sign: 12.5 -> "+12,5 %", -10.4 -> "\u221210,4 %", 0 -> "0,0 %". */
export function formatChange(value: number): string {
  // Values that round to zero carry no sign.
  const rounded = Math.round(value * 10) / 10;
  if (rounded === 0) return formatPercent(0);
  return rounded > 0 ? `+${formatPercent(rounded)}` : formatPercent(rounded);
}

export type Trend = 'up' | 'down' | 'flat';

export function getTrend(value: number): Trend {
  const rounded = Math.round(value * 10) / 10;
  if (rounded > 0) return 'up';
  if (rounded < 0) return 'down';
  return 'flat';
}

// API dates are plain days (YYYY-MM-DD); they are read and shown in UTC so the day never shifts.
function parseDate(isoDate: string): Date {
  return new Date(`${isoDate.slice(0, 10)}T00:00:00Z`);
}

const longDateFormat = new Intl.DateTimeFormat(LOCALE, {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

const dayMonthFormat = new Intl.DateTimeFormat(LOCALE, {
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC',
});

/** "2026-11-09" -> "9 de noviembre de 2026" */
export function formatLongDate(isoDate: string): string {
  return longDateFormat.format(parseDate(isoDate));
}

/** ("2026-11-09", "2026-11-15") -> "9 de noviembre al 15 de noviembre de 2026" */
export function formatWeekRange(weekStart: string, weekEnd: string): string {
  return `${dayMonthFormat.format(parseDate(weekStart))} al ${formatLongDate(weekEnd)}`;
}
