"""Write the tiny spreadsheet samples used by the tests, copying the layouts of the real DANE files.

Usage: python -m backend.tests.fixtures.make_fixtures   (needs openpyxl and xlwt from requirements-dev.txt)
"""

from pathlib import Path

import openpyxl
import xlwt

FIXTURES = Path(__file__).resolve().parent

NESTED_ROWS = [
    ["Cuadro 1. Mercados mayoristas. Precios de venta de verduras y hortalizas"],
    ["Productos y mercados", "Precio mínimo", "Precio máximo", "Precio medio", "Tendencia"],
    ["Acelga"],
    ["Bogotá, D.C., Corabastos", 400, 700, 495, "-"],
    ["Tunja (Boyacá)", 900, 1000, 950, "="],
    ["Papa parda pastusa"],
    ["Bogotá, D.C., Corabastos", 1100, 1300, 1200, "+"],
    ["Cuadro 5. Mercados mayoristas. Precios de venta de huevos y lácteos"],
    ["Productos y mercados", "Precio mínimo", "Precio máximo", "Precio medio", "Tendencia"],
    ["Huevo rojo AA"],
    ["Bogotá, D.C., Corabastos", 380, 420, 400, "="],
    ["* Los precios reportados para los huevos son $/unidad."],
    ["Fuente: DANE-SIPSA"],
]

FLAT_SHEET = [
    [None, None, None, None, None, None, "Regresar al índice"],
    [None],
    ["Boletín semanal precios mayoristas - 8 al 14 de febrero de 2025"],
    [None],
    ["1.1. Verduras y hortalizas"],
    [None],
    ["Producto", "Mercado mayorista", "Pesos por kilogramo", None, None, "Tendencia*"],
    [None, None, "Precio mínimo", "Precio máximo", "Precio medio", None],
    ["Papa parda pastusa", "Bogotá, D.C., Corabastos", 1500, 1700, 1600, "+"],
    ["Papa parda pastusa", "Chiquinquirá (Boyacá)", 1400, 1500, 1450, "="],
    ["Tomate chonto", "Armenia, Mercar", 2000, 2400, 2200, "-"],
    ["Producto", "Fuente", None, None, None, None],
    ["* Tendencia: comparación con la semana anterior"],
]

SUPPLY_HEADER = ["Cuidad, Mercado Mayorista", "Fecha", "Código Departamento", "Código Municipio",
                 "Departamento Proc.", "Municipio Proc.", "Grupo", "Alimento", "Cant Kg"]
SUPPLY_ROWS = [
    ["Armenia, Mercar", "02/01/20", "'52", "'52838", "NARIÑO", "TÚQUERRES", "TUBERCULOS, RAICES Y PLATANOS",
     "Papa capira", 3000],
    ["Armenia, Mercar", "31/12/20", "'52", "'52356", "CUNDINAMARCA", "QUIPILE", "TUBERCULOS, RAICES Y PLATANOS",
     "Plátano guineo", 1500],
    ["Bogotá, D.C., Corabastos", "15/06/20", "'11", "'11001", "BOGOTÁ, D. C.", "BOGOTÁ, D.C.", "FRUTAS",
     "Mora de Castilla", 250.5],
    ["Bogotá, D.C., Corabastos", "15/06/20", "n.a.", "n.a.", "OTRO", "CHILE", "FRUTAS", "Manzana royal gala importada",
     800],
    ["Bogotá, D.C., Corabastos", "16/06/20", "'25", "'25386", "CUNDINAMARCA", "LA MESA", "FRUTAS", "Mango Tommy", 0],
    ["Fuente: DANE-SIPSA", None, None, None, None, None, None, None, None],
]


def write_nested_xls(path: Path) -> None:
    book = xlwt.Workbook(encoding="utf-8")
    sheet = book.add_sheet("Información Boletin")
    for i, row in enumerate(NESTED_ROWS):
        for j, value in enumerate(row):
            sheet.write(i, j, value)
    book.save(str(path))


def write_flat_xlsx(path: Path) -> None:
    book = openpyxl.Workbook()
    index = book.active
    index.title = "Índice"
    index.append([None, "1.1", "Verduras y hortalizas"])
    sheet = book.create_sheet("1.1")
    for row in FLAT_SHEET:
        sheet.append(row)
    book.save(path)


def write_supply_xlsx(path: Path) -> None:
    book = openpyxl.Workbook()
    book.active.title = "Índice"
    sheet = book.create_sheet("1.1")
    for _ in range(8):
        sheet.append([None])
    sheet.append(SUPPLY_HEADER)
    for row in SUPPLY_ROWS:
        sheet.append(row)
    book.save(path)


def main() -> None:
    write_nested_xls(FIXTURES / "weekly_nested_2014.xls")
    write_flat_xlsx(FIXTURES / "weekly_flat_2025.xlsx")
    write_supply_xlsx(FIXTURES / "supply_2020_sample.xlsx")


if __name__ == "__main__":
    main()
