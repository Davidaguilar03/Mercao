"""SQL queries of the supply endpoint."""

from sqlalchemy import RowMapping, text
from sqlalchemy.orm import Session


def latest_week(session: Session) -> RowMapping | None:
    """Latest ISO week with supply data (the primary key of supply_weekly starts with the week)."""
    return session.execute(text(
        "SELECT iso_year, iso_week FROM supply_weekly ORDER BY iso_year DESC, iso_week DESC LIMIT 1"
    )).mappings().first()


def origins(session: Session, product_id: int, market_id: int | None, first_week: int, last_week: int
            ) -> list[RowMapping]:
    """Kilograms by origin between two weeks given as iso_year * 100 + iso_week; all focus markets if no market."""
    market_filter = "AND s.market_id = :market_id" if market_id is not None else ""
    return list(session.execute(text(f"""
        SELECT s.origin_department_code AS department_code, d.name AS department_name,
               s.origin_municipality_code AS municipality_code, mu.name AS municipality_name,
               s.origin_country AS country, SUM(s.quantity_kg) AS kg
        FROM supply s
        LEFT JOIN origin_departments d ON d.code = s.origin_department_code
        LEFT JOIN origin_municipalities mu ON mu.code = s.origin_municipality_code
        WHERE s.product_id = :product_id {market_filter}
          AND s.iso_year * 100 + s.iso_week BETWEEN :first_week AND :last_week
        GROUP BY s.origin_department_code, s.origin_municipality_code, s.origin_country
    """), {"product_id": product_id, "market_id": market_id, "first_week": first_week,
           "last_week": last_week}).mappings())
