from decimal import Decimal

import pytest

from app.errors import ConflictError, DomainError
from tests.helpers import hire, world


def test_requires_name_and_valid_email():
    w = world()
    with pytest.raises(DomainError):
        w["employees"].create(
            name="  ",
            email="ada@acme.test",
            country_code="IN",
            department="Engineering",
            designation="Engineer",
        )
    with pytest.raises(DomainError):
        w["employees"].create(
            name="Ada",
            email="not-an-email",
            country_code="IN",
            department="Engineering",
            designation="Engineer",
        )


def test_rejects_duplicate_email_case_insensitive():
    w = world()
    hire(w["employees"], email="ada@acme.test")
    with pytest.raises(ConflictError):
        hire(w["employees"], name="Other", email="Ada@acme.test")


def test_filters_directory_by_department():
    w = world()
    hire(w["employees"], name="Eng One", email="e1@acme.test", department="Engineering")
    hire(w["employees"], name="Sales One", email="s1@acme.test", department="Sales")
    items, total = w["employees"].list_page(
        __import__("app.models", fromlist=["ListFilters"]).ListFilters(
            names=[],
            countries=[],
            departments=["Sales"],
            statuses=["active"],
            offset=0,
            limit=25,
        )
    )
    assert total == 1
    assert items[0].name == "Sales One"


def test_matches_any_of_several_name_terms_and_countries():
    from app.models import ListFilters

    w = world()
    hire(w["employees"], name="Ada Lovelace", email="ada@acme.test", country_code="IN")
    hire(w["employees"], name="Alan Turing", email="alan@acme.test", country_code="GB")
    hire(w["employees"], name="Grace Hopper", email="grace@acme.test", country_code="US")
    items, total = w["employees"].list_page(
        ListFilters(
            names=["Ada", "Alan"],
            countries=["IN", "GB"],
            departments=[],
            statuses=["active"],
            offset=0,
            limit=25,
        )
    )
    assert total == 2
    assert sorted(row.name for row in items) == ["Ada Lovelace", "Alan Turing"]


def test_create_many_partial_success():
    w = world()
    created, errors = w["employees"].create_many(
        [
            {
                "name": "Ada Lovelace",
                "email": "ada@acme.test",
                "country_code": "IN",
                "department": "Engineering",
                "designation": "Engineer",
                "line": 2,
            },
            {
                "name": "Bad",
                "email": "not-an-email",
                "country_code": "IN",
                "department": "Engineering",
                "designation": "Engineer",
                "line": 3,
            },
        ]
    )
    assert len(created) == 1
    assert created[0].name == "Ada Lovelace"
    assert errors == [{"line": 3, "detail": "email must be a valid email address"}]


def test_trim_on_update_email_collision():
    w = world()
    ada = hire(w["employees"], email="ada@acme.test")
    other = hire(w["employees"], name="Other", email="other@acme.test")
    saved = w["employees"].update_by_id(ada.id, name="  Ada  ", email="  Ada@acme.test  ")
    assert saved.name == "Ada"
    assert saved.email == "Ada@acme.test"
    with pytest.raises(ConflictError):
        w["employees"].update_by_id(other.id, email="  ada@acme.test  ")
