from io import BytesIO

from fastapi.testclient import TestClient
from openpyxl import Workbook

from app.http import create_app
from app.repos.memory import MemoryEmployeeRepository, MemoryFxRepository, MemorySalaryRepository
from app.services.employees import EmployeeService
from tests.helpers import hire


def http(employees=None):
    employees = employees or MemoryEmployeeRepository()
    app = create_app(employees, MemorySalaryRepository(), MemoryFxRepository(), today=lambda: "2026-08-15")
    return employees, TestClient(app)


def test_honours_page_and_page_size():
    employees, client = http()
    service = EmployeeService(employees)
    for i in range(12):
        hire(service, email=f"p{i}@acme.test", name=f"Person {i:02d}")
    page2 = client.get("/api/employees?page=2&page_size=5")
    assert page2.status_code == 200
    assert page2.json()["page"] == 2
    assert page2.json()["page_size"] == 5
    assert len(page2.json()["items"]) == 5
    page1 = client.get("/api/employees?page=1&page_size=5")
    assert page1.json()["items"][0]["id"] != page2.json()["items"][0]["id"]


def test_non_numeric_page_is_page_1():
    employees, client = http()
    hire(EmployeeService(employees))
    response = client.get("/api/employees?page=foo")
    assert response.status_code == 200
    assert response.json()["page"] == 1
    assert len(response.json()["items"]) == 1


def test_garbage_salary_amount_400():
    employees, client = http()
    person = hire(EmployeeService(employees))
    response = client.post(
        f"/api/employees/{person.id}/salary",
        json={
            "base_amount": "abc",
            "currency": "INR",
            "effective_from": "2026-07-01",
            "reason": "offer accepted",
        },
    )
    assert response.status_code == 400
    assert response.json()["code"] == "invalid"


def test_impossible_effective_from_400():
    employees, client = http()
    person = hire(EmployeeService(employees))
    response = client.post(
        f"/api/employees/{person.id}/salary",
        json={
            "base_amount": "1000000",
            "currency": "INR",
            "effective_from": "2026-02-31",
            "reason": "offer accepted",
        },
    )
    assert response.status_code == 400
    assert "valid date" in response.json()["detail"]


def test_updates_profile():
    employees, client = http()
    person = hire(EmployeeService(employees))
    response = client.patch(
        f"/api/employees/{person.id}",
        json={"name": "Ada Byron", "department": "Product", "designation": "Product Lead"},
    )
    assert response.status_code == 200
    assert response.json()["name"] == "Ada Byron"
    assert response.json()["department"] == "Product"


def test_imports_excel_partial_success():
    _, client = http()
    book = Workbook()
    sheet = book.active
    sheet.append(["name", "email", "country_code", "department", "designation"])
    sheet.append(["Ada Lovelace", "ada@acme.test", "IN", "Engineering", "Engineer"])
    sheet.append(["Bad Row", "not-an-email", "IN", "Engineering", "Engineer"])
    out = BytesIO()
    book.save(out)
    import base64

    file = base64.b64encode(out.getvalue()).decode()
    response = client.post("/api/employees/import", json={"file": file})
    assert response.status_code == 200
    assert response.json()["created"] == 1
    assert response.json()["errors"] == [{"line": 3, "detail": "email must be a valid email address"}]


def test_rejects_excel_missing_columns():
    _, client = http()
    book = Workbook()
    sheet = book.active
    sheet.append(["name", "email"])
    sheet.append(["Ada", "ada@acme.test"])
    out = BytesIO()
    book.save(out)
    import base64

    file = base64.b64encode(out.getvalue()).decode()
    response = client.post("/api/employees/import", json={"file": file})
    assert response.status_code == 400
    assert "header" in response.json()["detail"]
