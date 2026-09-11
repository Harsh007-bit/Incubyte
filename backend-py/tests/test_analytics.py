from decimal import Decimal

from tests.helpers import hire, pay, world


def test_excludes_inactive_from_spend():
    w = world()
    w["fx"].seed_defaults()
    active = hire(w["employees"], email="active@acme.test")
    inactive = hire(w["employees"], name="Old Hand", email="old@acme.test")
    pay(w["salaries"], active.id, "1000000", "2026-01-01")
    pay(w["salaries"], inactive.id, "2000000", "2026-01-01")
    w["employees"].update_by_id(inactive.id, status="inactive")
    india = next(row for row in w["analytics"].spend("country", "2026-08-01") if row["group"] == "IN")
    assert india["spend_usd"] == Decimal("12000.00")
    assert india["paid_headcount"] == 1


def test_converts_spend_with_current_rate():
    w = world()
    w["fx"].seed_defaults()
    person = hire(w["employees"])
    pay(w["salaries"], person.id, "1000000", "2026-01-01")
    india = next(row for row in w["analytics"].spend("country", "2026-08-01") if row["group"] == "IN")
    assert india["spend_usd"] == Decimal("12000.00")


def test_unpaid_in_headcount_not_average():
    w = world()
    w["fx"].seed_defaults()
    paid = hire(w["employees"], email="paid@acme.test")
    hire(w["employees"], name="New Join", email="new@acme.test")
    pay(w["salaries"], paid.id, "1000000", "2026-01-01")
    headcount = next(row for row in w["analytics"].headcount("country") if row["group"] == "IN")
    average = next(row for row in w["analytics"].avg_salary("country", "2026-08-01") if row["group"] == "IN")
    assert headcount["headcount"] == 2
    assert average["headcount"] == 2
    assert average["paid_headcount"] == 1
    assert average["avg_salary_usd"] == Decimal("12000.00")
