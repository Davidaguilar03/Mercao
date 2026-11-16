# Mercao

Proyecto de grado (Inteligencia Computacional, UPTC). Aplicación web que convierte los datos oficiales de precios mayoristas de alimentos de Colombia (DANE SIPSA) en información útil: comparación de precios entre centrales mayoristas, origen y estacionalidad de los productos, y pronóstico de precios a 1–4 semanas.

## Etapa actual

Pipeline de datos, modelo de pronóstico, API REST de solo lectura y la base del frontend. Los archivos crudos del DANE
se convierten en tablas limpias en una base SQLite (`data/processed/mercao.db`), sobre la que se entrena el modelo y
que expone la API. El frontend ya tiene la marca, la navegación, la capa de API, los componentes compartidos y la
página Cómo funciona; las vistas Panorama, Producto y Oportunidades se construyen en la siguiente etapa.

- Exploración inicial de los datos: [docs/data_exploration.md](docs/data_exploration.md)
- Pipeline, reglas de limpieza y esquema de tablas: [docs/data_pipeline.md](docs/data_pipeline.md)
- Modelo de pronóstico: [docs/forecasting_model.md](docs/forecasting_model.md)
- API REST: [docs/api.md](docs/api.md)
- Marca (logo, colores, tipografía y tono de voz): [docs/brand.md](docs/brand.md)

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
frontend/
  public/                 favicon, íconos y manifiesto web
  src/
    api/                  cliente HTTP, tipos de las respuestas y hooks de TanStack Query por dominio
    assets/brand/         logo
    components/           componentes compartidos y estructura de la página (encabezado y pie)
    hooks/                producto seleccionado en la URL
    lib/                  formato de pesos, porcentajes y fechas
    pages/                una página por ruta
    styles/               tokens de diseño y estilos globales
    test/                 configuración y datos de las pruebas
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

## Frontend

Aplicación web en `frontend/` (Vite, React y TypeScript). Requiere Node.js 22 o superior.

```bash
cd frontend
npm install
```

Para trabajar se necesitan dos terminales: una con la API y otra con el servidor de desarrollo del frontend.

```bash
# Terminal 1, desde la raíz del repositorio
uvicorn backend.app.main:app --reload

# Terminal 2
cd frontend
npm run dev
```

La aplicación queda en http://localhost:5173 y consulta la API en http://localhost:8000.

### Variables de entorno del frontend

Se definen en `frontend/.env` (copie `frontend/.env.example`).

| Variable | Por defecto | Para qué sirve |
|---|---|---|
| `VITE_API_URL` | `http://localhost:8000` | Dirección base de la API. Si se deja vacía (`VITE_API_URL=`), el frontend usa rutas relativas (`/api/...`) y el servidor de desarrollo las reenvía a `http://localhost:8000`. |

Si el frontend corre en otro puerto o dominio, permita ese origen en la API con `MERCAO_CORS_ORIGINS`.

### Comandos del frontend

Se ejecutan dentro de `frontend/`.

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo con recarga automática |
| `npm run build` | Revisa los tipos y genera la versión de producción en `frontend/dist` |
| `npm run preview` | Sirve la versión de producción ya generada |
| `npm run lint` | Revisa el código con ESLint |
| `npm run typecheck` | Revisa los tipos con TypeScript |
| `npm run format` | Da formato al código con Prettier |
| `npm run format:check` | Verifica el formato sin cambiar archivos |
| `npm test` | Ejecuta las pruebas una vez (Vitest y React Testing Library) |
| `npm run test:watch` | Ejecuta las pruebas y las repite al guardar cambios |

## Pruebas

```bash
python -m pytest                 # backend, desde la raíz
npm test                         # frontend, dentro de frontend/
```
