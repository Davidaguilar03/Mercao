"""Pipeline log stored in the database, so every exclusion and decision of a build can be queried later."""

from sqlalchemy import Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from backend.app.core.database import Base


class PipelineEvent(Base):
    __tablename__ = "pipeline_log"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    step: Mapped[str] = mapped_column(String, nullable=False)
    level: Mapped[str] = mapped_column(String, nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    value: Mapped[str] = mapped_column(Text, nullable=False, default="")
