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

/** Whole number with the dot as thousands separator: 1234 -> "1.234". */
export function formatInteger(value: number): string {
  return integerFormat.format(Math.round(value));
}

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

/** Adds days to a plain date: ("2026-11-09", 6) -> "2026-11-15". */
export function addDays(isoDate: string, days: number): string {
  const date = parseDate(isoDate);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Milliseconds of a plain date, for time axes. */
export function toTimestamp(isoDate: string): number {
  return parseDate(isoDate).getTime();
}

/**
 * A range of days written the short way:
 * same month "9 al 15 de noviembre de 2026", two months "30 de noviembre al 6 de diciembre de 2026",
 * two years "29 de diciembre de 2025 al 4 de enero de 2026".
 */
export function formatWeekRange(weekStart: string, weekEnd: string): string {
  const start = parseDate(weekStart);
  const end = parseDate(weekEnd);
  if (start.getUTCFullYear() !== end.getUTCFullYear()) {
    return `${formatLongDate(weekStart)} al ${formatLongDate(weekEnd)}`;
  }
  if (start.getUTCMonth() !== end.getUTCMonth()) {
    return `${dayMonthFormat.format(start)} al ${formatLongDate(weekEnd)}`;
  }
  return `${start.getUTCDate()} al ${formatLongDate(weekEnd)}`;
}

/** The week (Monday to Sunday) that starts on a Monday: "2026-11-16" -> "16 al 22 de noviembre de 2026". */
export function formatWeek(weekStart: string): string {
  return formatWeekRange(weekStart, addDays(weekStart, 6));
}

const monthYearFormat = new Intl.DateTimeFormat(LOCALE, {
  month: 'short',
  year: '2-digit',
  timeZone: 'UTC',
});

/** Short label for chart axes: "nov 26". */
export function formatMonthYear(timestamp: number): string {
  return monthYearFormat
    .formatToParts(new Date(timestamp))
    .filter((part) => part.type === 'month' || part.type === 'year')
    .map((part) => part.value.replace('.', ''))
    .join(' ');
}

/** Weight in tonnes without decimals: 14282250 -> "14.282 t". */
export function formatTons(kilograms: number): string {
  return `${integerFormat.format(Math.round(kilograms / 1000))}${NBSP}t`;
}

const LOWERCASE_WORDS = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'el']);

/** DANE writes places in capitals: "NORTE DE SANTANDER" -> "Norte de Santander", "BOGOTÁ, D.C." stays "Bogotá, D.C.". */
export function formatPlaceName(name: string): string {
  return name
    .toLocaleLowerCase(LOCALE)
    .split(' ')
    .map((word, index) => {
      if (index > 0 && LOWERCASE_WORDS.has(word)) return word;
      if (/^([a-z]\.)+$/.test(word)) return word.toUpperCase();
      return word.charAt(0).toLocaleUpperCase(LOCALE) + word.slice(1);
    })
    .join(' ');
}

/** Product names go inside sentences: "Papa parda pastusa" -> "papa parda pastusa". */
export function lowerFirst(text: string): string {
  return text.charAt(0).toLocaleLowerCase(LOCALE) + text.slice(1);
}
