from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from app.errors import NotFoundError
from app.models import Employee, EmployeeStatus, ListFilters
from app.repos import EmployeeRepository
from app.validators import validate_profile


class EmployeeService:
    def __init__(self, employees: EmployeeRepository):
        self.employees = employees

    def create(
        self,
        name: str,
        email: str,
        country_code: str,
        department: str,
        designation: str,
        employee_code: str | None = None,
    ) -> Employee:
        name = name.strip()
        email = email.strip()
        designation = designation.strip()
        country_code = country_code.strip()
        department = department.strip()
        validate_profile(name, email, country_code, department, designation, "active")
        now = datetime.now(timezone.utc)
        return self.employees.insert(
            Employee(
                id=str(uuid4()),
                employee_code=(employee_code or "").strip(),
                name=name,
                email=email,
                country_code=country_code,
                department=department,
                designation=designation,
                status="active",
                created_at=now,
                updated_at=now,
            )
        )

    def get_by_id(self, employee_id: str) -> Employee:
        employee = self.employees.get_by_id(employee_id)
        if not employee:
            raise NotFoundError("employee not found")
        return employee

    def update_by_id(
        self,
        employee_id: str,
        *,
        name: str | None = None,
        email: str | None = None,
        country_code: str | None = None,
        department: str | None = None,
        designation: str | None = None,
        status: EmployeeStatus | None = None,
    ) -> Employee:
        employee = self.get_by_id(employee_id)
        nxt_name = (name if name is not None else employee.name).strip()
        nxt_email = (email if email is not None else employee.email).strip()
        nxt_country = (country_code if country_code is not None else employee.country_code).strip()
        nxt_dept = (department if department is not None else employee.department).strip()
        nxt_title = (designation if designation is not None else employee.designation).strip()
        nxt_status = status if status is not None else employee.status
        validate_profile(nxt_name, nxt_email, nxt_country, nxt_dept, nxt_title, nxt_status)
        return self.employees.update(
            Employee(
                id=employee.id,
                employee_code=employee.employee_code,
                name=nxt_name,
                email=nxt_email,
                country_code=nxt_country,
                department=nxt_dept,
                designation=nxt_title,
                status=nxt_status,
                created_at=employee.created_at,
                updated_at=datetime.now(timezone.utc),
            )
        )

    def list_page(self, filters: ListFilters) -> tuple[list[Employee], int]:
        return self.employees.list_page(filters)

    def create_many(self, rows: list[dict]) -> tuple[list[Employee], list[dict]]:
        created: list[Employee] = []
        errors: list[dict] = []
        for row in rows:
            try:
                created.append(
                    self.create(
                        name=row["name"],
                        email=row["email"],
                        country_code=row["country_code"],
                        department=row["department"],
                        designation=row["designation"],
                        employee_code=row.get("employee_code"),
                    )
                )
            except Exception as error:
                errors.append({"line": row["line"], "detail": str(error) if str(error) else "failed"})
        return created, errors
