# API REST de Mercao

API de solo lectura que consume el frontend. Lee `data/processed/mercao.db` (abierta en modo solo lectura) y los
metadatos del modelo en `models/metadata.json`. Nunca entrena modelos ni descarga datos.

```bash
uvicorn backend.app.main:app --reload
```

- Documentación interactiva (Swagger): http://localhost:8000/docs. Esquema OpenAPI: http://localhost:8000/openapi.json.
- Todas las rutas están bajo `/api`. Solo hay peticiones `GET`.
- CORS: permitido para el servidor de desarrollo de Vite (`http://localhost:5173`). Se cambia con la variable de
  entorno `MERCAO_CORS_ORIGINS` (orígenes separados por comas).
- Otras variables: `MERCAO_DATABASE_URL` (otra base) y `MERCAO_MODELS_DIR` (otra carpeta de modelos).

## Convenciones

- Precios en **pesos colombianos por kilogramo**, redondeados a pesos enteros. Porcentajes con un decimal.
- Fechas en formato `AAAA-MM-DD`. Las semanas son semanas ISO (lunes a domingo); `week_start` es el lunes.
- Los textos para el usuario (mensajes, nombres de meses, notas) están en español.

### Errores

| Código | Cuándo | Cuerpo |
|---|---|---|
| 404 | Producto o mercado inexistente; modelo sin entrenar en `/api/model/summary` | `{"detail": "No existe el producto 99."}` |
| 422 | Parámetro faltante, de tipo incorrecto o fuera de rango (por ejemplo `horizon=5`) | `{"detail": "Parámetros inválidos: horizon.", "errors": [...]}` |
| 422 | `from` posterior a `to` en el histórico | `{"detail": "La fecha inicial (from) no puede ser posterior a la final (to)."}` |

`errors` trae el detalle técnico de la validación (campo, tipo de error y valor recibido).

Cuando no hay datos para una consulta válida (abastecimiento de un producto que el DANE no publica, mercado sin
pronóstico, producto con un solo mercado), la respuesta es **200** con listas vacías y un campo `message` que lo
explica. No es un error.

## Endpoints

Tiempos medidos en la base real (406 MB) con el servidor local, una petición tras otra: todos por debajo de 35 ms.

| Endpoint | Ejemplo | Tiempo |
|---|---|---|
| `GET /api/health` | `/api/health` | 6 ms |
| `GET /api/products` | `/api/products` | 8 ms |
| `GET /api/markets` | `/api/markets` | 6 ms |
| `GET /api/prices/latest` | `/api/prices/latest?product_id=1` | 12 ms |
| `GET /api/prices/history` | `/api/prices/history?product_id=1&market_id=1` | 10 ms |
| `GET /api/prices/seasonality` | `/api/prices/seasonality?product_id=1&market_id=1` | 31 ms |
| `GET /api/supply/origins` | `/api/supply/origins?product_id=1&market_id=1` | 14 ms |
| `GET /api/forecasts` | `/api/forecasts?product_id=1` | 10 ms |
| `GET /api/recommendations` | `/api/recommendations?product_id=1&horizon=2` | 9 ms |
| `GET /api/model/summary` | `/api/model/summary` | 6 ms |

Las consultas usan los índices que ya crea el pipeline: `ix_prices_pair_week` (producto, mercado, año y semana ISO)
en `prices`, `ix_supply_pair_week` en `supply` y las claves primarias de `coverage`, `forecasts` y `supply_weekly`. No
hizo falta agregar índices.

### GET /api/health

Estado de la API y última semana con boletín de precios en la base.

```json
{"status": "ok", "latest_week": {"iso_year": 2026, "iso_week": 46, "week_start": "2026-11-09", "week_end": "2026-11-15"}}
```

Si la base no tiene boletines, `status` es `"sin_datos"` y `latest_week` es `null`.

### GET /api/products

Los 13 productos foco con su grupo comparable (los precios solo se comparan entre mercados del mismo grupo).

