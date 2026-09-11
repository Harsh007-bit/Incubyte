from app.repos.memory import MemoryEmployeeRepository, MemoryFxRepository, MemorySalaryRepository
from app.services.analytics import AnalyticsService
from app.services.employees import EmployeeService
from app.services.fx import FxService
from app.services.salaries import SalaryService


def world():
    employees_repo = MemoryEmployeeRepository()
    salaries_repo = MemorySalaryRepository()
    rates = MemoryFxRepository()
    fx = FxService(rates)
    return {
        "employees": EmployeeService(employees_repo),
        "salaries": SalaryService(employees_repo, salaries_repo),
        "fx": fx,
        "analytics": AnalyticsService(employees_repo, salaries_repo, fx),
    }


def hire(service: EmployeeService, **overrides):
    return service.create(
        name=overrides.get("name", "Ada Lovelace"),
        email=overrides.get("email", "ada@acme.test"),
        country_code=overrides.get("country_code", "IN"),
        department=overrides.get("department", "Engineering"),
        designation=overrides.get("designation", "Engineer"),
    )


def pay(service: SalaryService, employee_id: str, amount: str, when: str, reason: str = "annual revision"):
    from decimal import Decimal

    return service.add_salary(employee_id, Decimal(amount), "INR", when, reason)
