from decimal import Decimal

import pytest

from app.errors import ConflictError, DomainError
from tests.helpers import hire, pay, world


def test_does_not_overwrite_previous_records():
    w = world()
    person = hire(w["employees"])
    pay(w["salaries"], person.id, "1000000", "2026-01-01")
    pay(w["salaries"], person.id, "1200000", "2026-07-01", "promotion")
    history = w["salaries"].list_history(person.id)
    assert len(history) == 2
    assert sorted(str(row.base_amount.quantize(Decimal("0.01"))) for row in history) == [
        "1000000.00",
        "1200000.00",
    ]


def test_latest_effective_from_not_in_the_future():
    w = world()
    person = hire(w["employees"])
    pay(w["salaries"], person.id, "1000000", "2026-01-01")
    pay(w["salaries"], person.id, "1200000", "2026-07-01")
    current = w["salaries"].get_current(person.id, "2026-08-01")
    assert current.base_amount == Decimal("1200000")


def test_ignores_future_dated_salary():
    w = world()
    person = hire(w["employees"])
    pay(w["salaries"], person.id, "1000000", "2026-01-01")
    pay(w["salaries"], person.id, "1500000", "2026-12-01", "scheduled raise")
    current = w["salaries"].get_current(person.id, "2026-08-15")
    assert current.base_amount == Decimal("1000000")


def test_rejects_duplicate_effective_from():
    w = world()
    person = hire(w["employees"])
    pay(w["salaries"], person.id, "1000000", "2026-07-01")
    with pytest.raises(ConflictError):
        pay(w["salaries"], person.id, "1500000", "2026-07-01", "correction")
    assert len(w["salaries"].list_history(person.id)) == 1


def test_hire_without_salary():
    w = world()
    person = hire(w["employees"])
    assert person.id
    assert w["salaries"].list_history(person.id) == []
    assert w["salaries"].get_current(person.id, "2026-08-01") is None


def test_history_after_inactive():
    w = world()
    person = hire(w["employees"])
    pay(w["salaries"], person.id, "1000000", "2026-01-01")
    w["employees"].update_by_id(person.id, status="inactive")
    history = w["salaries"].list_history(person.id)
    assert len(history) == 1
    assert history[0].base_amount == Decimal("1000000")


def test_rejects_amount_zero():
    w = world()
    person = hire(w["employees"])
    with pytest.raises(DomainError):
        pay(w["salaries"], person.id, "0", "2026-01-01")
    assert w["salaries"].list_history(person.id) == []


def test_rejects_impossible_date():
    w = world()
    person = hire(w["employees"])
    with pytest.raises(DomainError):
        pay(w["salaries"], person.id, "1000000", "2026-02-31")
    assert w["salaries"].list_history(person.id) == []
