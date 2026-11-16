"""SQLAlchemy engine, session factory and declarative base."""

from collections.abc import Iterator
from contextlib import contextmanager

from fastapi import Request
from sqlalchemy import Engine, create_engine, event
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from backend.app.core.config import get_settings


class Base(DeclarativeBase):
    """Declarative base for every table of every domain."""


def create_db_engine(url: str | None = None, bulk_load: bool = False) -> Engine:
    """Create an engine. bulk_load disables journaling for fast one-off rebuilds into a fresh file."""
    engine = create_engine(url or get_settings().resolved_database_url)

    if engine.dialect.name == "sqlite":

        @event.listens_for(engine, "connect")
        def _sqlite_pragmas(dbapi_connection, _record) -> None:  # noqa: ANN001
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA foreign_keys=ON")
            if bulk_load:
                cursor.execute("PRAGMA journal_mode=OFF")
                cursor.execute("PRAGMA synchronous=OFF")
                cursor.execute("PRAGMA cache_size=-200000")
            cursor.close()

    return engine


@contextmanager
def session_scope(engine: Engine | None = None) -> Iterator[Session]:
    """Yield a session that commits on success and rolls back on error."""
    factory = sessionmaker(bind=engine or create_db_engine())
    session = factory()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def get_session(request: Request) -> Iterator[Session]:
    """FastAPI dependency: one session per request on the engine created by the app factory."""
    with Session(request.app.state.engine) as session:
        yield session
