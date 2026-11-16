"""Recommendations endpoint: where to buy and where to sell each product."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from backend.app.core.database import get_session
from backend.app.domains.recommendations import service
from backend.app.domains.recommendations.schemas import RecommendationsOut

router = APIRouter(tags=["recomendaciones"])


@router.get("/recommendations", response_model=RecommendationsOut, summary="Dónde comprar y dónde vender")
def recommendations(product_id: int = Query(gt=0),
                    horizon: int = Query(service.DEFAULT_HORIZON, ge=1, le=4, description="Semanas hacia adelante"),
                    session: Session = Depends(get_session)) -> dict:
    return service.recommendations(session, product_id, horizon)
