from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Config:
    port: int
    database_url: str
    tz: str


def load_config() -> Config:
    return Config(
        port=int(os.environ.get("PORT", "8000")),
        database_url=os.environ.get("DATABASE_URL")
        or os.environ.get("POSTGRES_URL")
        or "postgresql://acme:acme@localhost:5432/acme",
        tz=os.environ.get("APP_TZ", "Asia/Kolkata"),
    )


config = load_config()
