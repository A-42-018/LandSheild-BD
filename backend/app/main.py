import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1 import api_router
from app.core.config import Settings, get_settings, production_problems
from app.core.errors import register_exception_handlers
from app.core.headers import SecurityHeadersMiddleware
from app.core.logging import configure_logging
from app.core.security import get_secret

logger = logging.getLogger("landshield")


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    get_secret(settings)  # fail fast if JWT_SECRET missing outside dev
    if settings.app_env.lower() != "dev":
        problems = production_problems(settings)
        if problems:
            raise RuntimeError("Unsafe production configuration: " + "; ".join(problems))
    configure_logging(settings.log_level)

    app = FastAPI(
        title=settings.app_name,
        description="Demo Dataset — Not an Official Government Land Record.",
        version="0.1.0",
    )
    app.state.settings = settings

    # Added first = inner: CORS answers preflights before these headers matter, and every
    # normal response (including error handlers' JSON) still passes through here.
    app.add_middleware(
        SecurityHeadersMiddleware,
        hsts=settings.cookie_secure or settings.app_env.lower() != "dev",
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[o for o in settings.cors_origin_list if o != "*"],  # never "*" + cookies
        allow_credentials=True,
        allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "Accept", "Accept-Language"],
        max_age=600,
    )
    register_exception_handlers(app)
    app.include_router(api_router, prefix=settings.api_prefix)
    logger.info("app_started", extra={"api_prefix": settings.api_prefix})
    return app


app = create_app()
