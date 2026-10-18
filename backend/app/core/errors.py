"""Uniform error shape: {"code": str, "message": str, "details": any | null}.

Backend is language-neutral: `code` + `details` are machine-readable; the
frontend translates. `message` is a short English fallback for logs/debugging.
"""

import logging
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.exc import DataError
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger("landshield.errors")

_STATUS_CODES = {
    400: "BAD_REQUEST",
    401: "UNAUTHORIZED",
    403: "FORBIDDEN",
    404: "NOT_FOUND",
    405: "METHOD_NOT_ALLOWED",
    409: "CONFLICT",
    413: "PAYLOAD_TOO_LARGE",
    422: "VALIDATION_ERROR",
    429: "RATE_LIMITED",
}


class AppError(Exception):
    def __init__(
        self,
        code: str,
        message: str,
        status_code: int = 400,
        details: Any | None = None,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code
        self.details = details


def error_body(code: str, message: str, details: Any | None = None) -> dict[str, Any]:
    return {"code": code, "message": message, "details": details}


def _json(status_code: int, code: str, message: str, details: Any | None = None) -> JSONResponse:
    return JSONResponse(status_code=status_code, content=error_body(code, message, details))


async def _app_error_handler(_: Request, exc: AppError) -> JSONResponse:
    return _json(exc.status_code, exc.code, exc.message, exc.details)


async def _http_error_handler(_: Request, exc: StarletteHTTPException) -> JSONResponse:
    code = _STATUS_CODES.get(exc.status_code, "HTTP_ERROR")
    message = exc.detail if isinstance(exc.detail, str) else code
    details = None if isinstance(exc.detail, str) else exc.detail
    response = _json(exc.status_code, code, message, details)
    if exc.headers:
        response.headers.update(exc.headers)
    return response


async def _validation_error_handler(_: Request, exc: RequestValidationError) -> JSONResponse:
    details = [
        {"loc": list(e.get("loc", [])), "type": e.get("type", ""), "msg": e.get("msg", "")}
        for e in exc.errors()
    ]
    return _json(422, "VALIDATION_ERROR", "Request validation failed", details)


async def _data_error_handler(request: Request, exc: DataError) -> JSONResponse:
    """A value the database cannot store or compare (Postgres: a NUL character in text, an
    out-of-range number). Input from the client, so 422, not a server error (H5: Postgres)."""
    logger.warning(
        "database_rejected_input",
        extra={"path": request.url.path, "method": request.method,
               "error": type(exc.orig).__name__},  # fmt: skip
    )
    return _json(422, "INVALID_INPUT", "The input contains a value that cannot be stored")


async def _unhandled_error_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.error(
        "unhandled_exception",
        exc_info=exc,
        extra={"path": request.url.path, "method": request.method},
    )
    return _json(500, "INTERNAL_ERROR", "Internal server error")


def register_exception_handlers(app: FastAPI) -> None:
    app.add_exception_handler(AppError, _app_error_handler)  # type: ignore[arg-type]
    app.add_exception_handler(StarletteHTTPException, _http_error_handler)  # type: ignore[arg-type]
    app.add_exception_handler(RequestValidationError, _validation_error_handler)  # type: ignore[arg-type]
    app.add_exception_handler(DataError, _data_error_handler)  # type: ignore[arg-type]
    app.add_exception_handler(Exception, _unhandled_error_handler)
