<p align="center">
  <img src="frontend/src/assets/brand/logo.png" alt="Mercao" width="220" />
</p>

# Mercao

**Precios de plaza, claros.** El DANE publica cada semana los precios mayoristas de alimentos de Colombia (SIPSA),
pero en hojas de cálculo con formatos que cambian de un año a otro y que nadie consulta con facilidad. Mercao convierte
esos archivos en una aplicación web: compara el precio de un producto entre las centrales mayoristas del país, muestra
de dónde llega y en qué meses suele estar más barato, y pronostica su precio de 1 a 4 semanas con aprendizaje
automático, siempre con el rango de error a la vista.

## Contenido

- [Funcionalidades](#funcionalidades)
- [Fuente de datos y conjunto foco](#fuente-de-datos-y-conjunto-foco)
- [Arquitectura](#arquitectura)
- [Requisitos](#requisitos)
- [Inicio rápido (proyecto entregado)](#inicio-rápido-proyecto-entregado)
- [Modo de desarrollo](#modo-de-desarrollo)
- [Reconstrucción completa](#reconstrucción-completa)
- [Pruebas y calidad](#pruebas-y-calidad)
- [Estructura del proyecto](#estructura-del-proyecto)
- [Resultados del modelo y limitaciones](#resultados-del-modelo-y-limitaciones)
- [Documentación](#documentación)
- [Autores](#autores)

## Funcionalidades

| Vista | Dirección | Qué muestra |
|---|---|---|
| Panorama | `/` | Un producto en todo el país: una frase que resume la semana, un mapa con las plazas marcadas como más baratas, parecidas o más caras que la mayoría, una tabla de plazas ordenada por precio (cambio frente a hace 4 semanas y un año, y pronóstico a 2 semanas) y de qué departamentos viene el producto. |
| Producto | `/producto` | Un producto en una plaza: cuatro cifras clave, la gráfica del precio semana a semana con el pronóstico y su rango probable, los meses en que suele estar más barato y más caro, y los departamentos y municipios de origen. |
| Oportunidades | `/oportunidades` | Dónde comprar y dónde vender de 1 a 4 semanas adelante: las dos plazas con su precio esperado y una minigráfica de 12 semanas, la diferencia por kilo, la distancia aproximada, qué tan confiable es esa diferencia y la lista de todas las plazas. No incluye transporte, almacenamiento ni intermediación. |
| Cómo funciona | `/como-funciona` | El camino de los datos del boletín del DANE al pronóstico, los resultados del modelo, la comparación de los modelos probados y lo que Mercao no hace. |

Lo que se elige queda en la dirección para compartir el enlace: `producto`, `horizonte` (1 a 4 semanas) y `plaza`
(solo en Producto). Por ejemplo, `/oportunidades?producto=3&horizonte=4`. Un precio que sube se muestra en verde con
flecha hacia arriba y uno que baja en rojo con flecha hacia abajo. El mapa usa imágenes de OpenStreetMap y necesita
internet; sin conexión, las plazas se siguen viendo con su nombre y la tabla trae la misma información.

## Fuente de datos y conjunto foco

Todos los datos vienen del Sistema de Información de Precios y Abastecimiento del Sector Agropecuario (SIPSA) del
DANE: los anexos de los boletines semanales de precios mayoristas (2012 a 2026, 729 archivos) y los microdatos anuales
de abastecimiento (2013 a 2026, 14 archivos). Precios en pesos colombianos por kilogramo, por semana ISO.

La aplicación trabaja con un conjunto foco definido en `backend/app/domains/catalog/focus.py`:

- **13 productos**: papa parda pastusa, cebolla cabezona blanca, cebolla junca, cebolla junca Aquitania, tomate
  chonto, zanahoria, habichuela, arveja verde en vaina, plátano hartón verde, cilantro, mora de Castilla, lulo y
  pimentón.
- **11 mercados**: Bogotá (Corabastos), Medellín (Central Mayorista de Antioquia), Cali (Cavasa), Barranquilla
  (Barranquillita), Bucaramanga (Centroabastos), Pereira (Mercasa), Armenia (Mercar), Cartago, Chiquinquirá, Tunja
  (Complejo de Servicios del Sur) e Ibagué (Plaza La 21).

Los criterios de elección y las reglas de limpieza están en [docs/data_pipeline.md](docs/data_pipeline.md).

## Arquitectura

```
Archivos del DANE (SIPSA)          páginas de boletines semanales y microdatos de abastecimiento
        │  download_raw
        ▼
data/raw/                          hojas de cálculo originales y manifest.csv
        │  build_database          lectura con caché, catálogo, limpieza, semanas ISO, cobertura, abastecimiento
        ▼
data/processed/mercao.db           SQLite: precios, abastecimiento, catálogo, cobertura, pronósticos
        │  train_models            conjunto de datos, validación temporal, 5 modelos, intervalos
        ▼
models/                            modelos LightGBM por horizonte y metadata.json
        │  generate_forecasts      tabla forecasts en mercao.db
        ▼
API FastAPI (/api, solo lectura)   lee mercao.db y models/metadata.json
        │
        ▼
Frontend React (Vite)              Panorama, Producto, Oportunidades y Cómo funciona
```

El backend está organizado por dominio en `backend/app/domains/`. Cada dominio con endpoints tiene `router.py` (solo
HTTP), `service.py` (lógica), `repository.py` (consultas SQL) y `schemas.py` (respuestas):

| Dominio | Responsabilidad |
|---|---|
| `ingestion` | Descarga y lectura de los archivos del DANE, caché de archivos leídos |
| `catalog` | Productos, mercados, ciudades y equivalencias de nombres (CSV en `data/`) |
| `prices` | Precios semanales, reglas de limpieza, cobertura y estacionalidad |
| `supply` | Abastecimiento por origen y agregado semanal |
| `forecasting` | Conjunto de datos, modelos, entrenamiento, tabla `forecasts` y resumen del modelo |
| `recommendations` | Dónde comprar y dónde vender según los pronósticos |

Lo compartido (configuración, base de datos, errores y logging) está en `backend/app/core/`. Con el frontend
compilado en `frontend/dist`, la misma API lo sirve en http://localhost:8000, así que la aplicación completa corre con
un solo comando.

## Requisitos

- **Python 3.12 o superior** (probado con 3.14).
- **Node.js 22 o superior**, opcional: solo hace falta para compilar el frontend o trabajar en él. Si el proyecto ya
  trae `frontend/dist`, no se necesita.
- Windows con PowerShell para los scripts `setup.ps1` y `start.ps1`. En otros sistemas se usan los comandos manuales.

## Inicio rápido (proyecto entregado)

El proyecto entregado incluye la base de datos (`data/processed/mercao.db`) y los modelos entrenados (`models/`). Desde
la raíz del proyecto, en PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File .\setup.ps1   # entorno de Python, dependencias y frontend compilado
powershell -ExecutionPolicy Bypass -File .\start.ps1   # inicia Mercao
```

Luego abra http://localhost:8000. La documentación interactiva de la API queda en http://localhost:8000/docs. Para
detener el servidor, presione Ctrl+C.

`setup.ps1` crea `.venv` si no existe, instala `requirements.txt` (solo si cambió) y, si Node.js está instalado,
ejecuta `npm install` y `npm run build` en `frontend/` (solo si hace falta). `start.ps1` revisa que existan la base y
los modelos, explica cómo obtenerlos si faltan, e inicia el servidor.

### Sin los scripts

Los mismos pasos a mano, desde la raíz del proyecto:

```powershell
python -m venv .venv
.venv\Scripts\python -m pip install -r requirements.txt
cd frontend
npm install
npm run build
cd ..
.venv\Scripts\python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000
```

En Linux o macOS, la ruta del intérprete es `.venv/bin/python`.

## Modo de desarrollo

Para trabajar en el código se usan dos terminales: la API con recarga automática y el servidor de desarrollo de Vite.
No dependen de ningún editor.

```powershell
.venv\Scripts\python -m pip install -r requirements-dev.txt   # incluye pruebas y revisión de código

# Terminal 1, desde la raíz
.venv\Scripts\python -m uvicorn backend.app.main:app --reload

# Terminal 2
cd frontend
npm run dev
```

El frontend queda en http://localhost:5173 y consulta la API en http://localhost:8000. La API acepta por defecto los
orígenes de `npm run dev` (5173) y `npm run preview` (4173).

### Configuración

Backend (variables de entorno, todas opcionales):

| Variable | Por defecto | Para qué sirve |
|---|---|---|
| `MERCAO_DATA_DIR` | `data` | Carpeta de datos (`raw`, `interim`, `processed`) |
| `MERCAO_DATABASE_URL` | `data/processed/mercao.db` | Otra base de datos (URL de SQLAlchemy) |
| `MERCAO_MODELS_DIR` | `models` | Carpeta de los modelos entrenados |
| `MERCAO_FRONTEND_DIST` | `frontend/dist` | Frontend compilado que sirve la API |
| `MERCAO_CORS_ORIGINS` | `http://localhost:5173,http://localhost:4173` | Orígenes permitidos, separados por comas |
| `MERCAO_PRICES_WORKERS` | `6` | Procesos en paralelo para leer los anexos de precios |
| `MERCAO_SUPPLY_WORKERS` | `2` | Procesos en paralelo para leer los microdatos de abastecimiento |

Frontend (`frontend/.env`, a partir de `frontend/.env.example`):

| Variable | Por defecto | Para qué sirve |
|---|---|---|
| `VITE_API_URL` | `http://localhost:8000` en `npm run dev`; rutas relativas (`/api`) en la versión compilada | Dirección base de la API. Vacía (`VITE_API_URL=`) usa siempre rutas relativas, que Vite reenvía a `http://localhost:8000` en `npm run dev` y `npm run preview`. |

## Reconstrucción completa

Para regenerar todo desde los archivos del DANE (con el entorno de desarrollo instalado), desde la raíz:

| Paso | Comando | Tiempo aproximado |
|---|---|---|
| 1. Descargar los archivos del DANE en `data/raw` (unos 755 archivos, 1,5 GB; omite los ya descargados) | `.venv\Scripts\python -m backend.scripts.download_raw` | 20 a 40 min, según la conexión |
| 2. Construir `data/processed/mercao.db` | `.venv\Scripts\python -m backend.scripts.build_database` | 11 min la primera vez; 4 min con la caché de `data/interim` |
| 3. Entrenar y evaluar los modelos, guardar el final en `models/` y las figuras en `docs/figures/` | `.venv\Scripts\python -m backend.scripts.train_models` | 3 min |
| 4. Generar la tabla `forecasts` | `.venv\Scripts\python -m backend.scripts.generate_forecasts` | menos de 1 min |

`build_database` reemplaza el archivo de la base y, si ya hay modelos en `models/`, regenera la tabla `forecasts` al
terminar; si no los hay, ejecute los pasos 3 y 4. El log de cada construcción queda en `data/processed/pipeline.log` y
un resumen en `data/processed/build_summary.json`. Para cambiar el conjunto foco, edite `focus.py` y ejecute
`python -m backend.scripts.generate_catalog` antes del paso 2.

## Pruebas y calidad

Backend, desde la raíz (requiere `requirements-dev.txt`):

```powershell
.venv\Scripts\python -m pytest          # pruebas con muestras pequeñas; nunca usa la base real
.venv\Scripts\python -m ruff check backend
```

Frontend, dentro de `frontend/`:

| Comando | Qué hace |
|---|---|
| `npm run lint` | Revisa el código con ESLint |
| `npm run typecheck` | Revisa los tipos con TypeScript |
| `npm run format:check` | Verifica el formato con Prettier (`npm run format` lo corrige) |
| `npm test` | Ejecuta las pruebas (Vitest y React Testing Library) |
| `npm run build` | Genera la versión de producción en `frontend/dist` |
| `npm run preview` | Sirve la versión compilada en http://localhost:4173 |

## Estructura del proyecto

```
backend/
  app/
    core/            configuración, base de datos, errores y logging
    domains/         un paquete por dominio (ver Arquitectura)
    main.py          aplicación FastAPI: API bajo /api y frontend compilado
    pipeline.py      orquesta la construcción de la base
  scripts/           comandos: descarga, construcción, catálogo, entrenamiento y pronósticos
  tests/             pruebas con muestras pequeñas en tests/fixtures
data/                raw, interim y processed (no versionado; processed se incluye en la entrega)
docs/                documentación técnica y figuras
frontend/
  public/            favicon, íconos y manifiesto web
  src/
    api/             cliente HTTP, tipos y hooks de TanStack Query por dominio
    assets/brand/    logo
    components/      componentes compartidos y estructura de la página
    hooks/           selección en la URL y tamaño de pantalla
    lib/             formato de cifras y fechas, análisis de precios, tema de las gráficas
    pages/           una carpeta por vista
    styles/          tokens de diseño y estilos globales
    test/            configuración y datos de las pruebas
models/              modelos entrenados y metadata.json (no versionado; se incluye en la entrega)
setup.ps1            prepara el entorno en Windows
start.ps1            inicia Mercao en http://localhost:8000
```

## Resultados del modelo y limitaciones

El modelo elegido es **LightGBM**, uno por horizonte, que pronostica el log-cambio del precio de cada par
producto-mercado. Se comparó con el pronóstico ingenuo (el precio de esta semana), el ingenuo estacional, Ridge y
Random Forest, con validación temporal: entrenamiento hasta 2024-W46, validación de 2024-W47 a 2025-W46 y prueba de
2025-W47 a 2026-W46.

| Métrica (prueba, 4 horizontes) | Resultado |
|---|---|
| MAPE de LightGBM frente al ingenuo | 13,98 % contra 14,88 %: 6,1 % menos error |
| MAE de LightGBM frente al ingenuo | 495,7 contra 533,9 pesos/kg: 7,2 % menos error |
| Mejora de MAPE por horizonte (1 a 4 semanas) | 3,6 %, 5,9 %, 7,2 % y 6,6 % |
| Precisión direccional (semanas con cambio de al menos 1 %) | 60,5 % |
| Cobertura del intervalo del 80 % | 81,6 % |

Limitaciones principales: la mejora sobre el ingenuo es modesta y el modelo es peor que él en 4 de los 13 productos
(zanahoria, arveja verde en vaina, papa parda pastusa y mora de Castilla); los resultados vienen de un solo año de
prueba; los intervalos son iguales para todos los pares; no se usan variables externas como clima o tasa de cambio; y
las recomendaciones no incluyen costos de transporte, almacenamiento ni intermediación. El detalle está en
[docs/forecasting_model.md](docs/forecasting_model.md).

## Documentación

| Documento | Contenido |
|---|---|
| [docs/data_exploration.md](docs/data_exploration.md) | Exploración inicial de los archivos SIPSA: formatos por año, productos, mercados, calidad y elección del conjunto foco |
| [docs/data_pipeline.md](docs/data_pipeline.md) | Construcción de la base: fuentes, pasos, reglas de limpieza, catálogo, cobertura y esquema de tablas |
| [docs/forecasting_model.md](docs/forecasting_model.md) | Modelo de pronóstico: objetivo, variables, validación, resultados, intervalos, importancia y limitaciones |
| [docs/api.md](docs/api.md) | API REST: convenciones, errores, endpoints con ejemplos y servicio del frontend compilado |
| [docs/brand.md](docs/brand.md) | Marca: logo, paleta, ilustración, tipografía, espacios y tono de voz |

## Autores

- David Aguilar Castillo
- Valeria Tocarruncho Mosquera
- Andrés Santiago Daza Quintana
- Oscar Alejandro Roa Doncel

Inteligencia Computacional, Universidad Pedagógica y Tecnológica de Colombia, 2026.
