from __future__ import annotations

import sys
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from random import Random
from uuid import uuid4

from faker import Faker

from app.config import config
from app.constants import COUNTRY_CODES, COUNTRY_CURRENCY, DEPARTMENTS
from app.db import create_pool, migrate
from app.repos.pg import PgFxRepository
from app.services.fx import FxService

TOTAL = 10_000
SEED = 42

COUNTRY_BASE = {
    "US": "120000",
    "GB": "75000",
    "DE": "80000",
    "NL": "78000",
    "SG": "110000",
    "AU": "115000",
    "CA": "105000",
    "JP": "8500000",
    "AE": "220000",
    "IN": "1800000",
}

DEPT_FACTOR = {
    "Engineering": "1.15",
    "Product": "1.10",
    "Design": "1.00",
    "Sales": "1.05",
    "Marketing": "0.95",
    "Finance": "1.00",
    "HR": "0.90",
    "Operations": "0.85",
    "Customer Success": "0.88",
    "Legal": "1.12",
}

TITLES = {
    "Engineering": ["Software Engineer", "Senior Engineer", "Staff Engineer", "Engineering Manager"],
    "Product": ["Product Manager", "Senior Product Manager", "Product Lead"],
    "Design": ["Product Designer", "Senior Designer", "Design Lead"],
    "Sales": ["Account Executive", "Senior AE", "Sales Manager"],
    "Marketing": ["Marketing Manager", "Content Lead", "Growth Manager"],
    "Finance": ["Financial Analyst", "Accountant", "Finance Manager"],
    "HR": ["HR Generalist", "HRBP", "People Partner"],
    "Operations": ["Operations Associate", "Ops Manager"],
    "Customer Success": ["CSM", "Senior CSM"],
    "Legal": ["Counsel", "Senior Counsel"],
}

COUNTRY_WEIGHTS = [28, 22, 10, 8, 6, 6, 6, 5, 5, 4]


def add_days(iso: str, days: int) -> str:
    parsed = date.fromisoformat(iso) + timedelta(days=days)
    return parsed.isoformat()


def amount(country: str, department: str, rng: Random) -> Decimal:
    mid = Decimal(COUNTRY_BASE[country]) * Decimal(DEPT_FACTOR[department])
    factor = Decimal(str(round(0.72 + rng.random() * 0.73, 4)))
    return (mid * factor).quantize(Decimal("1"))


def insert_batch(conn, sql: str, rows: list[tuple], batch: int = 200) -> None:
    for i in range(0, len(rows), batch):
        slice_rows = rows[i : i + batch]
        placeholders = ",".join(["(" + ",".join(["%s"] * len(slice_rows[0])) + ")"] * len(slice_rows))
        params: list = []
        for row in slice_rows:
            params.extend(row)
        conn.execute(f"{sql} VALUES {placeholders}", params)
    conn.commit()


def refuse_remote_seed(url: str) -> None:
    lowered = url.lower()
    if "neon.tech" in lowered or "neon.database" in lowered:
        print("Refusing to seed a Neon database. Use local Docker Postgres.")
        sys.exit(1)


def run() -> None:
    refuse_remote_seed(config.database_url)
    pool = create_pool()
    migrate(pool)
    force = "--force" in sys.argv
    with pool.connection() as conn:
        count = conn.execute("SELECT COUNT(*)::int AS count FROM employees").fetchone()[0]
        if count > 0 and not force:
            print("Database already has employees. Refusing to seed twice. Pass --force to replace.")
            pool.close()
            return
        if force:
            conn.execute("TRUNCATE salary_records, employees CASCADE")
            conn.commit()

    FxService(PgFxRepository(pool)).seed_defaults()

    rng = Random(SEED)
    faker = Faker()
    faker.seed_instance(SEED)
    as_of = "2026-08-29"
    weight_sum = sum(COUNTRY_WEIGHTS)
    employees: list[tuple] = []
    salaries: list[tuple] = []
    now = datetime.now(timezone.utc)

    for index in range(1, TOTAL + 1):
        country_roll = rng.random() * weight_sum
        acc = 0.0
        country = COUNTRY_CODES[0]
        for i, code in enumerate(COUNTRY_CODES):
            acc += COUNTRY_WEIGHTS[i]
            if country_roll <= acc:
                country = code
                break
        department = DEPARTMENTS[rng.randrange(len(DEPARTMENTS))]
        employee_id = str(uuid4())
        employees.append(
            (
                employee_id,
                f"ACME-{index:05d}",
                faker.name(),
                f"{faker.user_name()}.{index}@acme.test".lower(),
                country,
                department,
                TITLES[department][rng.randrange(len(TITLES[department]))],
                "inactive" if rng.random() < 0.08 else "active",
                now,
                now,
            )
        )
        if rng.random() < 0.02:
            continue
        hired = add_days(as_of, -int(30 + rng.random() * 365 * 8))
        currency = COUNTRY_CURRENCY[country]
        last_from = add_days(hired, int(rng.random() * 60))
        last_amount = amount(country, department, rng)
        salaries.append((str(uuid4()), employee_id, f"{last_amount:.2f}", currency, last_from, "offer accepted", now))
        extra = 0 if rng.random() < 0.55 else (1 if rng.random() < 0.78 else 2)
        for _ in range(extra):
            last_from = add_days(last_from, int(280 + rng.random() * 140))
            if last_from > add_days(as_of, 180):
                break
            last_amount = (last_amount * Decimal(str(round(1.04 + rng.random() * 0.14, 4)))).quantize(Decimal("1"))
            salaries.append(
                (
                    str(uuid4()),
                    employee_id,
                    f"{last_amount:.2f}",
                    currency,
                    last_from,
                    "scheduled raise" if last_from > as_of else ["annual revision", "promotion", "market adjustment"][rng.randrange(3)],
                    now,
                )
            )

    with pool.connection() as conn:
        insert_batch(
            conn,
            "INSERT INTO employees (id, employee_code, name, email, country_code, department, designation, status, created_at, updated_at)",
            employees,
        )
        insert_batch(
            conn,
            "INSERT INTO salary_records (id, employee_id, base_amount, currency, effective_from, reason, created_at)",
            salaries,
        )
    print(f"Seeded {len(employees)} employees and {len(salaries)} salary records.")
    pool.close()


if __name__ == "__main__":
    run()
