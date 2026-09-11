from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Config:
    port: int
    database_url: str
    tz: str


def _database_url() -> str:
    # On Vercel, Neon's pooled URL plus a client pool leaves stale SSL sockets.
    if os.environ.get("VERCEL"):
        return (
            os.environ.get("DATABASE_URL_UNPOOLED")
            or os.environ.get("POSTGRES_URL_NON_POOLING")
            or os.environ.get("DATABASE_URL")
            or os.environ.get("POSTGRES_URL")
            or "postgresql://acme:acme@localhost:5432/acme"
        )
    return (
        os.environ.get("DATABASE_URL")
        or os.environ.get("POSTGRES_URL")
        or "postgresql://acme:acme@localhost:5432/acme"
    )


def load_config() -> Config:
    return Config(
        port=int(os.environ.get("PORT", "8000")),
        database_url=_database_url(),
        tz=os.environ.get("APP_TZ", "Asia/Kolkata"),
    )


config = load_config()
