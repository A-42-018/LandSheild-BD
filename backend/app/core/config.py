from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

DEFAULT_HASH_SALT = "dev-only-change-me"


class Settings(BaseSettings):
    """Application settings loaded from environment variables (see .env.example)."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "LandShield BD"
    api_prefix: str = "/api/v1"
    log_level: str = "INFO"

    database_url: str = "sqlite:///./landshield.db"
    jwt_secret: str = ""
    jwt_access_minutes: int = 15
    jwt_refresh_days: int = 7
    app_env: str = "dev"
    cookie_secure: bool = False
    # lax | strict | none (none = frontend and API on different sites; needs COOKIE_SECURE=true)
    cookie_samesite: str = "lax"
    auth_rate_limit_per_min: int = 10
    public_rate_limit_per_min: int = 60
    verify_doc_rate_limit_per_min: int = 10
    feedback_rate_limit_per_min: int = 5
    upload_rate_limit_per_hour: int = 20  # per user (R4)
    cors_origins: str = "http://localhost:3000"
    storage_path: str = "./storage"
    # auto = demo fixture -> pdf-text -> tesseract; also tesseract | mock (tests)
    ocr_provider: str = "auto"
    demo_fixtures: str = "on"  # on = saved demo files return their stored result; off = real OCR
    # auto = claude if ANTHROPIC_API_KEY else rules; also rules | claude | mock
    document_ai_provider: str = "auto"
    anthropic_api_key: str = Field(default="", repr=False)  # empty = Claude disabled; never logged
    claude_model: str = "claude-haiku-4-5-20251001"
    anthropic_base_url: str = ""  # Anthropic-compatible gateway, e.g. https://api.meta.ai; empty = Anthropic
    anthropic_auth: str = "x-api-key"  # x-api-key | bearer (Authorization: Bearer, as most gateways expect)
    claude_daily_cap: int = Field(default=100, ge=0)  # max Claude calls/day; over cap -> rules
    claude_timeout_s: int = Field(default=30, ge=1)
    ocr_timeout_s: int = Field(default=30, ge=1)  # Tesseract, per page
    ocr_max_pages: int = Field(default=5, ge=1)  # PDF pages read; the rest dropped + warning
    document_ai_model: str = ""
    embedding_model: str = ""
    review_conf_threshold: float = Field(default=0.85, ge=0.0, le=1.0)
    preprocess: str = "on"  # OpenCV clean-up before Tesseract
    ml_scoring: str = "on"  # on | off (P49); missing model/scikit-learn -> skipped with a log
    ml_model_path: str = ""  # empty = models/iforest.joblib at the repo root
    tesseract_lang: str = "ben+eng"
    mouza_enabled_division_id: str = ""  # mouza lists need a dataset that is not bundled (synthetic-data-only rule); '' = off
    gis_data_dir: str = ""  # empty = <repo>/database/gis
    signing_key: str = ""  # base64 32-byte Ed25519 seed (F4a); wins over the key file
    signing_key_path: str = ""  # empty = <STORAGE_PATH>/signing/ed25519.pem (auto-created in dev)
    demo_password: str = ""
    hash_salt: str = DEFAULT_HASH_SALT

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


def production_problems(s: Settings) -> list[str]:
    """Misconfigurations that must stop a production start (APP_ENV=prod). Dev is never checked."""
    problems: list[str] = []
    if len(s.jwt_secret) < 32:
        problems.append("JWT_SECRET must be at least 32 characters")
    if not s.cookie_secure:
        problems.append("COOKIE_SECURE must be true (refresh cookie over HTTPS only)")
    if len(s.hash_salt) < 16 or s.hash_salt == DEFAULT_HASH_SALT:
        problems.append("HASH_SALT must be set to a private value of at least 16 characters")
    if s.cookie_samesite.lower() not in {"lax", "strict", "none"}:
        problems.append("COOKIE_SAMESITE must be lax, strict or none")
    if s.cookie_samesite.lower() == "none" and not s.cookie_secure:
        problems.append("COOKIE_SAMESITE=none requires COOKIE_SECURE=true")
    origins = s.cors_origin_list
    if not origins:
        problems.append("CORS_ORIGINS must list the frontend origin")
    for o in origins:
        if o == "*" or not o.startswith("https://"):
            problems.append(f"CORS_ORIGINS entry {o!r} must be an explicit https:// origin")
    return problems


@lru_cache
def get_settings() -> Settings:
    return Settings()
