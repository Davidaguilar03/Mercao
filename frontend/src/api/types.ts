// Types of the API responses, mirroring docs/api.md. Prices are whole Colombian pesos per kilogram,
// percentages have one decimal and dates are ISO strings (YYYY-MM-DD).

export interface LatestWeek {
  iso_year: number;
  iso_week: number;
  week_start: string;
  week_end: string;
}

export interface Health {
  status: 'ok' | 'sin_datos';
  latest_week: LatestWeek | null;
}

export interface Product {
  product_id: number;
  canonical_name: string;
  family: string;
  variety: string;
  group: string;
  comparable_group: string;
}

export interface Market {
  market_id: number;
  market_name: string;
  city: string;
  department: string;
  latitude: number;
  longitude: number;
}

export interface MarketLatestPrice {
  market_id: number;
  market_name: string;
  city: string;
  comparable_group: string;
  week_start: string;
  iso_year: number;
  iso_week: number;
  mean_price: number;
  min_price: number | null;
  max_price: number | null;
  change_4w_pct: number | null;
  change_52w_pct: number | null;
}

export interface LatestPrices {
  product_id: number;
  product_name: string;
  unit: string;
  markets: MarketLatestPrice[];
}

export interface PricePoint {
  week_start: string;
  mean_price: number;
  min_price: number | null;
  max_price: number | null;
}

export interface PriceHistory {
  product_id: number;
  product_name: string;
  market_id: number;
  market_name: string;
  unit: string;
  from: string;
  to: string;
  series: PricePoint[];
}

export interface SeasonalityMonth {
  month: number;
  month_name: string;
  index: number;
}

export interface Seasonality {
  product_id: number;
  product_name: string;
  market_id: number;
  market_name: string;
  years_used: number[];
  months: SeasonalityMonth[];
  cheapest_month: string | null;
  most_expensive_month: string | null;
  message: string | null;
}

export interface OriginDepartment {
  code: string | null;
  name: string;
  kg: number;
  share_pct: number;
}

export interface OriginMunicipality {
  code: string;
  name: string | null;
  department: string | null;
  kg: number;
  share_pct: number;
}

export interface SupplyOrigins {
  product_id: number;
  product_name: string;
  market_id: number | null;
  market_name: string;
  first_week_start: string | null;
  last_week_start: string | null;
  total_kg: number;
  departments: OriginDepartment[];
  municipalities: OriginMunicipality[];
  imported_kg: number;
  imported_share_pct: number;
  message: string | null;
}

export type Horizon = 1 | 2 | 3 | 4;

export interface HorizonForecast {
  horizon: number;
  target_iso_year: number;
  target_iso_week: number;
  target_week_start: string;
  predicted_price: number;
  lower_price: number;
  upper_price: number;
}

export interface MarketForecast {
  market_id: number;
  market_name: string;
  city: string;
  comparable_group: string | null;
  origin_iso_year: number;
  origin_iso_week: number;
  origin_week_start: string;
  last_observed_price: number | null;
  forecasts: HorizonForecast[];
}

export interface Forecasts {
  product_id: number;
  product_name: string;
  unit: string;
  model_version: string | null;
  markets: MarketForecast[];
  message: string | null;
}

export interface RecommendationSide {
  market_id: number;
  market_name: string;
  city: string;
  target_iso_year: number;
  target_iso_week: number;
  target_week_start: string;
  predicted_price: number;
  lower_price: number;
  upper_price: number;
  /** Price observed in the origin week of the forecast; null if that week has no price. */
  latest_price: number | null;
  /** Forecast against the latest price, in percent. */
  expected_change_percent: number | null;
}

export interface RecommendationGroup {
  comparable_group: string;
  markets_compared: number;
  buy: RecommendationSide;
  sell: RecommendationSide;
  difference_per_kg: number;
  difference_pct: number;
  confidence: 'alta' | 'baja';
  /** Straight-line distance between the two cities, in kilometres. */
  distance_km: number;
}

export interface Recommendations {
  product_id: number;
  product_name: string;
  horizon: number;
  unit: string;
  groups: RecommendationGroup[];
  message: string | null;
  note: string;
}

export interface SplitRange {
  start: string;
  end: string;
  start_iso: string;
  end_iso: string;
}

export interface Metrics {
  mae: number;
  mape_pct: number;
  directional_accuracy_pct: number | null;
  skill_mae_pct: number;
  skill_mape_pct: number;
}

export interface ModelMetrics extends Metrics {
  model: string;
  label: string;
}

export interface HorizonComparison {
  horizon: number;
  model: Metrics;
  naive: Metrics;
}

export interface HorizonCoverage {
  horizon: number;
  coverage_pct: number;
}

export interface FeatureImportance {
  feature: string;
  label: string;
  importance_pct: number;
  permutation_mae_increase: number;
}

export interface ModelSummary {
  model_type: string;
  model_label: string;
  model_version: string;
  created_at: string;
  target: string;
  horizons: number[];
  splits: Record<string, SplitRange>;
  fitted_on: string;
  selection_rule: string;
  overall: ModelMetrics[];
  by_horizon: HorizonComparison[];
  interval_nominal_pct: number;
  interval_coverage: HorizonCoverage[];
  interval_coverage_overall_pct: number;
  importance_kind: string | null;
  top_features: FeatureImportance[];
}
