from __future__ import annotations

from psycopg_pool import ConnectionPool

from app.config import config
from app.schema import SCHEMA_SQL


def _is_local_url(url: str) -> bool:
    return "localhost" in url or "127.0.0.1" in url


def create_pool(url: str | None = None) -> ConnectionPool:
    conninfo = url or config.database_url
    kwargs: dict = {"conninfo": conninfo, "min_size": 1, "max_size": 10}
    if not _is_local_url(conninfo):
        kwargs["kwargs"] = {"sslmode": "require"}
    return ConnectionPool(open=True, **kwargs)


def migrate(db: ConnectionPool) -> None:
    with db.connection() as conn:
        conn.execute(SCHEMA_SQL)
        conn.commit()
