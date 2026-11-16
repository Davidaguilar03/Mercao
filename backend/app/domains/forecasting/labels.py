"""Spanish labels of the models and features, shared by the report figures and the API."""

MODEL_LABELS = {"naive": "Ingenuo", "seasonal_naive": "Ingenuo estacional", "ridge": "Ridge",
                "random_forest": "Random Forest", "lightgbm": "LightGBM"}
FEATURE_LABELS = {
    "return_1w": "Cambio 1 semana", "return_2w": "Cambio 2 semanas", "return_4w": "Cambio 4 semanas",
    "return_8w": "Cambio 8 semanas", "return_12w": "Cambio 12 semanas", "return_52w": "Cambio 52 semanas",
    "price_vs_ma_12w": "Precio vs. media 12 sem.", "price_vs_ma_52w": "Precio vs. media 52 sem.",
    "volatility_8w": "Volatilidad 8 semanas", "week_sin": "Semana del año (seno)",
    "week_cos": "Semana del año (coseno)", "month": "Mes", "supply_vs_avg_52w": "Abastecimiento vs. media 52 sem.",
    "supply_available": "Abastecimiento disponible", "product_id": "Producto", "market_id": "Mercado",
}