```json
[
  {"product_id": 1, "canonical_name": "Papa parda pastusa", "family": "papa", "variety": "parda pastusa",
   "group": "tuberculos", "comparable_group": "papa-parda-pastusa|kg"}
]
```

### GET /api/markets

Los 11 mercados foco. Las coordenadas son aproximadas (centro de la ciudad) y sirven para el mapa.

```json
[
  {"market_id": 1, "market_name": "Bogotá, D.C., Corabastos", "city": "Bogotá", "department": "Bogotá, D.C.",
   "latitude": 4.711, "longitude": -74.072}
]
```

### GET /api/prices/latest

| Parámetro | Tipo | Obligatorio |
|---|---|---|
| `product_id` | entero | sí |

Último precio semanal (medio, mínimo y máximo) del producto en cada mercado donde es utilizable
(`usable_for_model = 1`), ordenado del más barato al más caro. `change_4w_pct` y `change_52w_pct` comparan el precio
medio con el de 4 y 52 semanas antes; son `null` si esa semana no tiene precio. `comparable_group` marca qué mercados
se pueden comparar entre sí.

```json
{
  "product_id": 1, "product_name": "Papa parda pastusa", "unit": "kg",
  "markets": [
    {"market_id": 6, "market_name": "Pereira, Mercasa", "city": "Pereira",
     "comparable_group": "papa-parda-pastusa|kg", "week_start": "2026-11-09", "iso_year": 2026, "iso_week": 46,
     "mean_price": 2317, "min_price": 2200, "max_price": 2400, "change_4w_pct": -10.4, "change_52w_pct": 172.6}
  ]
}
```

Errores: 404 si el producto no existe; 422 si falta `product_id`.

### GET /api/prices/history

| Parámetro | Tipo | Obligatorio | Por defecto |
|---|---|---|---|
| `product_id` | entero | sí | |
| `market_id` | entero | sí | |
| `from` | fecha | no | `to` menos 156 semanas (3 años) |
| `to` | fecha | no | última semana con datos del par |

Serie semanal del producto en el mercado, de la más antigua a la más reciente. Las semanas sin boletín no aparecen
(no se rellenan).

```json
{
  "product_id": 1, "product_name": "Papa parda pastusa", "market_id": 1, "market_name": "Bogotá, D.C., Corabastos",
  "unit": "kg", "from": "2023-11-13", "to": "2026-11-09",
  "series": [{"week_start": "2023-11-13", "mean_price": 2066, "min_price": 1800, "max_price": 2300}]
}
```

Errores: 404 si el producto o el mercado no existen; 422 si una fecha es inválida o `from` es posterior a `to`.

### GET /api/prices/seasonality

| Parámetro | Tipo | Obligatorio |
|---|---|---|
| `product_id` | entero | sí |
| `market_id` | entero | sí |

Índice de precio por mes: 100 es el promedio del año, 112 significa que ese mes suele estar 12 % por encima. Cálculo:

1. Cada semana pertenece al mes de su jueves.
2. Para cada año desde 2016 **con los 12 meses**, se divide el precio medio de cada mes por el promedio de los 12
   precios medios mensuales de ese año. Los años incompletos (por ejemplo el año en curso) se dejan fuera, porque los
   meses que faltan sesgarían su promedio anual.
3. El índice de cada mes es el promedio de esas razones en los años usados, por 100.

```json
{
  "product_id": 1, "product_name": "Papa parda pastusa", "market_id": 1, "market_name": "Bogotá, D.C., Corabastos",
  "years_used": [2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025],
  "months": [{"month": 1, "month_name": "enero", "index": 104.3}, {"month": 2, "month_name": "febrero", "index": 101.2}],
  "cheapest_month": "septiembre", "most_expensive_month": "abril", "message": null
}
```

Si no hay ningún año completo, `months` está vacío y `message` lo explica. Errores: 404 si el producto o el mercado no
existen.

### GET /api/supply/origins

| Parámetro | Tipo | Obligatorio |
|---|---|---|
| `product_id` | entero | sí |
| `market_id` | entero | no; sin él se suman todos los mercados foco |

