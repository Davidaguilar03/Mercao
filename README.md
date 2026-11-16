# Mercao

Proyecto de grado (Inteligencia Computacional, UPTC). Aplicación web que convierte los datos oficiales de precios mayoristas de alimentos de Colombia (DANE SIPSA) en información útil: comparación de precios entre centrales mayoristas, origen y estacionalidad de los productos, y pronóstico de precios a 1–4 semanas.

## Etapa actual

Pipeline de datos, modelo de pronóstico y API REST de solo lectura. Los archivos crudos del DANE se convierten en
tablas limpias en una base SQLite (`data/processed/mercao.db`), sobre la que se entrena el modelo y que expone la API.
Todavía no hay frontend.

- Exploración inicial de los datos: [docs/data_exploration.md](docs/data_exploration.md)
- Pipeline, reglas de limpieza y esquema de tablas: [docs/data_pipeline.md](docs/data_pipeline.md)
- Modelo de pronóstico: [docs/forecasting_model.md](docs/forecasting_model.md)
- API REST: [docs/api.md](docs/api.md)

## Estructura

```
backend/
  app/
    core/                 configuración, rutas, logging, sesión de base de datos y manejo de errores
    domains/
      ingestion/          descarga y lectura de los archivos del DANE
      catalog/            productos, variedades, mercados y equivalencias de nombres (CSV en data/)
                          (los dominios con endpoints tienen router.py, service.py, repository.py y schemas.py)
      prices/             precios semanales, exclusiones y cobertura
      supply/             abastecimiento por origen y agregado semanal
      forecasting/        conjunto de datos, modelos de pronóstico, tabla forecasts y resumen del modelo
      recommendations/    dónde comprar y dónde vender según los pronósticos
    main.py               aplicación FastAPI (rutas bajo /api)
    pipeline.py           orquesta la construcción de la base
  scripts/                comandos de línea
  tests/                  pruebas con muestras pequeñas en tests/fixtures
data/
  raw/                    archivos descargados (no versionado)
  interim/                caché de archivos ya leídos (no versionado)
  processed/              mercao.db y logs del pipeline (no versionado)
docs/
```

## Instalación

Requiere Python 3.12 o superior.

```bash
python -m venv .venv
.venv\Scripts\activate            # en Linux/macOS: source .venv/bin/activate
pip install -r requirements-dev.txt
```

## Reconstruir la base de datos

Todos los comandos se ejecutan desde la raíz del repositorio.

```bash
python -m backend.scripts.download_raw        # descarga los archivos del DANE en data/raw (omite los ya descargados)
python -m backend.scripts.build_database      # reconstruye data/processed/mercao.db
```

La primera construcción lee unos 1,2 GB de hojas de cálculo y tarda unos 11 minutos. Los archivos ya leídos quedan en
caché en `data/interim/pipeline` (el abastecimiento completo, en parquet), así que una reconstrucción solo vuelve a
leer los archivos que cambiaron y tarda unos 4 minutos. La base resultante ocupa unos 400 MB: el abastecimiento se
guarda solo para el conjunto foco, agregado por semana ISO y origen. Para forzar
una lectura completa, borre esa carpeta. El log de cada construcción queda en `data/processed/pipeline.log` y un
resumen con los conteos en `data/processed/build_summary.json`.

En precios se cargan todos los productos y mercados publicados, pero solo el conjunto foco
(`backend/app/domains/catalog/focus.py`: 13 productos y 11 mercados) recibe `product_id` y `market_id`. En
abastecimiento, la base solo guarda el conjunto foco. Para cambiar
el conjunto foco, o si el DANE publica nuevas escrituras de un producto foco, regenere el catálogo y reconstruya la
base:

```bash
python -m backend.scripts.generate_catalog
python -m backend.scripts.build_database
```

Variables de entorno opcionales: `MERCAO_DATA_DIR` (carpeta de datos), `MERCAO_DATABASE_URL`,
`MERCAO_SUPPLY_WORKERS` y `MERCAO_PRICES_WORKERS` (procesos en paralelo para leer archivos).

## Modelo de pronóstico

```bash
python -m backend.scripts.train_models        # entrena y evalúa los modelos; guarda el final en models/ (no versionado)
python -m backend.scripts.generate_forecasts  # escribe la tabla forecasts en mercao.db
```

`build_database` reemplaza el archivo de la base, así que al terminar regenera la tabla `forecasts` con los modelos
guardados en `models/`. Si todavía no hay modelos entrenados, lo indica en el log y la tabla queda sin generar: ejecute
`train_models` y luego `generate_forecasts`. Diseño, resultados y limitaciones en `docs/forecasting_model.md`.

## API

```bash
uvicorn backend.app.main:app --reload
```

La API queda en http://localhost:8000/api y la documentación interactiva en http://localhost:8000/docs. Solo lee la
base y `models/metadata.json`; no entrena modelos ni descarga datos. Por defecto acepta peticiones del servidor de
desarrollo de Vite (`http://localhost:5173`); otros orígenes se configuran con `MERCAO_CORS_ORIGINS` (separados por
comas). Endpoints, parámetros, ejemplos y errores en `docs/api.md`.

## Pruebas

```bash
python -m pytest
```
