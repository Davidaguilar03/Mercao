// API responses for the tests of the three main views: Papa parda pastusa in three markets.

import type {
  Forecasts,
  LatestPrices,
  Market,
  MarketForecast,
  PriceHistory,
  Recommendations,
  RecommendationSide,
  Seasonality,
  SupplyOrigins,
} from '../api/types';
import { health, modelSummary, products } from './fixtures';

export const markets: Market[] = [
  {
    market_id: 1,
    market_name: 'Bogotá, D.C., Corabastos',
    city: 'Bogotá',
    department: 'Bogotá, D.C.',
    latitude: 4.711,
    longitude: -74.072,
  },
  {
    market_id: 6,
    market_name: 'Pereira, Mercasa',
    city: 'Pereira',
    department: 'Risaralda',
    latitude: 4.814,
    longitude: -75.694,
  },
  {
    market_id: 8,
    market_name: 'Cartago (Valle del Cauca)',
    city: 'Cartago',
    department: 'Valle del Cauca',
    latitude: 4.746,
    longitude: -75.912,
  },
];

const POTATO_GROUP = 'papa-parda-pastusa|kg';
const week = { week_start: '2026-11-09', iso_year: 2026, iso_week: 46 };

// Median 3063: Pereira is cheaper, Bogotá similar and Cartago more expensive.
export const latestPrices: LatestPrices = {
  product_id: 1,
  product_name: 'Papa parda pastusa',
  unit: 'kg',
  markets: [
    {
      market_id: 6,
      market_name: 'Pereira, Mercasa',
      city: 'Pereira',
      comparable_group: POTATO_GROUP,
      ...week,
      mean_price: 2317,
      min_price: 2200,
      max_price: 2400,
      change_4w_pct: -10.4,
      change_52w_pct: 172.6,
    },
    {
      market_id: 1,
      market_name: 'Bogotá, D.C., Corabastos',
      city: 'Bogotá',
      comparable_group: POTATO_GROUP,
      ...week,
      mean_price: 3063,
      min_price: 2800,
      max_price: 3400,
      change_4w_pct: 4.8,
      change_52w_pct: 154,
    },
    {
      market_id: 8,
      market_name: 'Cartago (Valle del Cauca)',
      city: 'Cartago',
      comparable_group: POTATO_GROUP,
      ...week,
      mean_price: 3477,
      min_price: 3300,
      max_price: 3600,
      change_4w_pct: 15,
      change_52w_pct: null,
    },
  ],
};

const TARGET_WEEKS = ['2026-11-16', '2026-11-23', '2026-11-30', '2026-12-07'];

function marketForecast(
  market: { market_id: number; market_name: string; city: string },
  lastPrice: number,
  predictions: [number, number, number][],
): MarketForecast {
  return {
    market_id: market.market_id,
    market_name: market.market_name,
    city: market.city,
    comparable_group: POTATO_GROUP,
    origin_iso_year: 2026,
    origin_iso_week: 46,
    origin_week_start: '2026-11-09',
    last_observed_price: lastPrice,
    forecasts: predictions.map(([predicted, lower, upper], index) => ({
      horizon: index + 1,
      target_iso_year: 2026,
      target_iso_week: 47 + index,
      target_week_start: TARGET_WEEKS[index],
      predicted_price: predicted,
      lower_price: lower,
      upper_price: upper,
    })),
  };
}

const [pereira, bogota, cartago] = latestPrices.markets;

export const forecasts: Forecasts = {
  product_id: 1,
  product_name: 'Papa parda pastusa',
  unit: 'kg',
  model_version: 'lightgbm-202611160849',
  markets: [
    marketForecast(bogota, 3063, [
      [3021, 2568, 3543],
      [2938, 2316, 3608],
      [2928, 2216, 3723],
      [2941, 2172, 3843],
    ]),
    marketForecast(pereira, 2317, [
      [2290, 1950, 2690],
      [2254, 1777, 2769],
      [2260, 1710, 2880],
      [2270, 1680, 2960],
    ]),
    marketForecast(cartago, 3477, [
      [3420, 2900, 4010],
      [3355, 2645, 4120],
      [3340, 2530, 4250],
      [3350, 2470, 4380],
    ]),
  ],
  message: null,
};

