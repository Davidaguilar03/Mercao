"""API tests on a tiny database built here, never on the real mercao.db."""

import json
from datetime import date, timedelta

import pandas as pd
import pytest
from fastapi.testclient import TestClient

from backend.app import pipeline  # noqa: F401  (registers every table)
from backend.app.core.config import Settings
from backend.app.core.database import Base, create_db_engine
from backend.app.domains.prices.service import seasonality_index
from backend.app.domains.recommendations.service import COSTS_NOTE, compare_group

# Monthly price factors: a series whose price depends only on the month has an exact seasonality index.
FACTORS = [1.00, 0.90, 1.10, 1.20, 1.00, 0.80, 0.95, 1.05, 1.00, 1.10, 0.95, 0.95]
MARKET_BASE = {1: 1000.0, 2: 1200.0, 3: 1100.0}
FIRST_WEEK = date(2016, 1, 4)
LAST_WEEK = date(2026, 11, 9)  # ISO 2026-W46
PAPA_GROUP = "papa-parda-pastusa|kg"


def _price(base: float, monday: date) -> float:
    return base * FACTORS[(monday + timedelta(days=3)).month - 1]


def _prices() -> pd.DataFrame:
    rows = []
    pairs = [(1, m, base) for m, base in MARKET_BASE.items()] + [(2, 1, 5000.0)]
    monday = FIRST_WEEK
    while monday <= LAST_WEEK:
        iso = monday.isocalendar()
        for product_id, market_id, base in pairs:
            mean = _price(base, monday)
            rows.append({"week_start": monday.isoformat(), "week_end": (monday + timedelta(days=6)).isoformat(),
                         "iso_year": iso[0], "iso_week": iso[1], "product_name": "x", "product_id": product_id,
                         "variety": None, "market_name": "x", "market_id": market_id, "min_price": mean * 0.9,
                         "max_price": mean * 1.1, "mean_price": mean, "unit": "kg", "range_inconsistent": False})
        monday += timedelta(weeks=1)
    return pd.DataFrame(rows)


def _forecasts() -> pd.DataFrame:
    # horizon -> market -> (predicted, lower, upper). h=2 intervals do not overlap; h=1 they overlap.
    values = {
        1: {1: (1000, 900, 1300), 2: (1200, 1100, 1400), 3: (1100, 1000, 1200)},
        2: {1: (1000, 900, 1100), 2: (1500, 1400, 1600), 3: (1200, 1050, 1350)},
        3: {1: (1000, 800, 1200), 2: (1100, 900, 1300), 3: (1050, 850, 1250)},
        4: {1: (1000, 800, 1200), 2: (1100, 900, 1300), 3: (1050, 850, 1250)},
    }
    rows = []
    for h, by_market in values.items():
        target = LAST_WEEK + timedelta(weeks=h)
        pairs = [(1, m, v) for m, v in by_market.items()] + [(2, 1, (5000, 4500, 5500))]
        for product_id, market_id, (predicted, lower, upper) in pairs:
            rows.append({"product_id": product_id, "market_id": market_id, "origin_iso_year": 2026,
                         "origin_iso_week": 46, "horizon": h, "target_iso_year": target.isocalendar()[0],
                         "target_iso_week": target.isocalendar()[1], "target_week_start": target.isoformat(),
                         "predicted_price": predicted, "lower_price": lower, "upper_price": upper,
                         "model_version": "lightgbm-test"})
    return pd.DataFrame(rows)


