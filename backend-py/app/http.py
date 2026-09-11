from __future__ import annotations

from collections.abc import Callable

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.constants import COUNTRY_CODES, DEPARTMENTS, STATUSES, SUPPORTED_CURRENCIES
from app.dates import calendar_date_today
from app.errors import ConflictError, DomainError, NotFoundError
from app.repos import EmployeeRepository, FxRepository, SalaryRepository
from app.routers.analytics import router as analytics_router
from app.routers.employees import router as employees_router
from app.services.analytics import AnalyticsService
from app.services.employees import EmployeeService
from app.services.fx import FxService
from app.services.salaries import SalaryService


def create_app(
    employees: EmployeeRepository,
    salaries: SalaryRepository,
    rates: FxRepository,
    today: Callable[[], str] | None = None,
) -> FastAPI:
    today_fn = today or calendar_date_today
    employee_service = EmployeeService(employees)
    salary_service = SalaryService(employees, salaries)
    fx = FxService(rates)
    analytics = AnalyticsService(employees, salaries, fx)

    app = FastAPI(title="ACME Pay API")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "https://acme-pay.vercel.app",
        ],
        allow_origin_regex=r"https://.*\.vercel\.app",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.state.employees = employee_service
    app.state.salaries = salary_service
    app.state.analytics = analytics
    app.state.today = today_fn

    @app.exception_handler(RequestValidationError)
    async def validation_handler(_request: Request, exc: RequestValidationError):
        first = exc.errors()[0] if exc.errors() else {}
        return JSONResponse(
            {"detail": first.get("msg", "invalid input"), "code": "invalid"},
            status_code=422,
        )

    @app.exception_handler(NotFoundError)
    async def not_found_handler(_request: Request, exc: NotFoundError):
        return JSONResponse({"detail": str(exc), "code": exc.code}, status_code=404)

    @app.exception_handler(ConflictError)
    async def conflict_handler(_request: Request, exc: ConflictError):
        return JSONResponse({"detail": str(exc), "code": exc.code}, status_code=409)

    @app.exception_handler(DomainError)
    async def domain_handler(_request: Request, exc: DomainError):
        return JSONResponse({"detail": str(exc), "code": exc.code}, status_code=400)

    @app.get("/api/health")
    def health():
        return {"status": "ok"}

    @app.get("/api/meta")
    def meta():
        return {
            "country_codes": list(COUNTRY_CODES),
            "departments": list(DEPARTMENTS),
            "currencies": list(SUPPORTED_CURRENCIES),
            "statuses": list(STATUSES),
        }

    app.include_router(employees_router)
    app.include_router(analytics_router)
    return app
