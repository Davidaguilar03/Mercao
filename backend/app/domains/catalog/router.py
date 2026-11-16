"""Catalog endpoints: focus products and markets."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.app.core.database import get_session
from backend.app.domains.catalog import service
from backend.app.domains.catalog.schemas import MarketOut, ProductOut

router = APIRouter(tags=["catálogo"])


@router.get("/products", response_model=list[ProductOut], summary="Productos foco")
def list_products(session: Session = Depends(get_session)) -> list:
    return service.list_products(session)


@router.get("/markets", response_model=list[MarketOut], summary="Mercados foco")
def list_markets(session: Session = Depends(get_session)) -> list:
    return service.list_markets(session)
