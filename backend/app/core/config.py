import os
from pathlib import Path
from typing import List, Optional, Union
from pydantic import AnyHttpUrl, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=[
            str(Path(__file__).resolve().parent.parent.parent / ".env"),
            "backend/.env",
            ".env"
        ],
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore"
    )

    APP_ENV: str = "development"
    DEBUG: bool = True
    ENABLE_DEMO_SEED: bool = True
    MAX_REQUEST_SIZE_BYTES: int = 10 * 1024 * 1024  # 10 MB payload limit
    PROJECT_NAME: str = "TapMenu Open Hospitality Platform API"
    API_V1_PREFIX: str = "/api/v1"

    # Base Directory
    BASE_DIR: str = str(Path(__file__).resolve().parent.parent.parent)

    # Database
    DATABASE_URL: str = f"sqlite+aiosqlite:///{Path(__file__).resolve().parent.parent.parent.as_posix()}/tapmenu_hms.db"

    # Security
    SECRET_KEY: str = "dev_tapmenu_hms_jwt_secret_key_32chars_min!"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480
    TURNSTILE_SECRET_KEY: Optional[str] = None

    # Database Pool Settings
    # Per uvicorn worker process (Dockerfile runs WEB_CONCURRENCY workers, default 2): 2 x (10 + 5) = 30 connections max.
    POSTGRES_POOL_SIZE: int = 10
    POSTGRES_MAX_OVERFLOW: int = 5
    # Set True only when DATABASE_URL points at pgbouncer (transaction pooling breaks asyncpg prepared statements).
    DB_PGBOUNCER: bool = False
    # Public origin of this API, used to build absolute URLs (menu photos) for frontends on other hosts. '' = relative paths.
    PUBLIC_API_BASE_URL: str = ""
    # Public site URL for guest landing / QR hub redirects
    PUBLIC_SITE_URL: str = "http://localhost:5173"

    # Proxy and Security
    TRUST_PROXY: bool = False
    TRUSTED_PROXIES: str = "127.0.0.1,::1,10.0.0.0/8,172.16.0.0/12,192.168.0.0/16"

    # CORS
    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://localhost:5174",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
        "http://localhost:8000",
    ]

    @field_validator("SECRET_KEY", mode="after")
    @classmethod
    def validate_secret_key(cls, v: str) -> str:
        env = os.environ.get("APP_ENV", "development").lower()
        if env == "production":
            # "change_me" catches the docker-compose placeholder, which is long enough to pass the length check.
            if "dev" in v.lower() or "change_me" in v.lower() or len(v) < 32:
                raise ValueError("SECRET_KEY must be a secure, random string of at least 32 characters in production.")
        return v

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        origins: List[str] = []
        if isinstance(v, str) and not v.startswith("["):
            origins = [i.strip() for i in v.split(",") if i.strip()]
        elif isinstance(v, str) and v.startswith("["):
            import json
            try:
                origins = json.loads(v)
            except Exception:
                origins = []
        elif isinstance(v, list):
            origins = list(v)

        return origins

    @field_validator("DATABASE_URL", mode="after")
    @classmethod
    def assemble_database_url(cls, v: str) -> str:
        if v.startswith("postgres://"):
            return v.replace("postgres://", "postgresql+asyncpg://", 1)
        elif v.startswith("postgresql://"):
            return v.replace("postgresql://", "postgresql+asyncpg://", 1)
        return v

    # Multi-Property Defaults
    DEFAULT_ORG_ID: str = "org-openhms-01"
    DEFAULT_PROPERTY_ID: str = "prop-jaipur-01"
    DEFAULT_PROPERTY_CODE: str = "TM-JPR"

    # Website (Fastify) -> HMS integration. No default: integration routes return 503 until set.
    HMS_INTEGRATION_API_KEY: Optional[str] = None
    # Website backend (Fastify) that /api/v1/website/* forwards to
    WEBSITE_API_URL: str = "http://127.0.0.1:3001"
    # Website room_id -> HMS room_types.code, as "site-id:CODE,site-id:CODE"
    WEBSITE_ROOM_MAP: str = "deluxe:DLX_PALACE,super-deluxe:ROYAL_SUITE"
    # Google OAuth Client ID for customer authentication (optional, set via env in production)
    GOOGLE_CLIENT_ID: Optional[str] = None

    # Unified Payment Architecture Configuration: "demo", "razorpay", "bank"
    PAYMENT_PROVIDER: str = "demo"

    # Razorpay Provider Settings (Required only when PAYMENT_PROVIDER="razorpay")
    RAZORPAY_KEY_ID: Optional[str] = None
    RAZORPAY_KEY_SECRET: Optional[str] = None
    RAZORPAY_WEBHOOK_SECRET: Optional[str] = None

    # Server-sent F&B receipts. Leave unset to keep receipts off. WhatsApp wins when both are configured.
    # WhatsApp Cloud API: business-initiated messages need an APPROVED template (body variables, in order:
    # guest name, order number, total, restaurant). Without WHATSAPP_RECEIPT_TEMPLATE a plain text message is sent,
    # which WhatsApp only delivers inside the guest's 24-hour window (fine for testing, not for real receipts).
    WHATSAPP_CLOUD_TOKEN: Optional[str] = None
    WHATSAPP_CLOUD_PHONE_NUMBER_ID: Optional[str] = None
    WHATSAPP_RECEIPT_TEMPLATE: Optional[str] = None
    WHATSAPP_RECEIPT_LANG: str = "en"
    WHATSAPP_GRAPH_VERSION: str = "v21.0"
    # MSG91 SMS flow: the template must define VAR1..VAR4 as name, order number, total, restaurant (DLT-approved in India).
    MSG91_AUTH_KEY: Optional[str] = None
    MSG91_RECEIPT_TEMPLATE_ID: Optional[str] = None
    RECEIPT_DEFAULT_COUNTRY_CODE: str = "91"

    # Bank Payment Gateway Settings (Required only when PAYMENT_PROVIDER="bank")
    BANK_GATEWAY_API_URL: Optional[str] = None
    BANK_GATEWAY_MERCHANT_ID: Optional[str] = None
    BANK_GATEWAY_API_KEY: Optional[str] = None
    BANK_GATEWAY_CLIENT_ID: Optional[str] = None
    BANK_GATEWAY_CLIENT_SECRET: Optional[str] = None
    BANK_GATEWAY_CERT_PATH: Optional[str] = None


settings = Settings()
