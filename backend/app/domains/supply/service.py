"""Where the supply of a product comes from in the last 52 weeks with data."""

from datetime import date, timedelta

from sqlalchemy.orm import Session

from backend.app.domains.catalog import service as catalog
from backend.app.domains.supply import repository

SUPPLY_WEEKS = 52
TOP_MUNICIPALITIES = 10
DOMESTIC_COUNTRY = "COLOMBIA"


def _share(kg: float, total: float) -> float:
    return round(kg / total * 100, 1)


def summarize_origins(rows: list[dict]) -> dict:
    """Kilograms and share of the total by department, top municipalities and imports.

    Shares are over the total, imports included, so departments plus the imported share add up to 100 %.
    """
    total = sum(r["kg"] for r in rows)
    imported = sum(r["kg"] for r in rows if r["country"] and r["country"] != DOMESTIC_COUNTRY)
    departments: dict[str, dict] = {}
    municipalities: dict[str, dict] = {}
    for row in rows:
        if row["country"] and row["country"] != DOMESTIC_COUNTRY:
            continue
        code = row["department_code"] or ""
        department = departments.setdefault(code, {"code": code or None,
                                                   "name": row["department_name"] or "Sin origen registrado",
                                                   "kg": 0.0})
        department["kg"] += row["kg"]
        if row["municipality_code"]:
            municipality = municipalities.setdefault(row["municipality_code"], {
                "code": row["municipality_code"], "name": row["municipality_name"],
                "department": row["department_name"], "kg": 0.0})
            municipality["kg"] += row["kg"]

    def ranked(items: dict[str, dict], limit: int | None = None) -> list[dict]:
        ordered = sorted(items.values(), key=lambda item: item["kg"], reverse=True)[:limit]
        return [{**item, "kg": round(item["kg"]), "share_pct": _share(item["kg"], total)} for item in ordered]

    return {
        "total_kg": round(total),
        "departments": ranked(departments),
        "municipalities": ranked(municipalities, TOP_MUNICIPALITIES),
        "imported_kg": round(imported),
        "imported_share_pct": _share(imported, total) if total else 0.0,
    }


def supply_origins(session: Session, product_id: int, market_id: int | None) -> dict:
    product = catalog.get_product(session, product_id)
    market = catalog.get_market(session, market_id) if market_id is not None else None
    result = {"product_id": product_id, "product_name": product["canonical_name"], "market_id": market_id,
              "market_name": market["market_name"] if market else "Todos los mercados foco",
              "first_week_start": None, "last_week_start": None, "total_kg": 0, "departments": [],
              "municipalities": [], "imported_kg": 0, "imported_share_pct": 0.0, "message": None}
    latest = repository.latest_week(session)
    rows = []
    if latest is not None:
        last_monday = date.fromisocalendar(latest["iso_year"], latest["iso_week"], 1)
        first_monday = last_monday - timedelta(weeks=SUPPLY_WEEKS - 1)
        first_iso = first_monday.isocalendar()
        result["first_week_start"], result["last_week_start"] = first_monday, last_monday
        rows = [dict(r) for r in repository.origins(session, product_id, market_id,
                                                    first_iso[0] * 100 + first_iso[1],
                                                    latest["iso_year"] * 100 + latest["iso_week"])]
    if not rows or sum(r["kg"] for r in rows) <= 0:
        where = f"en {market['market_name']}" if market else "en los mercados foco"
        result["message"] = (f"No hay datos de abastecimiento de {product['canonical_name']} {where} en las últimas "
                             f"{SUPPLY_WEEKS} semanas.")
        return result
    return {**result, **summarize_origins(rows)}
