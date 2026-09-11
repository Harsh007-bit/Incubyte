from __future__ import annotations

import os

from psycopg import Connection
from psycopg_pool import ConnectionPool

from app.config import config
from app.schema import SCHEMA_SQL


def _is_local_url(url: str) -> bool:
    return "localhost" in url or "127.0.0.1" in url


def _check_connection(conn: Connection) -> None:
    conn.execute("SELECT 1")


def create_pool(url: str | None = None) -> ConnectionPool:
    conninfo = url or config.database_url
    serverless = bool(os.environ.get("VERCEL"))
    connect_kwargs: dict = {}
    if not _is_local_url(conninfo):
        connect_kwargs = {
            "sslmode": "require",
            "keepalives": 1,
            "keepalives_idle": 30,
        }
    return ConnectionPool(
        conninfo=conninfo,
        min_size=0 if serverless else 1,
        max_size=1 if serverless else 10,
        max_idle=30,
        max_lifetime=300,
        timeout=30,
        check=_check_connection,
        kwargs=connect_kwargs or None,
        open=True,
    )


def migrate(db: ConnectionPool) -> None:
    with db.connection() as conn:
        conn.execute(SCHEMA_SQL)
        conn.commit()
