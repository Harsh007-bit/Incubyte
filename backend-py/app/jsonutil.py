from __future__ import annotations

from decimal import ROUND_HALF_UP, Decimal

from app.models import Employee, SalaryRecord


def money(amount: Decimal) -> str:
    return str(amount.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


def salary_json(record: SalaryRecord) -> dict:
    return {
        "id": record.id,
        "employee_id": record.employee_id,
        "base_amount": money(record.base_amount),
        "currency": record.currency,
        "effective_from": record.effective_from,
        "reason": record.reason,
        "created_at": record.created_at.isoformat().replace("+00:00", "Z")
        if record.created_at.tzinfo
        else record.created_at.isoformat() + "Z",
    }


def employee_json(employee: Employee, current_salary: SalaryRecord | None = None) -> dict:
    created = employee.created_at
    updated = employee.updated_at
    return {
        "id": employee.id,
        "employee_code": employee.employee_code,
        "name": employee.name,
        "email": employee.email,
        "country_code": employee.country_code,
        "department": employee.department,
        "designation": employee.designation,
        "status": employee.status,
        "created_at": created.isoformat().replace("+00:00", "Z") if created.tzinfo else created.isoformat() + "Z",
        "updated_at": updated.isoformat().replace("+00:00", "Z") if updated.tzinfo else updated.isoformat() + "Z",
        "current_salary": salary_json(current_salary) if current_salary else None,
    }
