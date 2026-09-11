from __future__ import annotations

from decimal import Decimal
from uuid import UUID

from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

from app.errors import ConflictError, DomainError
from app.models import Employee, ExchangeRate, ListFilters, SalaryRecord


def _pg_code(error: BaseException) -> str | None:
    return getattr(error, "sqlstate", None) or getattr(error, "pgcode", None)


def _to_employee(row: dict) -> Employee:
    return Employee(
        id=str(row["id"]),
        employee_code=row["employee_code"],
        name=row["name"],
        email=row["email"],
        country_code=row["country_code"],
        department=row["department"],
        designation=row["designation"],
        status=row["status"],
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


def _to_salary(row: dict) -> SalaryRecord:
    effective = row["effective_from"]
    return SalaryRecord(
        id=str(row["id"]),
        employee_id=str(row["employee_id"]),
        base_amount=Decimal(str(row["base_amount"])),
        currency=row["currency"],
        effective_from=effective.isoformat() if hasattr(effective, "isoformat") else str(effective),
        reason=row["reason"],
        created_at=row["created_at"],
    )


def _escape_ilike(value: str) -> str:
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


class PgEmployeeRepository:
    def __init__(self, db: ConnectionPool):
        self.db = db

    def get_by_id(self, employee_id: str) -> Employee | None:
        try:
            UUID(employee_id)
        except ValueError:
            return None
        with self.db.connection() as conn:
            with conn.cursor(row_factory=dict_row) as cur:
                cur.execute("SELECT * FROM employees WHERE id = %s", (employee_id,))
                found = cur.fetchone()
                return _to_employee(found) if found else None

    def insert(self, employee: Employee) -> Employee:
        with self.db.connection() as conn:
            try:
                conn.execute("BEGIN")
                conn.execute("SELECT pg_advisory_xact_lock(87231001)")
                code = employee.employee_code
                if not code:
                    seq = conn.execute(
                        """
                        SELECT COALESCE(MAX(CAST(SUBSTRING(employee_code FROM 6) AS INTEGER)), 0)::text AS n
                        FROM employees
                        WHERE employee_code ~ '^ACME-[0-9]+$'
                        """
                    ).fetchone()
                    n = int(seq[0]) if seq else 0
                    code = f"ACME-{n + 1:05d}"
                with conn.cursor(row_factory=dict_row) as cur:
                    cur.execute(
                        """
                        INSERT INTO employees
                          (id, employee_code, name, email, country_code, department, designation, status, created_at, updated_at)
                        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                        RETURNING *
                        """,
                        (
                            employee.id,
                            code,
                            employee.name,
                            employee.email,
                            employee.country_code,
                            employee.department,
                            employee.designation,
                            employee.status,
                            employee.created_at,
                            employee.updated_at,
                        ),
                    )
                    row = cur.fetchone()
                conn.commit()
                return _to_employee(row)
            except Exception as error:
                conn.rollback()
                if _pg_code(error) == "23505":
                    raise ConflictError("employee_code or email already exists") from error
                raise

    def update(self, employee: Employee) -> Employee:
        try:
            with self.db.connection() as conn:
                with conn.cursor(row_factory=dict_row) as cur:
                    cur.execute(
                        """
                        UPDATE employees
                        SET name=%s, email=%s, country_code=%s, department=%s, designation=%s, status=%s, updated_at=%s
                        WHERE id=%s
                        RETURNING *
                        """,
                        (
                            employee.name,
                            employee.email,
                            employee.country_code,
                            employee.department,
                            employee.designation,
                            employee.status,
                            employee.updated_at,
                            employee.id,
                        ),
                    )
                    row = cur.fetchone()
                    conn.commit()
                    return _to_employee(row)
        except Exception as error:
            if _pg_code(error) == "23505":
                raise ConflictError("email already exists") from error
            raise

    def list_page(self, filters: ListFilters) -> tuple[list[Employee], int]:
        clauses: list[str] = []
        params: list = []
        if filters.names:
            parts = []
            for name in filters.names:
                params.append(f"%{_escape_ilike(name)}%")
                parts.append(f"name ILIKE %s ESCAPE '\\'")
            clauses.append(f"({' OR '.join(parts)})")
        if filters.countries:
            params.append(filters.countries)
            clauses.append("country_code = ANY(%s)")
        if filters.departments:
            params.append(filters.departments)
            clauses.append("department = ANY(%s)")
        if filters.statuses:
            params.append(filters.statuses)
            clauses.append("status = ANY(%s)")
        where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
        with self.db.connection() as conn:
            with conn.cursor(row_factory=dict_row) as cur:
                cur.execute(f"SELECT COUNT(*)::text AS count FROM employees {where}", params)
                total = int(cur.fetchone()["count"])
                cur.execute(
                    f"SELECT * FROM employees {where} ORDER BY name ASC OFFSET %s LIMIT %s",
                    [*params, filters.offset, filters.limit],
                )
                items = [_to_employee(row) for row in cur.fetchall()]
        return items, total

    def list_active(self) -> list[Employee]:
        with self.db.connection() as conn:
            with conn.cursor(row_factory=dict_row) as cur:
                cur.execute("SELECT * FROM employees WHERE status = 'active'")
                return [_to_employee(row) for row in cur.fetchall()]


class PgSalaryRepository:
    def __init__(self, db: ConnectionPool):
        self.db = db

    def insert(self, record: SalaryRecord) -> SalaryRecord:
        try:
            with self.db.connection() as conn:
                with conn.cursor(row_factory=dict_row) as cur:
                    cur.execute(
                        """
                        INSERT INTO salary_records
                          (id, employee_id, base_amount, currency, effective_from, reason, created_at)
                        VALUES (%s,%s,%s,%s,%s::date,%s,%s)
                        RETURNING id, employee_id, base_amount::text, currency, effective_from::text, reason, created_at
                        """,
                        (
                            record.id,
                            record.employee_id,
                            f"{record.base_amount:.2f}",
                            record.currency,
                            record.effective_from,
                            record.reason,
                            record.created_at,
                        ),
                    )
                    row = cur.fetchone()
                    conn.commit()
                    return _to_salary(row)
        except Exception as error:
            code = _pg_code(error)
            if code == "23505":
                raise ConflictError(
                    "an employee cannot have two salary records with the same effective_from"
                ) from error
            if code == "23514":
                raise DomainError("salary failed a database check constraint") from error
            raise

    def list_for_employee(self, employee_id: str) -> list[SalaryRecord]:
        with self.db.connection() as conn:
            with conn.cursor(row_factory=dict_row) as cur:
                cur.execute(
                    """
                    SELECT id, employee_id, base_amount::text, currency, effective_from::text, reason, created_at
                    FROM salary_records
                    WHERE employee_id = %s
                    ORDER BY effective_from DESC
                    """,
                    (employee_id,),
                )
                return [_to_salary(row) for row in cur.fetchall()]

    def get_current_for_many(self, employee_ids: list[str], today: str) -> dict[str, SalaryRecord]:
        if not employee_ids:
            return {}
        with self.db.connection() as conn:
            with conn.cursor(row_factory=dict_row) as cur:
                cur.execute(
                    """
                    SELECT id, employee_id, base_amount::text, currency, effective_from::text, reason, created_at
                    FROM salary_records
                    WHERE employee_id = ANY(%s::uuid[]) AND effective_from <= %s::date
                    """,
                    (employee_ids, today),
                )
                latest: dict[str, SalaryRecord] = {}
                for row in cur.fetchall():
                    record = _to_salary(row)
                    current = latest.get(record.employee_id)
                    if not current or record.effective_from > current.effective_from:
                        latest[record.employee_id] = record
                return latest


class PgFxRepository:
    def __init__(self, db: ConnectionPool):
        self.db = db

    def upsert(self, rate: ExchangeRate) -> None:
        with self.db.connection() as conn:
            conn.execute(
                """
                INSERT INTO exchange_rates (currency, rate_to_usd, updated_at)
                VALUES (%s,%s,%s)
                ON CONFLICT (currency)
                DO UPDATE SET rate_to_usd = EXCLUDED.rate_to_usd, updated_at = EXCLUDED.updated_at
                """,
                (rate.currency, str(rate.rate_to_usd), rate.updated_at),
            )
            conn.commit()

    def list(self) -> list[ExchangeRate]:
        with self.db.connection() as conn:
            with conn.cursor(row_factory=dict_row) as cur:
                cur.execute("SELECT currency, rate_to_usd::text, updated_at FROM exchange_rates")
                return [
                    ExchangeRate(
                        currency=row["currency"],
                        rate_to_usd=Decimal(str(row["rate_to_usd"])),
                        updated_at=row["updated_at"],
                    )
                    for row in cur.fetchall()
                ]