export const supplyOrigins: SupplyOrigins = {
  product_id: 1,
  product_name: 'Papa parda pastusa',
  market_id: null,
  market_name: 'Todos los mercados foco',
  first_week_start: '2025-11-10',
  last_week_start: '2026-11-02',
  total_kg: 10000000,
  departments: [
    { code: '52', name: 'NARIÑO', kg: 5000000, share_pct: 50 },
    { code: '25', name: 'CUNDINAMARCA', kg: 3000000, share_pct: 30 },
    { code: '54', name: 'NORTE DE SANTANDER', kg: 1500000, share_pct: 15 },
  ],
  municipalities: [
    { code: '52356', name: 'IPIALES', department: 'NARIÑO', kg: 2000000, share_pct: 20 },
    { code: '25873', name: 'VILLAPINZÓN', department: 'CUNDINAMARCA', kg: 1000000, share_pct: 10 },
  ],
  imported_kg: 500000,
  imported_share_pct: 5,
  message: null,
};

export const emptySupplyOrigins: SupplyOrigins = {
  ...supplyOrigins,
  market_id: 8,
  market_name: 'Cartago (Valle del Cauca)',
  total_kg: 0,
  departments: [],
  municipalities: [],
  imported_kg: 0,
  imported_share_pct: 0,
  message:
    'No hay datos de abastecimiento de Papa parda pastusa en Cartago (Valle del Cauca) en las últimas 52 semanas.',
};

export const priceHistory: PriceHistory = {
  product_id: 1,
  product_name: 'Papa parda pastusa',
  market_id: 1,
  market_name: 'Bogotá, D.C., Corabastos',
  unit: 'kg',
  from: '2000-01-01',
  to: '2026-11-09',
  series: [
    { week_start: '2023-11-13', mean_price: 2066, min_price: 1800, max_price: 2300 },
    { week_start: '2025-09-29', mean_price: 744, min_price: 700, max_price: 800 },
    { week_start: '2026-11-02', mean_price: 3100, min_price: null, max_price: null },
    { week_start: '2026-11-09', mean_price: 3063, min_price: 2800, max_price: 3400 },
  ],
};

const MONTH_NAMES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];
const MONTH_INDEXES = [
  104.3, 101.2, 112.4, 119.7, 117.6, 103.3, 95.5, 84.6, 79.7, 86.2, 95.9, 99.6,
];

export const seasonality: Seasonality = {
  product_id: 1,
  product_name: 'Papa parda pastusa',
  market_id: 1,
  market_name: 'Bogotá, D.C., Corabastos',
  years_used: [2016, 2017, 2018],
  months: MONTH_NAMES.map((month_name, index) => ({
    month: index + 1,
    month_name,
    index: MONTH_INDEXES[index],
  })),
  cheapest_month: 'septiembre',
  most_expensive_month: 'abril',
  message: null,
};

function side(market: MarketForecast, horizon: number): RecommendationSide {
  const forecast = market.forecasts[horizon - 1];
  return {
    market_id: market.market_id,
    market_name: market.market_name,
    city: market.city,
    target_iso_year: forecast.target_iso_year,
    target_iso_week: forecast.target_iso_week,
    target_week_start: forecast.target_week_start,
    predicted_price: forecast.predicted_price,
    lower_price: forecast.lower_price,
    upper_price: forecast.upper_price,
  };
}

/** Buy in Pereira and sell in Cartago; the two ranges overlap, so the confidence is low. */
export function recommendationsFor(horizon: number): Recommendations {
  const buy = side(forecasts.markets[1], horizon);
  const sell = side(forecasts.markets[2], horizon);
  return {
    product_id: 1,
    product_name: 'Papa parda pastusa',
    horizon,
    unit: 'kg',
    groups: [
      {
        comparable_group: POTATO_GROUP,
        markets_compared: 3,
        buy,
        sell,
        difference_per_kg: sell.predicted_price - buy.predicted_price,
        difference_pct: 48.8,
        confidence: 'baja',
      },
    ],
    message: null,
    note: 'Las diferencias no incluyen costos de transporte ni de intermediación entre mercados.',
  };
}

export const emptyRecommendations: Recommendations = {
  ...recommendationsFor(2),
  groups: [],
  message: 'Papa parda pastusa no tiene pronóstico en dos o más mercados comparables.',
};

/** Every endpoint answered with the fixtures above. */
export const fullApi = {
  '/api/health': health,
  '/api/products': products,
  '/api/markets': markets,
  '/api/prices/latest': latestPrices,
  '/api/prices/history': priceHistory,
  '/api/prices/seasonality': seasonality,
  '/api/supply/origins': supplyOrigins,
  '/api/forecasts': forecasts,
  '/api/recommendations': (params: URLSearchParams) =>
    recommendationsFor(Number(params.get('horizon') ?? 2)),
  '/api/model/summary': modelSummary,
};
