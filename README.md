# Mercao

Proyecto de grado (Inteligencia Computacional, UPTC). Aplicación web que convierte los datos oficiales de precios mayoristas de alimentos de Colombia (DANE SIPSA) en información útil: comparación de precios entre centrales mayoristas, origen y estacionalidad de los productos, y pronóstico de precios a 1–4 semanas.

## Etapa actual

Pipeline de datos: los archivos crudos del DANE se convierten en tablas limpias en una base SQLite
(`data/processed/mercao.db`). Todavía no hay API ni frontend.

- Exploración inicial de los datos: [docs/data_exploration.md](docs/data_exploration.md)
- Pipeline, reglas de limpieza y esquema de tablas: [docs/data_pipeline.md](docs/data_pipeline.md)

## Estructura

```
backend/
  app/
    core/                 configuración, rutas, logging y sesión de base de datos
    domains/
      ingestion/          descarga y lectura de los archivos del DANE
      catalog/            productos, variedades, mercados y equivalencias de nombres (CSV en data/)
      prices/             precios semanales, exclusiones y cobertura
      supply/             abastecimiento por origen y agregado semanal
      forecasting/        (vacío por ahora)
      recommendations/    (vacío por ahora)
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

Reconstruir la base borra la tabla `forecasts`; vuelva a ejecutar `generate_forecasts` después. Diseño, resultados y
limitaciones en `docs/forecasting_model.md`.

## Pruebas

```bash
python -m pytest
```
