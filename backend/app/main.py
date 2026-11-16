"""FastAPI application: read-only API over mercao.db and the saved model metadata.

Run: uvicorn backend.app.main:app --reload   (interactive docs at http://localhost:8000/docs)
"""

from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.app.core.config import Settings, get_settings
from backend.app.core.database import create_db_engine
from backend.app.core.errors import register_error_handlers
from backend.app.domains.catalog.router import router as catalog_router
from backend.app.domains.forecasting.router import router as forecasting_router
from backend.app.domains.prices.router import router as prices_router
from backend.app.domains.recommendations.router import router as recommendations_router
from backend.app.domains.supply.router import router as supply_router

API_PREFIX = "/api"


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    app = FastAPI(title="Mercao API", version="1.0.0",
                  description="Precios mayoristas de alimentos en Colombia (DANE SIPSA), abastecimiento y pronósticos.")
    app.state.settings = settings
    app.state.engine = create_db_engine(settings.read_only_database_url)
    app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origins, allow_methods=["GET"],
                       allow_headers=["*"])
    register_error_handlers(app)

    api = APIRouter(prefix=API_PREFIX)
    for router in (prices_router, catalog_router, supply_router, forecasting_router, recommendations_router):
        api.include_router(router)
    app.include_router(api)
    return app


app = create_app()
