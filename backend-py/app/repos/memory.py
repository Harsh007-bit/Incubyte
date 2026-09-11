from __future__ import annotations

from app.errors import ConflictError
from app.models import Employee, ExchangeRate, ListFilters, SalaryRecord
from app.validators import pick_current_salary


class MemoryEmployeeRepository:
    def __init__(self, rows: list[Employee] | None = None):
        self.rows = rows or []

    def get_by_id(self, employee_id: str) -> Employee | None:
        return next((row for row in self.rows if row.id == employee_id), None)

    def _find_by_code(self, code: str) -> Employee | None:
        return next((row for row in self.rows if row.employee_code == code), None)

    def _find_by_email(self, email: str) -> Employee | None:
        needle = email.lower()
        return next((row for row in self.rows if row.email.lower() == needle), None)

    def insert(self, employee: Employee) -> Employee:
        last = sorted(
            (row.employee_code for row in self.rows if row.employee_code.startswith("ACME-"))
        )
        last_code = last[-1] if last else None
        suffix = int(last_code.split("-")[1]) if last_code else 0
        nxt = employee.employee_code or f"ACME-{suffix + 1:05d}"
        if self._find_by_email(employee.email):
            raise ConflictError("email already exists")
        if self._find_by_code(nxt):
            raise ConflictError(f"employee_code {nxt} already exists")
        stored = Employee(
            id=employee.id,
            employee_code=nxt,
            name=employee.name,
            email=employee.email,
            country_code=employee.country_code,
            department=employee.department,
            designation=employee.designation,
            status=employee.status,
            created_at=employee.created_at,
            updated_at=employee.updated_at,
        )
        self.rows.append(stored)
        return stored

    def update(self, employee: Employee) -> Employee:
        other = self._find_by_email(employee.email)
        if other and other.id != employee.id:
            raise ConflictError("email already exists")
        for i, row in enumerate(self.rows):
            if row.id == employee.id:
                self.rows[i] = employee
                break
        return employee

    def list_page(self, filters: ListFilters) -> tuple[list[Employee], int]:
        items = list(self.rows)
        if filters.names:
            items = [
                row
                for row in items
                if any(name.lower() in row.name.lower() for name in filters.names)
            ]
        if filters.countries:
            items = [row for row in items if row.country_code in filters.countries]
        if filters.departments:
            items = [row for row in items if row.department in filters.departments]
        if filters.statuses:
            items = [row for row in items if row.status in filters.statuses]
        items.sort(key=lambda row: row.name)
        return items[filters.offset : filters.offset + filters.limit], len(items)

    def list_active(self) -> list[Employee]:
        return [row for row in self.rows if row.status == "active"]


class MemorySalaryRepository:
    def __init__(self, rows: list[SalaryRecord] | None = None):
        self.rows = rows or []

    def insert(self, record: SalaryRecord) -> SalaryRecord:
        if any(
            row.employee_id == record.employee_id and row.effective_from == record.effective_from
            for row in self.rows
        ):
            raise ConflictError(
                "an employee cannot have two salary records with the same effective_from"
            )
        self.rows.append(record)
        return record

    def list_for_employee(self, employee_id: str) -> list[SalaryRecord]:
        return sorted(
            [row for row in self.rows if row.employee_id == employee_id],
            key=lambda row: row.effective_from,
            reverse=True,
        )

    def get_current_for_many(self, employee_ids: list[str], today: str) -> dict[str, SalaryRecord]:
        latest: dict[str, SalaryRecord] = {}
        for employee_id in employee_ids:
            current = pick_current_salary(
                [row for row in self.rows if row.employee_id == employee_id],
                today,
            )
            if current:
                latest[employee_id] = current
        return latest


class MemoryFxRepository:
    def __init__(self, rows: list[ExchangeRate] | None = None):
        self.rows = rows or []

    def upsert(self, rate: ExchangeRate) -> None:
        for i, row in enumerate(self.rows):
            if row.currency == rate.currency:
                self.rows[i] = rate
                return
        self.rows.append(rate)

    def list(self) -> list[ExchangeRate]:
        return list(self.rows)
