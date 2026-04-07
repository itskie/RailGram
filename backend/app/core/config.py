from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # App
    app_name: str = "RailGram"
    environment: str = "development"
    debug: bool = False  # Always False in production

    # Database
    database_url: str = "postgresql+asyncpg://railgram:railgram_dev@localhost:5432/railgram"

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # JWT
    secret_key: str
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60
    refresh_token_expire_days: int = 30

    # CORS — comma-separated list of allowed origins
    allowed_origins: str = "http://localhost:5173,http://localhost:3000"

    # AWS S3 (media storage)
    aws_access_key_id: str = ""
    aws_secret_access_key: str = ""
    aws_region: str = "ap-south-1"
    aws_s3_bucket: str = "railgram-media-prod"
    cloudfront_url: str = ""  # e.g. https://dzdr0nfpn0f2c.cloudfront.net

    # Site URL (used in email links)
    site_url: str = "https://railgram.in"

    # Email (Resend)
    resend_api_key: str = ""
    email_from: str = "noreply@railgram.in"

    # Rate limiting
    rate_limit_default: str = "60/minute"
    rate_limit_auth: str = "10/minute"
    
    # Account lockout settings
    lockout_max_attempts: int = 5
    lockout_duration_minutes: int = 15

    # Webhook
    webhook_secret: str

    @property
    def is_production(self) -> bool:
        return self.environment.lower() == "production"

    @property
    def allowed_origins_list(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",")]


@lru_cache
def get_settings() -> Settings:
    return Settings()