def _metadata() -> dict:
    def metrics(model: str, mape: float, **keys) -> dict:  # noqa: ANN003
        return {"model": model, **keys, "mae": 500.4, "mape": mape,
                "directional_accuracy": float("nan") if model == "naive" else 60.04, "n": 100.0,
                "skill_mae": 0.0 if model == "naive" else 7.16, "skill_mape": 0.0 if model == "naive" else 6.09}

    split = {"start": "2017-01-02", "end": "2024-11-17", "start_iso": "2017-W01", "end_iso": "2024-W46"}
    features = ["price_vs_ma_52w", "product_id", "week_sin", "return_52w", "week_cos", "month"]
    return {
        "model_type": "lightgbm", "model_version": "lightgbm-test", "created_at": "2026-11-16T08:00:00",
        "horizons": [1, 2, 3, 4], "target": "log(price[t+h] / price[t])",
        "splits": {"train": split, "validation": split, "test": split}, "fitted_on": "train + validation",
        "interval_coverage_test": {"1": 82.18, "2": 80.81, "3": 81.45, "4": 81.77, "overall": 81.56},
        "test_metrics": {
            "overall": [metrics("lightgbm", 13.98), metrics("naive", 14.881)],
            "by_horizon": [metrics(m, 10.0 + h, horizon=h) for m in ("lightgbm", "naive") for h in (1, 2, 3, 4)],
        },
        "feature_importance": {"native_kind": "gain",
                               "native_pct": dict(zip(features, [30.2, 18.2, 7.5, 6.3, 6.1, 2.6])),
                               "permutation_mae_increase": dict(zip(features, [0.0289, 0.0095, 0.0003, 0.0009,
                                                                               -0.0001, -0.0004]))},
    }


def build_database(path) -> None:  # noqa: ANN001
    engine = create_db_engine(f"sqlite:///{path.as_posix()}")
    Base.metadata.create_all(engine)
    tables = {
        "products": pd.DataFrame({"product_id": [1, 2], "canonical_name": ["Papa parda pastusa", "Mora de Castilla"],
                                  "family": ["papa", "mora"], "variety": ["parda pastusa", "de Castilla"],
                                  "group": ["tuberculos", "frutas"]}),
        "markets": pd.DataFrame({"market_id": [1, 2, 3],
                                 "market_name": ["Bogotá, D.C., Corabastos", "Medellín, Central Mayorista de "
                                                 "Antioquia", "Cali, Cavasa"],
                                 "city": ["Bogotá", "Medellín", "Cali"],
                                 "department": ["Bogotá, D.C.", "Antioquia", "Valle del Cauca"],
                                 "latitude": [4.711, 6.244, 3.452], "longitude": [-74.072, -75.581, -76.532]}),
        "coverage": pd.DataFrame({"product_id": [1, 1, 1, 2], "market_id": [1, 2, 3, 1],
                                  "first_week": FIRST_WEEK.isoformat(), "last_week": LAST_WEEK.isoformat(),
                                  "n_weeks": 567, "weeks_since_2016": 567, "missing_share_since_2016": 0.0,
                                  "has_recent_data": True, "usable_for_model": True,
                                  "comparable_group": [PAPA_GROUP] * 3 + ["mora-de-castilla|kg"]}),
        "price_files": pd.DataFrame({"file_name": ["a.xlsx", "b.xlsx"], "label": ["a", "b"],
                                     "iso_year": [2026, 2026], "iso_week": [45, 46], "status": ["ok", "ok"],
                                     "rows_read": [1, 1], "layout": ["flat", "flat"], "note": ["", ""]}),
        "prices": _prices(),
        "origin_departments": pd.DataFrame({"code": ["25", "15", "52"], "name": ["CUNDINAMARCA", "BOYACÁ",
                                                                                 "NARIÑO"]}),
        "origin_municipalities": pd.DataFrame({"code": ["25001", "15001", "52001"],
                                               "name": ["AGUA DE DIOS", "TUNJA", "PASTO"],
                                               "department_code": ["25", "15", "52"]}),
        "supply": pd.DataFrame({
            "iso_year": [2026, 2026, 2026, 2024, 2026], "iso_week": [40, 40, 41, 1, 40],
            "market_id": [1, 1, 1, 1, 2], "product_id": [1, 1, 1, 1, 1],
            "origin_department_code": ["25", "15", None, "25", "52"],
            "origin_municipality_code": ["25001", "15001", None, "25001", "52001"],
            "origin_country": ["COLOMBIA", "COLOMBIA", "ECUADOR", "COLOMBIA", "COLOMBIA"],
            "quantity_kg": [600.0, 300.0, 100.0, 5000.0, 400.0]}),
        "supply_weekly": pd.DataFrame({"iso_year": [2026], "iso_week": [45], "market_id": [1], "product_id": [1],
                                       "quantity_kg": [1000.0]}),
        "forecasts": _forecasts(),
    }
    for name, frame in tables.items():
        frame.to_sql(name, engine, if_exists="append", index=False)
    engine.dispose()


