import { Decimal } from "decimal.js";
import { describe, expect, it } from "vitest";

import { ConflictError, DomainError } from "../src/common/errors.js";
import { hire, pay, world } from "./helpers.js";

describe("salary history", () => {
  it("does not overwrite previous records", async () => {
    const { employees, salaries } = world();
    const person = await hire(employees);
    await pay(salaries, person.id, "1000000", "2026-01-01");
    await pay(salaries, person.id, "1200000", "2026-07-01", "promotion");

    const history = await salaries.listHistory(person.id);
    expect(history).toHaveLength(2);
    expect(history.map((row) => row.baseAmount.toFixed(2)).sort()).toEqual([
      "1000000.00",
      "1200000.00",
    ]);
  });

  it("returns the latest effective_from that is not in the future", async () => {
    const { employees, salaries } = world();
    const person = await hire(employees);
    await pay(salaries, person.id, "1000000", "2026-01-01");
    await pay(salaries, person.id, "1200000", "2026-07-01");

    const current = await salaries.getCurrent(person.id, "2026-08-01");
    expect(current?.baseAmount.equals(new Decimal("1200000"))).toBe(true);
  });

  it("ignores a future-dated salary when asking for current", async () => {
    const { employees, salaries } = world();
    const person = await hire(employees);
    await pay(salaries, person.id, "1000000", "2026-01-01");
    await pay(salaries, person.id, "1500000", "2026-12-01", "scheduled raise");

    const current = await salaries.getCurrent(person.id, "2026-08-15");
    expect(current?.baseAmount.equals(new Decimal("1000000"))).toBe(true);
  });

  it("rejects a second salary on the same effective_from at the service layer", async () => {
    const { employees, salaries } = world();
    const person = await hire(employees);
    await pay(salaries, person.id, "1000000", "2026-07-01");

    await expect(pay(salaries, person.id, "1500000", "2026-07-01", "correction")).rejects.toBeInstanceOf(
      ConflictError,
    );
    expect(await salaries.listHistory(person.id)).toHaveLength(1);
  });

  it("allows hiring without a salary and current salary is null", async () => {
    const { employees, salaries } = world();
    const person = await hire(employees);
    expect(person.id).toBeTruthy();
    expect(await salaries.listHistory(person.id)).toEqual([]);
    expect(await salaries.getCurrent(person.id, "2026-08-01")).toBeNull();
  });

  it("keeps salary history after the employee becomes inactive", async () => {
    const { employees, salaries } = world();
    const person = await hire(employees);
    await pay(salaries, person.id, "1000000", "2026-01-01");
    await employees.updateById(person.id, { status: "inactive" });

    const history = await salaries.listHistory(person.id);
    expect(history).toHaveLength(1);
    expect(history[0]?.baseAmount.equals(new Decimal("1000000"))).toBe(true);
  });

  it("rejects amount 0 and creates no salary record", async () => {
    const { employees, salaries } = world();
    const person = await hire(employees);
    await expect(pay(salaries, person.id, "0", "2026-01-01")).rejects.toBeInstanceOf(DomainError);
    expect(await salaries.listHistory(person.id)).toEqual([]);
  });

  it("rejects an impossible calendar date", async () => {
    const { employees, salaries } = world();
    const person = await hire(employees);
    await expect(pay(salaries, person.id, "1000000", "2026-02-31")).rejects.toBeInstanceOf(
      DomainError,
    );
    expect(await salaries.listHistory(person.id)).toEqual([]);
  });
});
