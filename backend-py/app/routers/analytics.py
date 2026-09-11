from __future__ import annotations

from fastapi import APIRouter, Request

from app.jsonutil import money

router = APIRouter(prefix="/api/analytics")


def _group_by(value: str | None) -> str:
    return value if isinstance(value, str) else "country"


@router.get("/headcount")
def headcount(request: Request, groupBy: str | None = None):
    analytics = request.app.state.analytics
    return analytics.headcount(_group_by(groupBy))


@router.get("/avg-salary")
def avg_salary(request: Request, groupBy: str | None = None):
    analytics = request.app.state.analytics
    today = request.app.state.today
    rows = analytics.avg_salary(_group_by(groupBy), today())
    return [
        {
            "group": row["group"],
            "avg_salary_usd": money(row["avg_salary_usd"]) if row["avg_salary_usd"] is not None else None,
            "paid_headcount": row["paid_headcount"],
            "headcount": row["headcount"],
        }
        for row in rows
    ]


@router.get("/spend")
def spend(request: Request, groupBy: str | None = None):
    analytics = request.app.state.analytics
    today = request.app.state.today
    rows = analytics.spend(_group_by(groupBy), today())
    return [
        {
            "group": row["group"],
            "spend_usd": money(row["spend_usd"]),
            "paid_headcount": row["paid_headcount"],
        }
        for row in rows
    ]