@pytest.fixture(scope="module")
def tmp_dir(tmp_path_factory):
    folder = tmp_path_factory.mktemp("api")
    build_database(folder / "test.db")
    (folder / "models").mkdir()
    (folder / "models" / "metadata.json").write_text(json.dumps(_metadata()), encoding="utf-8")
    return folder


def make_client(folder, models_dir) -> TestClient:  # noqa: ANN001
    from backend.app.main import create_app

    settings = Settings(data_dir=folder, models_dir=models_dir,
                        database_url=f"sqlite:///file:{(folder / 'test.db').as_posix()}?mode=ro&uri=true")
    return TestClient(create_app(settings))


@pytest.fixture(scope="module")
def client(tmp_dir) -> TestClient:
    return make_client(tmp_dir, tmp_dir / "models")


def test_health(client):
    body = client.get("/api/health").json()
    assert body == {"status": "ok", "latest_week": {"iso_year": 2026, "iso_week": 46, "week_start": "2026-11-09",
                                                    "week_end": "2026-11-15"}}


def test_products(client):
    body = client.get("/api/products").json()
    assert [p["product_id"] for p in body] == [1, 2]
    assert body[0] == {"product_id": 1, "canonical_name": "Papa parda pastusa", "family": "papa",
                       "variety": "parda pastusa", "group": "tuberculos", "comparable_group": PAPA_GROUP}


def test_markets(client):
    body = client.get("/api/markets").json()
    assert len(body) == 3
    assert body[0]["market_name"] == "Bogotá, D.C., Corabastos"
    assert body[0]["latitude"] == pytest.approx(4.711)


def test_latest_prices(client):
    body = client.get("/api/prices/latest", params={"product_id": 1}).json()
    markets = {m["market_id"]: m for m in body["markets"]}
    assert [m["market_id"] for m in body["markets"]] == [1, 3, 2]  # cheapest first
    bogota = markets[1]
    assert bogota["week_start"] == "2026-11-09"
    assert bogota["mean_price"] == 950  # 1000 x November factor
    assert bogota["min_price"] == 855 and bogota["max_price"] == 1045
    assert bogota["change_4w_pct"] == round((0.95 / 1.10 - 1) * 100, 1)  # versus October
    assert bogota["change_52w_pct"] == 0.0
    assert {m["comparable_group"] for m in body["markets"]} == {PAPA_GROUP}


def test_price_history_default_range(client):
    body = client.get("/api/prices/history", params={"product_id": 1, "market_id": 1}).json()
    assert body["to"] == "2026-11-09"
    assert body["from"] == (LAST_WEEK - timedelta(weeks=156)).isoformat()
    assert len(body["series"]) == 157
    assert body["series"][-1] == {"week_start": "2026-11-09", "mean_price": 950, "min_price": 855, "max_price": 1045}


def test_price_history_explicit_range(client):
    body = client.get("/api/prices/history", params={"product_id": 1, "market_id": 2, "from": "2026-01-01",
                                                      "to": "2026-01-31"}).json()
    assert [w["week_start"] for w in body["series"]] == ["2026-01-05", "2026-01-12", "2026-01-19", "2026-01-26"]


