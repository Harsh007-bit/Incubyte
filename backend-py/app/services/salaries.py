from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from uuid import uuid4

from app.errors import NotFoundError
from app.models import SalaryRecord
from app.repos import EmployeeRepository, SalaryRepository
from app.validators import pick_current_salary, validate_salary


class SalaryService:
    def __init__(self, employees: EmployeeRepository, salaries: SalaryRepository):
        self.employees = employees
        self.salaries = salaries

    def add_salary(
        self,
        employee_id: str,
        base_amount: Decimal,
        currency: str,
        effective_from: str,
        reason: str,
    ) -> SalaryRecord:
        if not self.employees.get_by_id(employee_id):
            raise NotFoundError("employee not found")
        validate_salary(base_amount, currency, effective_from, reason)
        return self.salaries.insert(
            SalaryRecord(
                id=str(uuid4()),
                employee_id=employee_id,
                base_amount=base_amount,
                currency=currency,
                effective_from=effective_from,
                reason=reason.strip(),
                created_at=datetime.now(timezone.utc),
            )
        )

    def list_history(self, employee_id: str) -> list[SalaryRecord]:
        if not self.employees.get_by_id(employee_id):
            raise NotFoundError("employee not found")
        return self.salaries.list_for_employee(employee_id)

    def get_current(self, employee_id: str, today: str) -> SalaryRecord | None:
        return pick_current_salary(self.salaries.list_for_employee(employee_id), today)

    def get_current_for_many(self, employee_ids: list[str], today: str) -> dict[str, SalaryRecord]:
        return self.salaries.get_current_for_many(employee_ids, today)
