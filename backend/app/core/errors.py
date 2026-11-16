"""Errors raised by the services and the handlers that turn them into JSON responses with Spanish messages."""

from fastapi import FastAPI, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse


class NotFoundError(Exception):
    """A product, market or resource that does not exist. The message is shown to the user."""

    def __init__(self, message: str) -> None:
        super().__init__(message)
        self.message = message


class InvalidParameterError(Exception):
    """Query parameters that are valid one by one but not together (for example from > to)."""

    def __init__(self, message: str) -> None:
        super().__init__(message)
        self.message = message


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(NotFoundError)
    def _not_found(_request: Request, exc: NotFoundError) -> JSONResponse:
        return JSONResponse(status_code=404, content={"detail": exc.message})

    @app.exception_handler(InvalidParameterError)
    def _invalid(_request: Request, exc: InvalidParameterError) -> JSONResponse:
        return JSONResponse(status_code=422, content={"detail": exc.message})

    @app.exception_handler(RequestValidationError)
    def _validation(_request: Request, exc: RequestValidationError) -> JSONResponse:
        fields = ", ".join(str(error["loc"][-1]) for error in exc.errors())
        return JSONResponse(status_code=422, content={
            "detail": f"Parámetros inválidos: {fields}.",
            "errors": jsonable_encoder(exc.errors()),
        })