def test_seasonality(client):
    body = client.get("/api/prices/seasonality", params={"product_id": 1, "market_id": 1}).json()
    assert body["years_used"] == list(range(2016, 2026))  # 2026 is incomplete
    mean = sum(FACTORS) / 12
    assert [m["index"] for m in body["months"]] == [round(f / mean * 100, 1) for f in FACTORS]
    assert body["cheapest_month"] == "junio"
    assert body["most_expensive_month"] == "abril"


def test_seasonality_index_ignores_incomplete_years():
    weeks = pd.date_range("2020-01-06", "2021-06-28", freq="7D")
    weekly = pd.DataFrame({"week_start": weeks.strftime("%Y-%m-%d"),
                           "mean_price": [100.0 if w.year == 2020 else 1000.0 for w in weeks]})
    index, years = seasonality_index(weekly)
    assert years == [2020]
    assert index.round(6).eq(100.0).all()


def test_supply_origins_one_market(client):
    body = client.get("/api/supply/origins", params={"product_id": 1, "market_id": 1}).json()
    assert body["first_week_start"] == "2025-11-10" and body["last_week_start"] == "2026-11-02"
    assert body["total_kg"] == 1000  # the 2024 row is outside the last 52 weeks
    assert [(d["name"], d["share_pct"]) for d in body["departments"]] == [("CUNDINAMARCA", 60.0), ("BOYACÁ", 30.0)]
    assert [m["name"] for m in body["municipalities"]] == ["AGUA DE DIOS", "TUNJA"]
    assert body["imported_kg"] == 100 and body["imported_share_pct"] == 10.0
    assert body["message"] is None


def test_supply_origins_all_markets(client):
    body = client.get("/api/supply/origins", params={"product_id": 1}).json()
    assert body["market_name"] == "Todos los mercados foco"
    assert body["total_kg"] == 1400
    assert body["departments"][0] == {"code": "25", "name": "CUNDINAMARCA", "kg": 600, "share_pct": 42.9}


def test_supply_origins_empty(client):
    response = client.get("/api/supply/origins", params={"product_id": 2, "market_id": 1})
    body = response.json()
    assert response.status_code == 200
    assert body["total_kg"] == 0 and body["departments"] == [] and body["municipalities"] == []
    assert body["message"].startswith("No hay datos de abastecimiento de Mora de Castilla")


def test_forecasts_one_market(client):
    body = client.get("/api/forecasts", params={"product_id": 1, "market_id": 1}).json()
    assert body["model_version"] == "lightgbm-test"
    market = body["markets"][0]
    assert market["last_observed_price"] == 950
    assert market["origin_week_start"] == "2026-11-09"
    assert [f["horizon"] for f in market["forecasts"]] == [1, 2, 3, 4]
    assert market["forecasts"][1] == {"horizon": 2, "target_iso_year": 2026, "target_iso_week": 48,
                                      "target_week_start": "2026-11-23", "predicted_price": 1000,
                                      "lower_price": 900, "upper_price": 1100}


def test_forecasts_all_markets(client):
    body = client.get("/api/forecasts", params={"product_id": 1}).json()
    assert [m["market_id"] for m in body["markets"]] == [1, 2, 3]


def test_recommendations_high_confidence(client):
    body = client.get("/api/recommendations", params={"product_id": 1}).json()
    assert body["horizon"] == 2  # default
    group = body["groups"][0]
    assert group["comparable_group"] == PAPA_GROUP and group["markets_compared"] == 3
    assert group["buy"]["market_id"] == 1 and group["sell"]["market_id"] == 2
    assert group["difference_per_kg"] == 500 and group["difference_pct"] == 50.0
    assert group["confidence"] == "alta"
    assert body["note"] == COSTS_NOTE


def test_recommendations_low_confidence(client):
    group = client.get("/api/recommendations", params={"product_id": 1, "horizon": 1}).json()["groups"][0]
    assert (group["buy"]["market_id"], group["sell"]["market_id"]) == (1, 2)
    assert group["difference_per_kg"] == 200 and group["difference_pct"] == 20.0
    assert group["confidence"] == "baja"


