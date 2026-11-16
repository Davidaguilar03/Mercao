# Mercao

Proyecto de grado (Inteligencia Computacional, UPTC). Aplicación web que convierte los datos oficiales de precios mayoristas de alimentos de Colombia (DANE SIPSA) en información útil: comparación de precios entre centrales mayoristas, origen y estacionalidad de los productos, y pronóstico de precios a 1–4 semanas.

## Etapa actual

Solo exploración de datos.

## Instalación

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python scripts/download_sipsa.py   # descarga los archivos del DANE en data/raw
python scripts/explore_sipsa.py    # genera docs/data_exploration.md y docs/figures
```
