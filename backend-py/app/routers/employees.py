from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Query, Request
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel, Field

from app.constants import PAGE_SIZE_DEFAULT, PAGE_SIZE_MAX
from app.excel import decode_excel_base64, parse_employee_excel, sample_employee_excel
from app.jsonutil import employee_json, salary_json
from app.models import ListFilters
from app.query import parse_positive_int, query_values
from app.validators import parse_amount

router = APIRouter(prefix="/api/employees")


class CreateEmployeeBody(BaseModel):
    name: str
    email: str
    country_code: str
    department: str
    designation: str
    employee_code: str | None = None


class UpdateEmployeeBody(BaseModel):
    name: str | None = None
    email: str | None = None
    country_code: str | None = None
    department: str | None = None
    designation: str | None = None
    status: str | None = None


class ImportExcelBody(BaseModel):
    file: str = Field(min_length=1)


class SalaryBody(BaseModel):
    base_amount: str | int | float
    currency: str
    effective_from: str
    reason: str


def _deps(request: Request):
    return request.app.state.employees, request.app.state.salaries, request.app.state.today


@router.get("")
def list_employees(
    request: Request,
    page: str | None = None,
    page_size: str | None = None,
    q: Annotated[list[str] | None, Query()] = None,
    country: Annotated[list[str] | None, Query()] = None,
    department: Annotated[list[str] | None, Query()] = None,
    status: Annotated[list[str] | None, Query()] = None,
):
    employees, salaries, today = _deps(request)
    page_n = parse_positive_int(page, 1)
    size = parse_positive_int(page_size, PAGE_SIZE_DEFAULT, PAGE_SIZE_MAX)
    items, total = employees.list_page(
        ListFilters(
            names=query_values(q),
            countries=query_values(country),
            departments=query_values(department),
            statuses=query_values(status),
            offset=(page_n - 1) * size,
            limit=size,
        )
    )
    current = salaries.get_current_for_many([row.id for row in items], today())
    return {
        "items": [employee_json(row, current.get(row.id)) for row in items],
        "page": page_n,
        "page_size": size,
        "total": total,
    }


@router.post("", status_code=201)
def hire(request: Request, body: CreateEmployeeBody):
    employees, _, _ = _deps(request)
    employee = employees.create(
        name=body.name,
        email=body.email,
        country_code=body.country_code,
        department=body.department,
        designation=body.designation,
        employee_code=body.employee_code,
    )
    return employee_json(employee, None)


@router.get("/import/sample")
def import_sample():
    data = sample_employee_excel()
    return Response(
        content=data,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=employees-sample.xlsx"},
    )


@router.post("/import")
def import_employees(request: Request, body: ImportExcelBody):
    employees, _, _ = _deps(request)
    created, errors = employees.create_many(parse_employee_excel(decode_excel_base64(body.file)))
    return {"created": len(created), "errors": errors}


@router.get("/{employee_id}")
def get_employee(request: Request, employee_id: str):
    employees, salaries, today = _deps(request)
    employee = employees.get_by_id(employee_id)
    current = salaries.get_current(employee.id, today())
    return employee_json(employee, current)


@router.patch("/{employee_id}")
def patch_employee(request: Request, employee_id: str, body: UpdateEmployeeBody):
    employees, salaries, today = _deps(request)
    employee = employees.update_by_id(
        employee_id,
        name=body.name,
        email=body.email,
        country_code=body.country_code,
        department=body.department,
        designation=body.designation,
        status=body.status,  # type: ignore[arg-type]
    )
    current = salaries.get_current(employee.id, today())
    return employee_json(employee, current)


@router.get("/{employee_id}/salary-history")
def salary_history(request: Request, employee_id: str):
    _, salaries, _ = _deps(request)
    return [salary_json(row) for row in salaries.list_history(employee_id)]


@router.post("/{employee_id}/salary", status_code=201)
def add_salary(request: Request, employee_id: str, body: SalaryBody):
    _, salaries, _ = _deps(request)
    salary = salaries.add_salary(
        employee_id=employee_id,
        base_amount=parse_amount(body.base_amount),
        currency=body.currency,
        effective_from=body.effective_from,
        reason=body.reason,
    )
    return salary_json(salary)
