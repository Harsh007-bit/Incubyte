from __future__ import annotations

from decimal import ROUND_HALF_UP, Decimal

from app.errors import DomainError
from app.models import Employee
from app.repos import EmployeeRepository, SalaryRepository
from app.services.fx import FxService

GROUP_FIELDS = {
    "country": "country_code",
    "department": "department",
}


class AnalyticsService:
    def __init__(
        self,
        employees: EmployeeRepository,
        salaries: SalaryRepository,
        fx: FxService,
    ):
        self.employees = employees
        self.salaries = salaries
        self.fx = fx

    def _group_active(self, group_by: str) -> list[tuple[str, list[Employee]]]:
        if group_by not in GROUP_FIELDS:
            raise DomainError("groupBy must be country or department")
        field = GROUP_FIELDS[group_by]
        buckets: dict[str, list[Employee]] = {}
        for employee in self.employees.list_active():
            key = getattr(employee, field)
            buckets.setdefault(key, []).append(employee)
        return sorted(buckets.items(), key=lambda item: item[0])

    def _load_grouped_pay(self, group_by: str, today: str):
        buckets = self._group_active(group_by)
        rates = self.fx.get_rate_table()
        ids = [employee.id for _, people in buckets for employee in people]
        current = self.salaries.get_current_for_many(ids, today)
        return buckets, rates, current

    def headcount(self, group_by: str = "country"):
        return [{"group": group, "headcount": len(people)} for group, people in self._group_active(group_by)]

    def spend(self, group_by: str, today: str):
        buckets, rates, current = self._load_grouped_pay(group_by, today)
        rows = []
        for group, people in buckets:
            spend_usd = Decimal("0")
            paid = 0
            for employee in people:
                record = current.get(employee.id)
                if not record:
                    continue
                spend_usd += self.fx.to_usd(record.base_amount, record.currency, rates)
                paid += 1
            rows.append({"group": group, "spend_usd": spend_usd, "paid_headcount": paid})
        return rows

    def avg_salary(self, group_by: str, today: str):
        buckets, rates, current = self._load_grouped_pay(group_by, today)
        rows = []
        for group, people in buckets:
            paid_amounts = []
            for employee in people:
                record = current.get(employee.id)
                if record:
                    paid_amounts.append(self.fx.to_usd(record.base_amount, record.currency, rates))
            if not paid_amounts:
                avg = None
            else:
                total = sum(paid_amounts, Decimal("0"))
                avg = (total / Decimal(len(paid_amounts))).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            rows.append(
                {
                    "group": group,
                    "avg_salary_usd": avg,
                    "paid_headcount": len(paid_amounts),
                    "headcount": len(people),
                }
            )
        return rows
