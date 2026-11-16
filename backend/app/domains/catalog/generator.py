"""Builds the curated catalog CSV files for the focus set (catalog/focus.py) from the names found in the raw data.

Run through `python -m backend.scripts.generate_catalog`. Existing ids are kept when the files are regenerated.

Product matching rule: a published name (prices or supply) maps to a focus product when it has the same name_key
(case, accents, punctuation and spaces ignored). The CPC code that supply publishes from 2024 is stored for
reference but not used to match: it identifies the species, not the variety (every potato variety shares 0151001,
'Tomate larga vida' shares the code of 'Tomate chonto'), so it would merge varieties that must not be compared.
Any other name is out of scope: it is loaded with an empty product_id and is not reviewed.
"""

import re

import pandas as pd

from backend.app.domains.catalog.groups import family_and_variety, food_group
from backend.app.domains.ingestion.text import name_key

PRODUCT_COLUMNS = ["product_id", "canonical_name", "family", "variety", "group"]
PRODUCT_MAPPING_COLUMNS = ["source", "source_name", "product_id", "method", "cpc_code"]
MARKET_COLUMNS = ["market_id", "market_name", "city", "department", "latitude", "longitude"]
MARKET_MAPPING_COLUMNS = ["source", "source_name", "market_id", "method"]

# Spelling variants of the same market that name_key cannot unify (checked by their date ranges, which do not overlap).
MARKET_ALIASES = {
    "cali santa helena": "cali santa elena",
    "carmen de viboral antioquia": "el carmen de viboral antioquia",
    "ipiales centro de acopio": "ipiales narino centro de acopio",
    "ipiales mercado de ipiales somos todos": "ipiales narino ipiales somos todos",
    "pasto narino el potrerillo": "pasto el potrerillo",
    "cartagena frigorifico candela": "cartagena frigorifico candelaria",
}


def _existing_ids(existing: pd.DataFrame | None, id_column: str, name_column: str) -> dict[str, int]:
    if existing is None or existing.empty:
        return {}
    return {name_key(name): int(i) for i, name in zip(existing[id_column], existing[name_column])}


def _assign_ids(keys: list[str], existing: dict[str, int]) -> dict[str, int]:
    ids = {k: existing[k] for k in keys if k in existing}
    next_id = max(existing.values(), default=0) + 1
    for key in keys:
        if key not in ids:
            ids[key] = next_id
            next_id += 1
    return ids


def build_product_catalog(price_names: pd.DataFrame, supply_names: pd.DataFrame, focus: tuple[str, ...] | list[str],
                          existing_products: pd.DataFrame | None = None) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Build products (focus only) and product_mapping (every published spelling of a focus product).

    price_names: columns name, group_label, rows. supply_names: columns name, group_label, cpc_code, rows.
    Focus names that are not published in prices raise ValueError, so a typo cannot silently drop a product.
    """
    focus_keys = [name_key(n) for n in focus]
    prices = price_names.assign(key=price_names["name"].map(name_key))
    missing = [n for n, k in zip(focus, focus_keys) if k not in set(prices["key"])]
    if missing:
        raise ValueError(f"Focus products not found in the weekly prices: {missing}")
    ids = _assign_ids(focus_keys, _existing_ids(existing_products, "product_id", "canonical_name"))

    products = []
    for name, key in zip(focus, focus_keys):
        family, variety = family_and_variety(name)
        groups = prices.loc[prices["key"] == key, "group_label"].map(food_group)
        products.append({"product_id": ids[key], "canonical_name": name, "family": family, "variety": variety,
                         "group": groups.mode().iat[0]})

    mapping = []
    for name in sorted(prices.loc[prices["key"].isin(ids), "name"].unique()):
        canonical = focus[focus_keys.index(name_key(name))]
        mapping.append({"source": "prices", "source_name": name, "product_id": ids[name_key(name)],
                        "method": "exact" if name == canonical else "normalized", "cpc_code": ""})

    supply = supply_names.assign(key=supply_names["name"].map(name_key))
    cpc_by_name = (supply[supply["cpc_code"] != ""].groupby("name")["cpc_code"]
                   .agg(lambda c: c.value_counts().index[0]).to_dict())
    for name in sorted(supply.loc[supply["key"].isin(ids), "name"].unique()):
        mapping.append({"source": "supply", "source_name": name, "product_id": ids[name_key(name)],
                        "method": "normalized", "cpc_code": cpc_by_name.get(name, "")})

    products_frame = pd.DataFrame(products, columns=PRODUCT_COLUMNS).sort_values("product_id").reset_index(drop=True)
    mapping_frame = pd.DataFrame(mapping, columns=PRODUCT_MAPPING_COLUMNS).sort_values(["source", "source_name"])
    return products_frame, mapping_frame.reset_index(drop=True)


def market_key(name: str) -> str:
    """Normalized market key after applying the manual aliases."""
    key = name_key(name)
    return MARKET_ALIASES.get(key, key)


def market_location(name: str) -> tuple[str, str]:
    """('Ipiales (Nariño), Centro de acopio') -> ('Ipiales', 'Nariño'); ('Cali, Cavasa') -> ('Cali', '')."""
    match = re.match(r"^([^(]+?)\s*,?\s*\(([^)]+)\)", name)
    if match:
        return match.group(1).strip(" ,"), match.group(2).strip()
    return name.split(",")[0].strip(), ""


def build_market_catalog(price_markets: pd.DataFrame, supply_markets: pd.DataFrame, cities: pd.DataFrame,
                         focus: tuple[str, ...] | list[str],
                         existing_markets: pd.DataFrame | None = None) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Build markets (focus only) and market_mapping. Inputs have columns name, rows; cities has city, department,
    latitude, longitude (a 'City|Department' key disambiguates repeated city names)."""
    focus_keys = [market_key(n) for n in focus]
    names = pd.concat([price_markets.assign(source="prices"), supply_markets.assign(source="supply")])
    names = names.assign(key=names["name"].map(market_key))
    missing = [n for n, k in zip(focus, focus_keys) if k not in set(names["key"])]
    if missing:
        raise ValueError(f"Focus markets not found in the raw data: {missing}")
    existing = {market_key(k): v for k, v in _existing_ids(existing_markets, "market_id", "market_name").items()}
    ids = _assign_ids(focus_keys, existing)
    city_index = {name_key(c): row for c, row in zip(cities["city"], cities.to_dict("records"))}
    markets = []
    for name, key in zip(focus, focus_keys):
        city, department = market_location(name)
        place = city_index.get(name_key(f"{city}|{department}")) or city_index.get(name_key(city))
        markets.append({
            "market_id": ids[key], "market_name": name, "city": city,
            "department": place["department"] if place else department,
            "latitude": place["latitude"] if place else None, "longitude": place["longitude"] if place else None,
        })
    mapping = []
    for (source, name), items in names[names["key"].isin(ids)].groupby(["source", "name"]):
        key = items["key"].iat[0]
        canonical = focus[focus_keys.index(key)]
        method = "alias" if name_key(name) in MARKET_ALIASES else ("exact" if name == canonical else "normalized")
        mapping.append({"source": source, "source_name": name, "market_id": ids[key], "method": method})
    markets_frame = pd.DataFrame(markets, columns=MARKET_COLUMNS).sort_values("market_id").reset_index(drop=True)
    mapping_frame = pd.DataFrame(mapping, columns=MARKET_MAPPING_COLUMNS).sort_values(["source", "source_name"])
    return markets_frame, mapping_frame.reset_index(drop=True)
