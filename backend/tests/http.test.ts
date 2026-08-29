import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "../src/http.js";
import { EmployeeService } from "../src/services/employees.js";
import {
  MemoryEmployeeRepository,
  MemoryFxRepository,
  MemorySalaryRepository,
} from "../src/database/repos/memory.js";
import { hire } from "./helpers.js";

function http(employees = new MemoryEmployeeRepository()) {
  return {
    employees,
    app: createApp({
      employees,
      salaries: new MemorySalaryRepository(),
      rates: new MemoryFxRepository(),
      today: () => "2026-08-15",
    }),
  };
}

describe("http input", () => {
  it("honours page and page_size", async () => {
    const { employees, app } = http();
    const service = new EmployeeService(employees);
    for (let i = 0; i < 12; i += 1) {
      await hire(service, { email: `p${i}@acme.test`, name: `Person ${String(i).padStart(2, "0")}` });
    }
    const page2 = await request(app).get("/api/employees?page=2&page_size=5");
    expect(page2.status).toBe(200);
    expect(page2.body.page).toBe(2);
    expect(page2.body.page_size).toBe(5);
    expect(page2.body.items).toHaveLength(5);
    const page1 = await request(app).get("/api/employees?page=1&page_size=5");
    expect(page1.body.items[0].id).not.toBe(page2.body.items[0].id);
  });

  it("treats a non-numeric page as page 1", async () => {
    const { employees, app } = http();
    await hire(new EmployeeService(employees));
    const response = await request(app).get("/api/employees?page=foo");
    expect(response.status).toBe(200);
    expect(response.body.page).toBe(1);
    expect(response.body.items).toHaveLength(1);
  });

  it("rejects a garbage salary amount with 400", async () => {
    const { employees, app } = http();
    const person = await hire(new EmployeeService(employees));
    const response = await request(app).post(`/api/employees/${person.id}/salary`).send({
      base_amount: "abc",
      currency: "INR",
      effective_from: "2026-07-01",
      reason: "offer accepted",
    });
    expect(response.status).toBe(400);
    expect(response.body.code).toBe("invalid");
  });

  it("rejects a calendar-impossible effective_from", async () => {
    const { employees, app } = http();
    const person = await hire(new EmployeeService(employees));
    const response = await request(app).post(`/api/employees/${person.id}/salary`).send({
      base_amount: "1000000",
      currency: "INR",
      effective_from: "2026-02-31",
      reason: "offer accepted",
    });
    expect(response.status).toBe(400);
    expect(response.body.detail).toMatch(/valid date/);
  });

  it("updates an employee profile", async () => {
    const { employees, app } = http();
    const person = await hire(new EmployeeService(employees));
    const response = await request(app).patch(`/api/employees/${person.id}`).send({
      name: "Ada Byron",
      department: "Product",
      designation: "Product Lead",
    });
    expect(response.status).toBe(200);
    expect(response.body.name).toBe("Ada Byron");
    expect(response.body.department).toBe("Product");
  });

  it("imports people from CSV and reports row errors", async () => {
    const { app } = http();
    const response = await request(app).post("/api/employees/import").send({
      csv: [
        "name,email,country_code,department,designation",
        "Ada Lovelace,ada@acme.test,IN,Engineering,Engineer",
        "Bad Row,not-an-email,IN,Engineering,Engineer",
      ].join("\n"),
    });
    expect(response.status).toBe(200);
    expect(response.body.created).toBe(1);
    expect(response.body.errors).toEqual([
      { line: 3, detail: "email must be a valid email address" },
    ]);
  });

  it("rejects CSV without the required columns", async () => {
    const { app } = http();
    const response = await request(app)
      .post("/api/employees/import")
      .send({ csv: "name,email\nAda,ada@acme.test" });
    expect(response.status).toBe(400);
    expect(response.body.detail).toMatch(/header/);
  });
});
