from functools import lru_cache
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=BASE_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    database_url: str = "sqlite:///./caretrack.db"
    mqtt_broker_url: str = "broker.hivemq.com"
    mqtt_port: int = 1883
    mqtt_username: str = ""
    mqtt_password: str = ""
    mqtt_use_tls: bool | None = None
    cors_allowed_origins: str = "http://localhost:5173,http://localhost:8000,http://127.0.0.1:5173,http://127.0.0.1:8000"
    ws_auth_token: str = ""

    # Emergency email notifications (fall detection / critical vitals).
    # Leave SMTP_HOST empty to keep the pipeline inert (alerts are still
    # recorded, emails are marked FAILED with "SMTP not configured").
    email_alerts_enabled: bool = True
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_username: str = ""
    smtp_password: str = ""
    smtp_from: str = "CareTrack Alerts <alerts@caretrack.local>"
    smtp_use_tls: bool = True
    smtp_timeout_seconds: int = 10
    # Minimum gap between repeated alerts of the same category per device.
    alert_cooldown_seconds: int = 300
    # Extra addresses always copied on alert emails (comma separated),
    # e.g. a shared ward mailbox: "ward-a@hospital.org, oncall@hospital.org"
    alert_fallback_recipients: str = ""

    # Security & JWT
    secret_key: str = "caretrack-dev-secret-key-32-bytes-minimum-security-change-in-prod"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 1440  # 24 hours

    @property
    def mqtt_tls_enabled(self) -> bool:
        if self.mqtt_use_tls is not None:
            return self.mqtt_use_tls
        return self.mqtt_port in (8883, 8884)

    @property
    def alert_fallback_emails(self) -> list[str]:
        return [addr.strip() for addr in self.alert_fallback_recipients.split(",") if addr.strip()]

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_allowed_origins.split(",") if origin.strip()]

@lru_cache
def get_settings() -> Settings:
    return Settings()
