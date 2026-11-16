"""Forecasting endpoints: latest forecasts and the model transparency summary."""

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session

from backend.app.core.database import get_session
from backend.app.domains.forecasting import service
from backend.app.domains.forecasting.schemas import ForecastsOut, ModelSummaryOut

router = APIRouter(tags=["pronósticos"])


@router.get("/forecasts", response_model=ForecastsOut, summary="Pronósticos a 1, 2, 3 y 4 semanas")
def forecasts(product_id: int = Query(gt=0), market_id: int | None = Query(None, gt=0),
              session: Session = Depends(get_session)) -> dict:
    return service.forecasts(session, product_id, market_id)


@router.get("/model/summary", response_model=ModelSummaryOut, summary="Resumen del modelo y su evaluación")
def model_summary(request: Request) -> dict:
    return service.model_summary(request.app.state.settings.models_dir)
