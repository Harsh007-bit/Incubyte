import { describe, expect, it } from "vitest";

import { ConflictError, DomainError } from "../src/shared/errors.js";
import { hire, world } from "./helpers.js";

describe("employees", () => {
  it("requires a name and a valid email", async () => {
    const { employees } = world();
    await expect(
      employees.create({
        name: "  ",
        email: "ada@acme.test",
        countryCode: "IN",
        department: "Engineering",
        designation: "Engineer",
      }),
    ).rejects.toBeInstanceOf(DomainError);
    await expect(
      employees.create({
        name: "Ada",
        email: "not-an-email",
        countryCode: "IN",
        department: "Engineering",
        designation: "Engineer",
      }),
    ).rejects.toBeInstanceOf(DomainError);
  });

  it("rejects a duplicate email regardless of case", async () => {
    const { employees } = world();
    await hire(employees, { email: "ada@acme.test" });
    await expect(hire(employees, { name: "Other", email: "Ada@acme.test" })).rejects.toBeInstanceOf(
      ConflictError,
    );
  });

  it("filters the directory by department", async () => {
    const { employees } = world();
    await hire(employees, { name: "Eng One", email: "e1@acme.test", department: "Engineering" });
    await hire(employees, { name: "Sales One", email: "s1@acme.test", department: "Sales" });

    const { items, total } = await employees.listPage({
      department: "Sales",
      status: "active",
      offset: 0,
      limit: 25,
    });
    expect(total).toBe(1);
    expect(items[0]?.name).toBe("Sales One");
  });
});