def test_recommendations_need_two_markets(client):
    body = client.get("/api/recommendations", params={"product_id": 2}).json()
    assert body["groups"] == []
    assert body["message"] and body["note"] == COSTS_NOTE


def test_compare_group_single_market():
    row = {"market_id": 1, "market_name": "a", "city": "a", "comparable_group": "g", "target_iso_year": 2026,
           "target_iso_week": 48, "target_week_start": "2026-11-23", "predicted_price": 1000.0,
           "lower_price": 900.0, "upper_price": 1100.0}
    assert compare_group([row]) is None
    touching = compare_group([row, {**row, "market_id": 2, "predicted_price": 1200.0, "lower_price": 1100.0,
                                    "upper_price": 1300.0}])
    assert touching["confidence"] == "baja"  # intervals that touch overlap


def test_model_summary(client):
    body = client.get("/api/model/summary").json()
    assert body["model_type"] == "lightgbm" and body["model_label"] == "LightGBM"
    assert body["overall"][0] == {"model": "lightgbm", "label": "LightGBM", "mae": 500, "mape_pct": 14.0,
                                  "directional_accuracy_pct": 60.0, "skill_mae_pct": 7.2, "skill_mape_pct": 6.1}
    assert body["overall"][1]["directional_accuracy_pct"] is None
    assert body["by_horizon"][0]["horizon"] == 1 and body["by_horizon"][0]["naive"]["mape_pct"] == 11.0
    assert body["interval_coverage_overall_pct"] == 81.6
    assert [f["feature"] for f in body["top_features"]] == ["price_vs_ma_52w", "product_id", "week_sin",
                                                            "return_52w", "week_cos"]
    assert body["top_features"][0]["label"] == "Precio vs. media 52 sem."


def test_model_summary_without_model(tmp_dir):
    response = make_client(tmp_dir, tmp_dir / "missing").get("/api/model/summary")
    assert response.status_code == 404
    assert "no se ha entrenado" in response.json()["detail"]


@pytest.mark.parametrize("url, params, message", [
    ("/api/prices/latest", {"product_id": 99}, "No existe el producto 99."),
    ("/api/prices/history", {"product_id": 1, "market_id": 99}, "No existe el mercado 99."),
    ("/api/prices/seasonality", {"product_id": 99, "market_id": 1}, "No existe el producto 99."),
    ("/api/supply/origins", {"product_id": 1, "market_id": 99}, "No existe el mercado 99."),
    ("/api/forecasts", {"product_id": 99}, "No existe el producto 99."),
    ("/api/recommendations", {"product_id": 99}, "No existe el producto 99."),
])
def test_unknown_product_or_market_is_404(client, url, params, message):
    response = client.get(url, params=params)
    assert response.status_code == 404
    assert response.json() == {"detail": message}


@pytest.mark.parametrize("params", [{"product_id": 1, "horizon": 0}, {"product_id": 1, "horizon": 5},
                                    {"product_id": 1, "horizon": "dos"}, {}])
def test_invalid_recommendation_parameters_are_422(client, params):
    response = client.get("/api/recommendations", params=params)
    assert response.status_code == 422
    assert response.json()["detail"].startswith("Parámetros inválidos")


def test_reversed_date_range_is_422(client):
    response = client.get("/api/prices/history", params={"product_id": 1, "market_id": 1, "from": "2026-02-01",
                                                          "to": "2026-01-01"})
    assert response.status_code == 422


@pytest.mark.parametrize("origin", ["http://localhost:5173", "http://localhost:4173"])
def test_cors_allows_vite_dev_and_preview_servers(client, origin):
    response = client.get("/api/health", headers={"Origin": origin})
    assert response.headers["access-control-allow-origin"] == origin
