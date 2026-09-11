from __future__ import annotations

from decimal import Decimal, InvalidOperation

from app.constants import COUNTRY_CODES, DEPARTMENTS, STATUSES, SUPPORTED_CURRENCIES
from app.dates import is_calendar_date
from app.errors import DomainError
from app.models import SalaryRecord

EMAIL = r"^[^\s@]+@[^\s@]+\.[^\s@]+$"


def validate_profile(
    name: str,
    email: str,
    country_code: str,
    department: str,
    designation: str,
    status: str,
) -> None:
    import re

    if not name.strip():
        raise DomainError("name is required")
    if not re.match(EMAIL, email.strip()):
        raise DomainError("email must be a valid email address")
    if country_code not in COUNTRY_CODES:
        raise DomainError(f"country_code must be one of {', '.join(COUNTRY_CODES)}")
    if department not in DEPARTMENTS:
        raise DomainError(f"department must be one of {', '.join(DEPARTMENTS)}")
    if not designation.strip():
        raise DomainError("designation is required")
    if status not in STATUSES:
        raise DomainError("status must be active or inactive")


def parse_amount(value: str | int | float | Decimal) -> Decimal:
    try:
        amount = Decimal(str(value))
        if amount.is_finite():
            return amount
    except (InvalidOperation, ValueError):
        pass
    raise DomainError("base_amount must be a number greater than zero")


def pick_current_salary(records: list[SalaryRecord], today: str) -> SalaryRecord | None:
    latest: SalaryRecord | None = None
    for row in records:
        if row.effective_from > today:
            continue
        if latest is None or row.effective_from > latest.effective_from:
            latest = row
    return latest


def validate_salary(base_amount: Decimal, currency: str, effective_from: str, reason: str) -> None:
    if base_amount <= 0:
        raise DomainError("base_amount must be greater than zero")
    if currency not in SUPPORTED_CURRENCIES:
        raise DomainError(f"currency must be one of {', '.join(SUPPORTED_CURRENCIES)}")
    if not is_calendar_date(effective_from):
        raise DomainError("effective_from must be a valid date")
    if not reason.strip():
        raise DomainError("reason must be non-empty")
