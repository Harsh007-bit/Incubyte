import { randomUUID } from "node:crypto";

import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createApp } from "../src/app.js";
import { PgEmployeeRepository } from "../src/database/repos/pgEmployees.js";
import { PgFxRepository } from "../src/database/repos/pgFx.js";
import { PgSalaryRepository } from "../src/database/repos/pgSalaries.js";
import { createPool, migrate } from "../src/db.js";
import { FxService } from "../src/services/fx.js";

const url = process.env.TEST_DATABASE_URL;
const live = Boolean(url);

describe.skipIf(!live)("postgres invariants", () => {
  const pool = createPool(url);
  const app = createApp({
    employees: new PgEmployeeRepository(pool),
    salaries: new PgSalaryRepository(pool),
    rates: new PgFxRepository(pool),
    today: () => "2026-08-15",
  });

  beforeAll(async () => {
    await migrate(pool);
    await new FxService(new PgFxRepository(pool)).seedDefaults();
  });

  beforeEach(async () => {
    await pool.query("TRUNCATE salary_records, employees RESTART IDENTITY CASCADE");
  });

  afterAll(async () => {
    await pool.end();
  });

  async function hire(email = `ada-${randomUUID()}@acme.com`) {
    const response = await request(app).post("/api/employees").send({
      name: "Ada Lovelace",
      email,
      country_code: "IN",
      department: "Engineering",
      designation: "Engineer",
    });
    expect(response.status).toBe(201);
    return response.body as { id: string; current_salary: null };
  }

  it("rejects a second salary on the same effective_from via UNIQUE", async () => {
    const employee = await hire();
    const first = await request(app).post(`/api/employees/${employee.id}/salary`).send({
      base_amount: "1000000",
      currency: "INR",
      effective_from: "2026-07-01",
      reason: "offer accepted",
    });
    expect(first.status).toBe(201);

    const duplicate = await request(app).post(`/api/employees/${employee.id}/salary`).send({
      base_amount: "1500000",
      currency: "INR",
      effective_from: "2026-07-01",
      reason: "correction",
    });
    expect(duplicate.status).toBe(409);

    const history = await request(app).get(`/api/employees/${employee.id}/salary-history`);
    expect(history.body).toHaveLength(1);
  });

  it("rejects a duplicate email regardless of case", async () => {
    await hire("ada@acme.com");
    const clash = await request(app).post("/api/employees").send({
      name: "Other Ada",
      email: "Ada@acme.com",
      country_code: "IN",
      department: "Engineering",
      designation: "Engineer",
    });
    expect(clash.status).toBe(409);
  });

  it("lets CHECK reject a zero amount if the service were bypassed", async () => {
    const employee = await hire();
    await expect(
      pool.query(
        `INSERT INTO salary_records (id, employee_id, base_amount, currency, effective_from, reason)
         VALUES ($1,$2,0,'INR','2026-01-01','x')`,
        [randomUUID(), employee.id],
      ),
    ).rejects.toMatchObject({ code: "23514" });
  });

  it("creates an employee without salary and current salary is null", async () => {
    const employee = await hire();
    const detail = await request(app).get(`/api/employees/${employee.id}`);
    expect(detail.body.current_salary).toBeNull();
  });

  it("treats a malformed employee id as not found", async () => {
    const response = await request(app).get("/api/employees/not-a-uuid");
    expect(response.status).toBe(404);
    expect(response.body.code).toBe("not_found");
  });
});
