from __future__ import annotations

from pathlib import Path
from typing import List

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

REPO_ROOT = Path(__file__).resolve().parents[1]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="GEONOVUM_",
        case_sensitive=False,
    )

    data_dir: Path = REPO_ROOT / "data"
    frontend_dir: Path = REPO_ROOT / "Frontend"
    cors_origins: List[str] = ["*"]
    pdok_cbs_base: str = "https://api.pdok.nl/cbs/gebiedsindelingen/ogc/v1"
    pdok_bag_base: str = "https://api.pdok.nl/kadaster/bag/ogc/v2"
    yearcode: int = 2025
    summary_max_age_seconds: int = 24 * 60 * 60
    log_level: str = "INFO"

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _split_cors_origins(cls, value: object) -> object:
        if isinstance(value, str):
            return [item.strip() for item in value.split(",") if item.strip()]
        return value

    @field_validator("data_dir", "frontend_dir", mode="after")
    @classmethod
    def _resolve_path(cls, value: Path) -> Path:
        return value.resolve()


settings = Settings()
