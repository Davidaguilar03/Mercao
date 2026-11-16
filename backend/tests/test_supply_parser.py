from datetime import date
from pathlib import Path

import pandas as pd

from backend.app.domains.ingestion.supply_microdata import parse_supply_file, parse_text_date
from backend.app.domains.supply.builder import resolve_origins
from backend.app.domains.supply.divipola import resolve_origin


def test_text_dates_are_day_first() -> None:
    assert parse_text_date("02/01/20") == date(2020, 1, 2)
    assert parse_text_date("31/12/2020") == date(2020, 12, 31)
    assert parse_text_date("Fuente: DANE") is None


def test_supply_sample_with_text_dates(fixtures_dir: Path) -> None:
    frame, meta = parse_supply_file(fixtures_dir / "supply_2020_sample.xlsx")

    assert meta["text_date_rows"] == 5
    assert meta["non_positive_qty_rows"] == 1
    assert meta["bad_date_rows"] == 1  # the footnote row
    assert len(frame) == 4
    assert frame["date"].min() == pd.Timestamp("2020-01-02")
    assert frame["date"].max() == pd.Timestamp("2020-12-31")
    assert frame.loc[0, "dept_code"] == "52"  # leading apostrophe removed
    assert frame["quantity_kg"].sum() == 3000 + 1500 + 250.5 + 800


def test_department_name_comes_from_the_code(fixtures_dir: Path) -> None:
    frame, _ = parse_supply_file(fixtures_dir / "supply_2020_sample.xlsx")
    origins, fixes = resolve_origins(frame, {"52356": "IPIALES", "52838": "TÚQUERRES", "11001": "BOGOTÁ, D.C."})

    assert origins.loc[1, "origin_department_name"] == "NARIÑO"  # published as CUNDINAMARCA with code 52
    assert origins.loc[1, "origin_municipality_name"] == "IPIALES"
    assert origins.loc[2, "origin_department_name"] == "BOGOTÁ, D.C."
    assert origins.loc[3, "origin_country"] == "CHILE"
    assert pd.isna(origins.loc[3, "origin_department_code"])
    assert fixes["department_name_fixed"] == 1  # "BOGOTÁ, D. C." only differs in spacing
    assert fixes["foreign"] == 1


def test_resolve_origin_iso_country_codes() -> None:
    assert resolve_origin("n.a.", "152", "CHILE") == (None, None, "CHILE")
    assert resolve_origin("n.a.", "170", "COLOMBIA") == (None, None, "COLOMBIA")
    assert resolve_origin("5", "05001", "MEDELLÍN") == ("05", "05001", "COLOMBIA")
