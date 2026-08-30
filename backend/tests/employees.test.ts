import { describe, expect, it } from "vitest";

import { ConflictError, DomainError } from "../src/common/errors.js";
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
      names: [],
      countries: [],
      departments: ["Sales"],
      statuses: ["active"],
      offset: 0,
      limit: 25,
    });
    expect(total).toBe(1);
    expect(items[0]?.name).toBe("Sales One");
  });

  it("matches any of several name terms and countries", async () => {
    const { employees } = world();
    await hire(employees, { name: "Ada Lovelace", email: "ada@acme.test", countryCode: "IN" });
    await hire(employees, { name: "Alan Turing", email: "alan@acme.test", countryCode: "GB" });
    await hire(employees, { name: "Grace Hopper", email: "grace@acme.test", countryCode: "US" });

    const { items, total } = await employees.listPage({
      names: ["Ada", "Alan"],
      countries: ["IN", "GB"],
      departments: [],
      statuses: ["active"],
      offset: 0,
      limit: 25,
    });
    expect(total).toBe(2);
    expect(items.map((row) => row.name).sort()).toEqual(["Ada Lovelace", "Alan Turing"]);
  });

  it("creates valid CSV rows and reports the rest", async () => {
    const { employees } = world();
    const result = await employees.createMany([
      {
        name: "Ada Lovelace",
        email: "ada@acme.test",
        countryCode: "IN",
        department: "Engineering",
        designation: "Engineer",
        line: 2,
      },
      {
        name: "Bad",
        email: "not-an-email",
        countryCode: "IN",
        department: "Engineering",
        designation: "Engineer",
        line: 3,
      },
    ]);
    expect(result.created).toHaveLength(1);
    expect(result.created[0]?.name).toBe("Ada Lovelace");
    expect(result.errors).toEqual([{ line: 3, detail: "email must be a valid email address" }]);
  });

  it("trims profile fields on update so padded email still collides", async () => {
    const { employees } = world();
    const ada = await hire(employees, { email: "ada@acme.test" });
    const other = await hire(employees, { name: "Other", email: "other@acme.test" });
    const saved = await employees.updateById(ada.id, { name: "  Ada  ", email: "  Ada@acme.test  " });
    expect(saved.name).toBe("Ada");
    expect(saved.email).toBe("Ada@acme.test");
    await expect(employees.updateById(other.id, { email: "  ada@acme.test  " })).rejects.toBeInstanceOf(
      ConflictError,
    );
  });
});
