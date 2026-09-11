from io import BytesIO

import pytest
from openpyxl import Workbook

from app.errors import DomainError
from app.excel import parse_employee_excel


def workbook(rows: list[list]) -> bytes:
    book = Workbook()
    sheet = book.active
    sheet.title = "People"
    for row in rows:
        sheet.append(row if row else [None])
    out = BytesIO()
    book.save(out)
    return out.getvalue()


def test_parses_aliases_and_optional_codes():
    rows = parse_employee_excel(
        workbook(
            [
                ["name", "email", "country", "dept", "title", "employee_code"],
                ["Chen, James", "james@acme.test", "US", "Product", "Lead", "ACME-00001"],
            ]
        )
    )
    assert rows == [
        {
            "name": "Chen, James",
            "email": "james@acme.test",
            "country_code": "US",
            "department": "Product",
            "designation": "Lead",
            "employee_code": "ACME-00001",
            "line": 2,
        }
    ]


def test_rejects_missing_header():
    with pytest.raises(DomainError):
        parse_employee_excel(workbook([["name", "email"], ["Ada", "ada@acme.test"]]))


def test_keeps_original_sheet_row_numbers():
    rows = parse_employee_excel(
        workbook(
            [
                ["name", "email", "country_code", "department", "designation"],
                [],
                ["Ada Lovelace", "ada@acme.test", "IN", "Engineering", "Engineer"],
                [],
                ["Bad", "not-an-email", "IN", "Engineering", "Engineer"],
            ]
        )
    )
    assert [row["line"] for row in rows] == [3, 5]


def test_rejects_more_than_500():
    people = [[f"Person {i}", f"p{i}@acme.test", "IN", "Engineering", "Engineer"] for i in range(501)]
    with pytest.raises(DomainError, match="at most 500"):
        parse_employee_excel(
            workbook([["name", "email", "country_code", "department", "designation"], *people])
        )
