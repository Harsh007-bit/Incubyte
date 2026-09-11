from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from typing import Literal

EmployeeStatus = Literal["active", "inactive"]


@dataclass
class Employee:
    id: str
    employee_code: str
    name: str
    email: str
    country_code: str
    department: str
    designation: str
    status: EmployeeStatus
    created_at: datetime
    updated_at: datetime


@dataclass
class SalaryRecord:
    id: str
    employee_id: str
    base_amount: Decimal
    currency: str
    effective_from: str
    reason: str
    created_at: datetime


@dataclass
class ExchangeRate:
    currency: str
    rate_to_usd: Decimal
    updated_at: datetime


@dataclass
class ListFilters:
    names: list[str]
    countries: list[str]
    departments: list[str]
    statuses: list[str]
    offset: int
    limit: int
