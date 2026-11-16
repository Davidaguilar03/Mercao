"""Supply endpoint: origin of the product entering the markets."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from backend.app.core.database import get_session
from backend.app.domains.supply import service
from backend.app.domains.supply.schemas import SupplyOriginsOut

router = APIRouter(tags=["abastecimiento"])


@router.get("/supply/origins", response_model=SupplyOriginsOut, summary="Origen del abastecimiento (52 semanas)")
def supply_origins(product_id: int = Query(gt=0), market_id: int | None = Query(None, gt=0),
                   session: Session = Depends(get_session)) -> dict:
    return service.supply_origins(session, product_id, market_id)
