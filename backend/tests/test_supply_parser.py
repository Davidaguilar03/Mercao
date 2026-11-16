from datetime import date
from pathlib import Path

import pandas as pd

from backend.app.domains.ingestion.supply_microdata import parse_supply_file, parse_text_date
from backend.app.domains.supply.builder import aggregate_supply, origin_lookups, resolve_origins, weekly_totals
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


def test_origin_codes_come_from_divipola(fixtures_dir: Path) -> None:
    frame, _ = parse_supply_file(fixtures_dir / "supply_2020_sample.xlsx")
    origins, fixes = resolve_origins(frame)

    assert origins.loc[1, "origin_department_code"] == "52"  # published as CUNDINAMARCA with code 52
    assert origins.loc[1, "origin_municipality_code"] == "52356"
    assert origins.loc[2, "origin_department_code"] == "11"
    assert origins.loc[3, "origin_country"] == "CHILE"
    assert pd.isna(origins.loc[3, "origin_department_code"])
    assert fixes["department_name_fixed"] == 1  # "BOGOTÁ, D. C." only differs in spacing
    assert fixes["foreign"] == 1


def test_lookup_tables_hold_the_names() -> None:
    departments, municipalities = origin_lookups({"52356": "IPIALES", "11001": "BOGOTÁ, D.C.", "n.a.": "CHILE"})

    assert departments.set_index("code").loc["52", "name"] == "NARIÑO"
    assert len(departments) == 33
    assert municipalities.to_dict("records") == [
        {"code": "11001", "name": "BOGOTÁ, D.C.", "department_code": "11"},
        {"code": "52356", "name": "IPIALES", "department_code": "52"},
    ]


def test_supply_is_summed_by_iso_week_and_origin() -> None:
    rows = pd.DataFrame({
        "date": pd.to_datetime(["2025-02-10", "2025-02-16", "2025-02-12", "2025-02-17", "2025-02-11"]),
        "market_id": [1, 1, 1, 1, 1],
        "product_id": [1, 1, 1, 1, 1],
        "origin_department_code": ["52", "52", "15", "52", None],
        "origin_municipality_code": ["52356", "52356", "15001", "52356", None],
        "origin_country": ["COLOMBIA", "COLOMBIA", "COLOMBIA", "COLOMBIA", "ECUADOR"],
        "quantity_kg": [100.0, 50.0, 30.0, 10.0, 5.0],
    })
    supply = aggregate_supply(rows)
    week7 = supply[supply["iso_week"] == 7].set_index("origin_country", append=True)

    assert len(supply) == 4  # week 7: Ipiales, Tunja, Ecuador; week 8: Ipiales
    assert supply.loc[(supply["iso_week"] == 7) & (supply["origin_municipality_code"] == "52356"),
                      "quantity_kg"].item() == 150.0
    assert supply.loc[supply["origin_country"] == "ECUADOR", "origin_municipality_code"].isna().all()
    assert len(week7) == 3

    weekly = weekly_totals(supply)
    assert weekly[["iso_year", "iso_week", "quantity_kg"]].values.tolist() == [[2025, 7, 185.0], [2025, 8, 10.0]]


def test_resolve_origin_iso_country_codes() -> None:
    assert resolve_origin("n.a.", "152", "CHILE") == (None, None, "CHILE")
    assert resolve_origin("n.a.", "170", "COLOMBIA") == (None, None, "COLOMBIA")
    assert resolve_origin("5", "05001", "MEDELLÍN") == ("05", "05001", "COLOMBIA")
