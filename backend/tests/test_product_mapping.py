import pandas as pd
import pytest

from backend.app.domains.catalog.generator import build_market_catalog, build_product_catalog, market_location
from backend.app.domains.catalog.groups import family_and_variety, food_group

PRICE_NAMES = pd.DataFrame([
    ("Papa parda pastusa", "Tubérculos, raíces y plátanos", 900),
    ("Papa Parda Pastusa", "Tubérculos, raíces y plátanos", 100),
    ("Papa nevada", "Tubérculos, raíces y plátanos", 400),
    ("Tomate chonto", "Verduras y hortalizas", 500),
    ("Tomate de árbol", "Frutas frescas", 500),
], columns=["name", "group_label", "rows"])
SUPPLY_NAMES = pd.DataFrame([
    ("Papa parda pastusa", "TUBERCULOS, RAICES Y PLATANOS", "0151001", 50),
    ("Papa nevada", "TUBERCULOS, RAICES Y PLATANOS", "0151001", 40),
    ("Tomate chonto", "VERDURAS Y HORTALIZAS", "0123401", 5),
    ("Tomate larga vida", "VERDURAS Y HORTALIZAS", "0123401", 5),
    ("Hortalizas de hoja", "VERDURAS Y HORTALIZAS", "", 9),
], columns=["name", "group_label", "cpc_code", "rows"])
FOCUS = ("Papa parda pastusa", "Tomate chonto")


def test_family_variety_and_group() -> None:
    assert family_and_variety("Papa parda pastusa") == ("papa", "parda pastusa")
    assert family_and_variety("Tomate de árbol") == ("tomate de arbol", "")
    assert family_and_variety("Carne de res, bola de brazo") == ("carne de res", "bola de brazo")
    assert food_group("Tubérculos, raíces y plátanos") == "tuberculos"
    assert food_group("Huevos y lácteos**") == "lacteos_huevos"


def test_catalog_only_contains_focus_products() -> None:
    products, mapping = build_product_catalog(PRICE_NAMES, SUPPLY_NAMES, FOCUS)

    assert products["canonical_name"].tolist() == list(FOCUS)
    assert products["product_id"].tolist() == [1, 2]
    potato = products.iloc[0]
    assert (potato["family"], potato["variety"], potato["group"]) == ("papa", "parda pastusa", "tuberculos")
    assert "Papa nevada" not in set(mapping["source_name"])
    assert "Hortalizas de hoja" not in set(mapping["source_name"])


def test_every_spelling_of_a_focus_product_maps_to_one_id() -> None:
    _, mapping = build_product_catalog(PRICE_NAMES, SUPPLY_NAMES, FOCUS)
    rows = mapping.set_index(["source", "source_name"])

    assert rows.loc[("prices", "Papa parda pastusa"), "method"] == "exact"
    assert rows.loc[("prices", "Papa Parda Pastusa"), "method"] == "normalized"
    assert rows.loc[("prices", "Papa Parda Pastusa"), "product_id"] == 1
    assert rows.loc[("supply", "Papa parda pastusa"), "product_id"] == 1
    assert rows.loc[("supply", "Papa parda pastusa"), "cpc_code"] == "0151001"


def test_cpc_code_does_not_merge_varieties() -> None:
    _, mapping = build_product_catalog(PRICE_NAMES, SUPPLY_NAMES, FOCUS)
    supply = set(mapping.loc[mapping["source"] == "supply", "source_name"])

    assert "Tomate larga vida" not in supply  # same CPC as Tomate chonto, different variety
    assert "Papa nevada" not in supply


def test_unknown_focus_name_is_an_error() -> None:
    with pytest.raises(ValueError, match="Papa inexistente"):
        build_product_catalog(PRICE_NAMES, SUPPLY_NAMES, ("Papa inexistente",))


def test_existing_ids_are_kept() -> None:
    products, _ = build_product_catalog(PRICE_NAMES, SUPPLY_NAMES, FOCUS)
    existing = products.assign(product_id=products["product_id"] + 100)
    again, _ = build_product_catalog(PRICE_NAMES, SUPPLY_NAMES, FOCUS, existing_products=existing)
    assert again["product_id"].tolist() == [101, 102]


def test_market_catalog_and_aliases() -> None:
    cities = pd.DataFrame([("Cali", "Valle del Cauca", 3.45, -76.53), ("Ipiales", "Nariño", 0.83, -77.64)],
                          columns=["city", "department", "latitude", "longitude"])
    prices = pd.DataFrame([("Cali, Santa Helena", 100), ("Cali, Santa Elena", 50), ("Cali, Cavasa", 70),
                           ("Ipiales (Nariño), Centro de acopio", 10)], columns=["name", "rows"])
    supply = pd.DataFrame([("Cali, Santa Elena", 20)], columns=["name", "rows"])
    focus = ("Cali, Santa Elena", "Ipiales (Nariño), Centro de acopio")
    markets, mapping = build_market_catalog(prices, supply, cities, focus)

    assert len(markets) == 2
    santa_elena = mapping[mapping["market_id"] == 1]
    assert set(santa_elena["source_name"]) == {"Cali, Santa Helena", "Cali, Santa Elena"}
    assert "Cali, Cavasa" not in set(mapping["source_name"])
    ipiales = markets[markets["city"] == "Ipiales"].iloc[0]
    assert (ipiales["department"], ipiales["latitude"]) == ("Nariño", 0.83)
    assert market_location("Ipiales (Nariño), Centro de acopio") == ("Ipiales", "Nariño")
    assert market_location("Bogotá, D.C., Corabastos") == ("Bogotá", "")
