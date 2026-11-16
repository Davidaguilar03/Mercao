import { plain } from '../../test/utils';
import { forecasts, priceHistory } from '../../test/viewFixtures';
import { buildChartPoints, buildTimeTicks, describeSeries, filterByRange } from './priceSeries';

const { series } = priceHistory;
const forecast = forecasts.markets[0];

describe('filterByRange', () => {
  it('keeps the weeks of the last year, the last three years or everything', () => {
    expect(filterByRange(series, '1y').map((point) => point.week_start)).toEqual([
      '2026-11-02',
      '2026-11-09',
    ]);
    expect(filterByRange(series, '3y')).toHaveLength(4);
    expect(filterByRange(series, 'all')).toHaveLength(4);
  });
});

describe('buildChartPoints', () => {
  const points = buildChartPoints(series, forecast);

  it('puts the forecast weeks after the observed ones', () => {
    expect(points).toHaveLength(8);
    expect(points.slice(4).map((point) => point.weekStart)).toEqual([
      '2026-11-16',
      '2026-11-23',
      '2026-11-30',
      '2026-12-07',
    ]);
    expect(points[7]).toMatchObject({
      forecast: 2941,
      forecastBand: [2172, 3843],
      isForecast: true,
    });
    expect(points[7].mean).toBeUndefined();
  });

  it('starts the forecast line at the last observed price', () => {
    expect(points[3]).toMatchObject({ mean: 3063, forecast: 3063, isForecast: false });
  });

  it('leaves the band out for weeks without minimum and maximum', () => {
    expect(points[2].band).toBeUndefined();
    expect(points[3].band).toEqual([2800, 3400]);
  });

  it('works without forecast', () => {
    expect(buildChartPoints(series, undefined)).toHaveLength(4);
  });
});

describe('buildTimeTicks', () => {
  it('marks every other year for the whole history', () => {
    const ticks = buildTimeTicks(Date.UTC(2012, 10, 12), Date.UTC(2026, 11, 7), 'all');
    expect(ticks.map((tick) => new Date(tick).getUTCFullYear())).toEqual([
      2014, 2016, 2018, 2020, 2022, 2024, 2026,
    ]);
  });

  it('marks every two months for one year', () => {
    const ticks = buildTimeTicks(Date.UTC(2025, 10, 10), Date.UTC(2026, 11, 7), '1y');
    expect(ticks).toHaveLength(6);
    expect(new Date(ticks[0]).toISOString().slice(0, 10)).toBe('2026-01-01');
  });
});

describe('describeSeries', () => {
  it('tells the chart in words: start, end, lowest, highest and forecast', () => {
    const text = plain(describeSeries(series, forecast));
    expect(text).toContain('pasó de $ 2.066 /kg (semana del 13 al 19 de noviembre de 2023)');
    expect(text).toContain('a $ 3.063 /kg (semana del 9 al 15 de noviembre de 2026)');
    expect(text).toContain(
      'El más bajo fue $ 744 /kg en la semana del 29 de septiembre al 5 de octubre de 2025',
    );
    expect(text).toContain('el más alto $ 3.100 /kg');
    expect(text).toContain(
      'Para la semana del 7 al 13 de diciembre de 2026 se espera $ 2.941 /kg, con un rango probable entre $ 2.172 /kg y $ 3.843 /kg.',
    );
  });

  it('returns nothing for an empty series', () => {
    expect(describeSeries([], forecast)).toBeNull();
  });
});