De dónde viene el producto en las últimas 52 semanas con datos de abastecimiento: kilogramos y participación por
departamento de origen, los 10 municipios que más aportan y la parte importada. Las participaciones son sobre el total,
importaciones incluidas, así que departamentos más importado suman 100 %. El abastecimiento se publica con rezago, así
que la ventana termina en la última semana publicada (`last_week_start`), no en la última semana de precios.

```json
{
  "product_id": 1, "product_name": "Papa parda pastusa", "market_id": 1, "market_name": "Bogotá, D.C., Corabastos",
  "first_week_start": "2025-11-10", "last_week_start": "2026-11-02", "total_kg": 4790900,
  "departments": [{"code": "25", "name": "CUNDINAMARCA", "kg": 4000300, "share_pct": 83.5}],
  "municipalities": [{"code": "25873", "name": "VILLAPINZÓN", "department": "CUNDINAMARCA", "kg": 971000,
                      "share_pct": 20.3}],
  "imported_kg": 0, "imported_share_pct": 0.0, "message": null
}
```

Sin datos (por ejemplo Mora de Castilla, que el DANE no publica en abastecimiento, o Cartago y Chiquinquirá, que no
son mercados del componente de abastecimiento) la respuesta es 200 con `total_kg = 0`, listas vacías y:

```json
{"message": "No hay datos de abastecimiento de Mora de Castilla en Bogotá, D.C., Corabastos en las últimas 52 semanas."}
```

Errores: 404 si el producto o el mercado no existen.

### GET /api/forecasts

| Parámetro | Tipo | Obligatorio |
|---|---|---|
| `product_id` | entero | sí |
| `market_id` | entero | no; sin él se devuelven todos los mercados utilizables del producto |

Pronósticos más recientes a 1, 2, 3 y 4 semanas con su intervalo del 80 % y el último precio observado (el de la
semana de origen) como referencia.

```json
{
  "product_id": 1, "product_name": "Papa parda pastusa", "unit": "kg", "model_version": "lightgbm-202611160849",
  "markets": [
    {"market_id": 1, "market_name": "Bogotá, D.C., Corabastos", "city": "Bogotá",
     "comparable_group": "papa-parda-pastusa|kg", "origin_iso_year": 2026, "origin_iso_week": 46,
     "origin_week_start": "2026-11-09", "last_observed_price": 3063,
     "forecasts": [
       {"horizon": 1, "target_iso_year": 2026, "target_iso_week": 47, "target_week_start": "2026-11-16",
        "predicted_price": 3021, "lower_price": 2568, "upper_price": 3543}
     ]}
  ],
  "message": null
}
```

Si el mercado existe pero no tiene pronóstico (par no utilizable), `markets` está vacío y `message` lo explica.
Errores: 404 si el producto o el mercado no existen.

### GET /api/recommendations

| Parámetro | Tipo | Obligatorio | Por defecto |
|---|---|---|---|
| `product_id` | entero | sí | |
| `horizon` | entero de 1 a 4 | no | 2 |

Dentro de cada grupo comparable del producto, el mercado con el pronóstico más bajo (dónde comprar) y el más alto
(dónde vender) para ese horizonte, la diferencia en pesos por kilogramo y en porcentaje sobre el precio de compra, y
la confianza:

- `"alta"`: los intervalos del 80 % de los dos mercados no se tocan (el límite superior del más barato está por debajo
  del límite inferior del más caro).
- `"baja"`: los intervalos se solapan; la diferencia puede no darse.

Solo se incluyen grupos con al menos dos mercados con pronóstico. La nota sobre costos se incluye siempre.

