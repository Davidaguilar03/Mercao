"""FastAPI application: read-only API over mercao.db and the saved model metadata.

Run: uvicorn backend.app.main:app --reload   (interactive docs at http://localhost:8000/docs)
When frontend/dist exists, the same server also serves the built frontend at http://localhost:8000.
"""

from pathlib import Path

from fastapi import APIRouter, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

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
    serve_frontend(app, settings.frontend_dist_dir)
    return app


def serve_frontend(app: FastAPI, dist_dir: Path) -> None:
    """Serve the built frontend: its files as they are and index.html for any other route (client-side routing)."""
    index = dist_dir / "index.html"
    if not index.is_file():
        return
    root = dist_dir.resolve()

    @app.get("/{path:path}", include_in_schema=False)
    def frontend(path: str) -> FileResponse:
        if path == "api" or path.startswith("api/"):
            raise HTTPException(status_code=404, detail="No existe ese recurso de la API.")
        file = (root / path).resolve()
        if path and file.is_file() and file.is_relative_to(root):
            return FileResponse(file)
        return FileResponse(index)


app = create_app()
