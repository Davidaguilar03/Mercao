"""Price endpoints, plus the health check (which reports the latest week of prices)."""

from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from backend.app.core.database import get_session
from backend.app.domains.prices import service
from backend.app.domains.prices.schemas import HealthOut, LatestPricesOut, PriceHistoryOut, SeasonalityOut

router = APIRouter(tags=["precios"])


@router.get("/health", response_model=HealthOut, summary="Estado de la API y última semana con datos")
def health(session: Session = Depends(get_session)) -> dict:
    return service.health(session)


@router.get("/prices/latest", response_model=LatestPricesOut, summary="Último precio por mercado")
def latest_prices(product_id: int = Query(gt=0), session: Session = Depends(get_session)) -> dict:
    return service.latest_prices(session, product_id)


@router.get("/prices/history", response_model=PriceHistoryOut, summary="Serie semanal de un producto en un mercado")
def price_history(
    product_id: int = Query(gt=0),
    market_id: int = Query(gt=0),
    start: date | None = Query(None, alias="from", description="Primera semana (AAAA-MM-DD)"),
    end: date | None = Query(None, alias="to", description="Última semana (AAAA-MM-DD)"),
    session: Session = Depends(get_session),
) -> dict:
    return service.price_history(session, product_id, market_id, start, end)


@router.get("/prices/seasonality", response_model=SeasonalityOut, summary="Índice de precio por mes")
def seasonality(product_id: int = Query(gt=0), market_id: int = Query(gt=0),
                session: Session = Depends(get_session)) -> dict:
    return service.seasonality(session, product_id, market_id)
