from __future__ import annotations

import os
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app.db import create_pool, migrate
from app.http import create_app
from app.repos.pg import PgEmployeeRepository, PgFxRepository, PgSalaryRepository
from app.services.fx import FxService

URL = os.environ.get("TEST_DATABASE_URL")

if URL and ("neon.tech" in URL.lower() or "neon.database" in URL.lower()):
    raise RuntimeError("TEST_DATABASE_URL must not point at Neon")

pytestmark = pytest.mark.skipif(not URL, reason="TEST_DATABASE_URL not set")


@pytest.fixture(scope="module")
def pg():
    pool = create_pool(URL)
    migrate(pool)
    FxService(PgFxRepository(pool)).seed_defaults()
    app = create_app(
        PgEmployeeRepository(pool),
        PgSalaryRepository(pool),
        PgFxRepository(pool),
        today=lambda: "2026-08-15",
    )
    yield TestClient(app), pool
    pool.close()


@pytest.fixture(autouse=True)
def _truncate(pg):
    _, pool = pg
    with pool.connection() as conn:
        conn.execute("TRUNCATE salary_records, employees RESTART IDENTITY CASCADE")
        conn.commit()


def hire(client: TestClient, email: str | None = None) -> dict:
    response = client.post(
        "/api/employees",
        json={
            "name": "Ada Lovelace",
            "email": email or f"ada-{uuid4()}@acme.com",
            "country_code": "IN",
            "department": "Engineering",
            "designation": "Engineer",
        },
    )
    assert response.status_code == 201
    return response.json()


def test_rejects_second_salary_on_same_effective_from_via_unique(pg):
    client, _ = pg
    employee = hire(client)
    first = client.post(
        f"/api/employees/{employee['id']}/salary",
        json={
            "base_amount": "1000000",
            "currency": "INR",
            "effective_from": "2026-07-01",
            "reason": "offer accepted",
        },
    )
    assert first.status_code == 201

    duplicate = client.post(
        f"/api/employees/{employee['id']}/salary",
        json={
            "base_amount": "1500000",
            "currency": "INR",
            "effective_from": "2026-07-01",
            "reason": "correction",
        },
    )
    assert duplicate.status_code == 409
    history = client.get(f"/api/employees/{employee['id']}/salary-history")
    assert len(history.json()) == 1


def test_rejects_duplicate_email_regardless_of_case(pg):
    client, _ = pg
    hire(client, "ada@acme.com")
    clash = client.post(
        "/api/employees",
        json={
            "name": "Other Ada",
            "email": "Ada@acme.com",
            "country_code": "IN",
            "department": "Engineering",
            "designation": "Engineer",
        },
    )
    assert clash.status_code == 409


def test_check_rejects_zero_amount_if_service_bypassed(pg):
    client, pool = pg
    employee = hire(client)
    with pytest.raises(Exception) as caught:
        with pool.connection() as conn:
            conn.execute(
                """
                INSERT INTO salary_records (id, employee_id, base_amount, currency, effective_from, reason)
                VALUES (%s,%s,0,'INR','2026-01-01','x')
                """,
                (str(uuid4()), employee["id"]),
            )
            conn.commit()
    assert getattr(caught.value, "sqlstate", None) == "23514"


def test_hire_without_salary_current_is_null(pg):
    client, _ = pg
    employee = hire(client)
    detail = client.get(f"/api/employees/{employee['id']}")
    assert detail.json()["current_salary"] is None


def test_malformed_employee_id_is_not_found(pg):
    client, _ = pg
    response = client.get("/api/employees/not-a-uuid")
    assert response.status_code == 404
    assert response.json()["code"] == "not_found"