```json
{
  "product_id": 1, "product_name": "Papa parda pastusa", "horizon": 2, "unit": "kg",
  "groups": [
    {"comparable_group": "papa-parda-pastusa|kg", "markets_compared": 6,
     "buy": {"market_id": 6, "market_name": "Pereira, Mercasa", "city": "Pereira", "target_iso_year": 2026,
             "target_iso_week": 48, "target_week_start": "2026-11-23", "predicted_price": 2254,
             "lower_price": 1777, "upper_price": 2769},
     "sell": {"market_id": 8, "market_name": "Cartago (Valle del Cauca)", "city": "Cartago", "target_iso_year": 2026,
              "target_iso_week": 48, "target_week_start": "2026-11-23", "predicted_price": 3355,
              "lower_price": 2645, "upper_price": 4120},
     "difference_per_kg": 1101, "difference_pct": 48.8, "confidence": "baja"}
  ],
  "message": null,
  "note": "Las diferencias no incluyen costos de transporte ni de intermediación entre mercados. Los precios son pronósticos del precio mayorista medio con un intervalo del 80 %."
}
```

Errores: 404 si el producto no existe; 422 si `horizon` no es un entero entre 1 y 4.

### GET /api/model/summary

Resumen del modelo para la página de transparencia, leído de `models/metadata.json`: modelo elegido y regla de
elección, fechas de entrenamiento, validación y prueba, métricas de prueba de todos los modelos (`overall`, ordenadas
por MAPE), comparación por horizonte entre el modelo elegido y el ingenuo, precisión direccional, cobertura real de los
intervalos frente al 80 % nominal y las 5 variables más importantes. `skill_*_pct` es la mejora sobre el ingenuo en
porcentaje. La precisión direccional del ingenuo es `null` porque nunca predice un cambio.

```json
{
  "model_type": "lightgbm", "model_label": "LightGBM", "model_version": "lightgbm-202611160849",
  "created_at": "2026-11-16T08:49:22", "target": "log(price[t+h] / price[t])", "horizons": [1, 2, 3, 4],
  "splits": {"train": {"start": "2017-01-02", "end": "2024-11-17", "start_iso": "2017-W01", "end_iso": "2024-W46"}},
  "fitted_on": "train + validation",
  "selection_rule": "Menor MAPE de validación promediado sobre los horizontes.",
  "overall": [{"model": "lightgbm", "label": "LightGBM", "mae": 496, "mape_pct": 14.0,
               "directional_accuracy_pct": 60.5, "skill_mae_pct": 7.2, "skill_mape_pct": 6.1}],
  "by_horizon": [{"horizon": 1,
                  "model": {"mae": 346, "mape_pct": 9.7, "directional_accuracy_pct": 58.9, "skill_mae_pct": 4.3,
                            "skill_mape_pct": 3.6},
                  "naive": {"mae": 362, "mape_pct": 10.1, "directional_accuracy_pct": null, "skill_mae_pct": 0.0,
                            "skill_mape_pct": 0.0}}],
  "interval_nominal_pct": 80,
  "interval_coverage": [{"horizon": 1, "coverage_pct": 82.2}],
  "interval_coverage_overall_pct": 81.6,
  "importance_kind": "Ganancia de LightGBM",
  "top_features": [{"feature": "price_vs_ma_52w", "label": "Precio vs. media 52 sem.", "importance_pct": 30.2,
                    "permutation_mae_increase": 0.02887}]
}
```

Errores: 404 si todavía no hay modelo entrenado (`"El modelo todavía no se ha entrenado: no hay metadatos en la
carpeta models/."`).

## Estructura del código

Cada dominio con endpoints tiene `router.py` (solo HTTP), `service.py` (lógica), `repository.py` (consultas SQL) y
`schemas.py` (modelos de respuesta de pydantic), en `backend/app/domains/{catalog,prices,supply,forecasting,
recommendations}`. Lo compartido está en `backend/app/core`: configuración (`config.py`), sesión de base de datos como
dependencia de FastAPI (`database.py`) y manejadores de errores (`errors.py`). La aplicación se crea en
`backend/app/main.py` (`create_app`). `/api/health` está en el router de precios porque informa la última semana de
precios.

Pruebas: `backend/tests/test_api.py` construye una base diminuta en un directorio temporal (2 productos, 3 mercados,
precios semanales sintéticos desde 2016, algunas filas de abastecimiento y pronósticos) y nunca usa la base real.
