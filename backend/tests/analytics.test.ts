import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";

import { hire, pay, world } from "./helpers.js";

describe("analytics", () => {
  it("excludes inactive employees from spend", async () => {
    const { employees, salaries, fx, analytics } = world();
    await fx.seedDefaults();
    const active = await hire(employees, { email: "active@acme.test" });
    const inactive = await hire(employees, { name: "Old Hand", email: "old@acme.test" });
    await pay(salaries, active.id, "1000000", "2026-01-01");
    await pay(salaries, inactive.id, "2000000", "2026-01-01");
    await employees.update(inactive.id, { status: "inactive" });

    const india = (await analytics.spend("country", "2026-08-01")).find((row) => row.group === "IN");
    expect(india?.spendUsd.equals(new Decimal("12000"))).toBe(true);
    expect(india?.paidHeadcount).toBe(1);
  });

  it("converts spend with the current rate", async () => {
    const { employees, salaries, fx, analytics } = world();
    await fx.seedDefaults();
    const person = await hire(employees);
    await pay(salaries, person.id, "1000000", "2026-01-01");

    const india = (await analytics.spend("country", "2026-08-01")).find((row) => row.group === "IN");
    expect(india?.spendUsd.equals(new Decimal("12000"))).toBe(true);
  });

  it("counts unpaid employees in headcount but not in the average", async () => {
    const { employees, salaries, fx, analytics } = world();
    await fx.seedDefaults();
    const paid = await hire(employees, { email: "paid@acme.test" });
    await hire(employees, { name: "New Join", email: "new@acme.test" });
    await pay(salaries, paid.id, "1000000", "2026-01-01");

    const headcount = (await analytics.headcount("country")).find((row) => row.group === "IN");
    const average = (await analytics.avgSalary("country", "2026-08-01")).find(
      (row) => row.group === "IN",
    );

    expect(headcount?.headcount).toBe(2);
    expect(average?.headcount).toBe(2);
    expect(average?.paidHeadcount).toBe(1);
    expect(average?.avgSalaryUsd?.equals(new Decimal("12000"))).toBe(true);
  });
});
