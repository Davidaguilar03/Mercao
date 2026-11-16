import type { Health, ModelSummary, Product } from '../api/types';

export const products: Product[] = [
  {
    product_id: 1,
    canonical_name: 'Papa parda pastusa',
    family: 'papa',
    variety: 'parda pastusa',
    group: 'tuberculos',
    comparable_group: 'papa-parda-pastusa|kg',
  },
  {
    product_id: 2,
    canonical_name: 'Cebolla cabezona blanca',
    family: 'cebolla',
    variety: 'cabezona blanca',
    group: 'hortalizas',
    comparable_group: 'cebolla-cabezona-blanca|kg',
  },
  {
    product_id: 3,
    canonical_name: 'Cebolla junca',
    family: 'cebolla',
    variety: 'junca',
    group: 'hortalizas',
    comparable_group: 'cebolla-junca|kg',
  },
  {
    product_id: 6,
    canonical_name: 'Zanahoria',
    family: 'zanahoria',
    variety: '',
    group: 'hortalizas',
    comparable_group: 'zanahoria|kg',
  },
  {
    product_id: 9,
    canonical_name: 'Plátano hartón verde',
    family: 'platano',
    variety: 'hartón verde',
    group: 'tuberculos',
    comparable_group: 'platano-harton-verde|kg',
  },
];

export const health: Health = {
  status: 'ok',
  latest_week: { iso_year: 2026, iso_week: 46, week_start: '2026-11-09', week_end: '2026-11-15' },
};

const naive = { directional_accuracy_pct: null, skill_mae_pct: 0, skill_mape_pct: 0 };

export const modelSummary: ModelSummary = {
  model_type: 'lightgbm',
  model_label: 'LightGBM',
  model_version: 'lightgbm-202611160849',
  created_at: '2026-11-16T08:49:22',
  target: 'log(price[t+h] / price[t])',
  horizons: [1, 2],
  splits: {
    train: { start: '2017-01-02', end: '2024-11-17', start_iso: '2017-W01', end_iso: '2024-W46' },
    validation: {
      start: '2024-11-18',
      end: '2025-11-16',
      start_iso: '2024-W47',
      end_iso: '2025-W46',
    },
    test: { start: '2025-11-17', end: '2026-11-15', start_iso: '2025-W47', end_iso: '2026-W46' },
  },
  fitted_on: 'train + validation',
  selection_rule: 'Menor MAPE de validación promediado sobre los horizontes.',
  overall: [
    {
      model: 'random_forest',
      label: 'Random Forest',
      mae: 493,
      mape_pct: 13.9,
      directional_accuracy_pct: 60.2,
      skill_mae_pct: 7.7,
      skill_mape_pct: 6.9,
    },
    {
      model: 'lightgbm',
      label: 'LightGBM',
      mae: 496,
      mape_pct: 14.0,
      directional_accuracy_pct: 60.5,
      skill_mae_pct: 7.2,
      skill_mape_pct: 6.1,
    },
    { model: 'naive', label: 'Ingenuo', mae: 534, mape_pct: 14.9, ...naive },
  ],
  by_horizon: [
    {
      horizon: 1,
      model: {
        mae: 346,
        mape_pct: 9.7,
        directional_accuracy_pct: 58.9,
        skill_mae_pct: 4.3,
        skill_mape_pct: 3.6,
      },
      naive: { mae: 362, mape_pct: 10.1, ...naive },
    },
    {
      horizon: 2,
      model: {
        mae: 485,
        mape_pct: 13.7,
        directional_accuracy_pct: 60.1,
        skill_mae_pct: 6.9,
        skill_mape_pct: 5.9,
      },
      naive: { mae: 521, mape_pct: 14.6, ...naive },
    },
  ],
  interval_nominal_pct: 80,
  interval_coverage: [
    { horizon: 1, coverage_pct: 82.2 },
    { horizon: 2, coverage_pct: 80.8 },
  ],
  interval_coverage_overall_pct: 81.6,
  importance_kind: 'Ganancia de LightGBM',
  top_features: [
    {
      feature: 'price_vs_ma_52w',
      label: 'Precio vs. media 52 sem.',
      importance_pct: 30.2,
      permutation_mae_increase: 0.02887,
    },
    {
      feature: 'product_id',
      label: 'Producto',
      importance_pct: 18.2,
      permutation_mae_increase: 0.00954,
    },
  ],
};
