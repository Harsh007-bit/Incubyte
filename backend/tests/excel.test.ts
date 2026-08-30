import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";

import { DomainError } from "../src/common/errors.js";
import { parseEmployeeExcel } from "../src/utils/excel.js";

async function workbook(rows: Array<Array<string | undefined>>) {
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet("People");
  for (const row of rows) sheet.addRow(row);
  return Buffer.from(await book.xlsx.writeBuffer());
}

describe("employee excel", () => {
  it("parses aliases and optional codes", async () => {
    const rows = await parseEmployeeExcel(
      await workbook([
        ["name", "email", "country", "dept", "title", "employee_code"],
        ["Chen, James", "james@acme.test", "US", "Product", "Lead", "ACME-00001"],
      ]),
    );
    expect(rows).toEqual([
      {
        name: "Chen, James",
        email: "james@acme.test",
        countryCode: "US",
        department: "Product",
        designation: "Lead",
        employeeCode: "ACME-00001",
        line: 2,
      },
    ]);
  });

  it("rejects a missing header column", async () => {
    await expect(parseEmployeeExcel(await workbook([["name", "email"], ["Ada", "ada@acme.test"]]))).rejects.toBeInstanceOf(
      DomainError,
    );
  });

  it("keeps original sheet row numbers when blank rows are skipped", async () => {
    const rows = await parseEmployeeExcel(
      await workbook([
        ["name", "email", "country_code", "department", "designation"],
        [],
        ["Ada Lovelace", "ada@acme.test", "IN", "Engineering", "Engineer"],
        [],
        ["Bad", "not-an-email", "IN", "Engineering", "Engineer"],
      ]),
    );
    expect(rows.map((row) => row.line)).toEqual([3, 5]);
  });

  it("rejects more than 500 people", async () => {
    const people = Array.from({ length: 501 }, (_, i) => [
      `Person ${i}`,
      `p${i}@acme.test`,
      "IN",
      "Engineering",
      "Engineer",
    ]);
    await expect(
      parseEmployeeExcel(
        await workbook([["name", "email", "country_code", "department", "designation"], ...people]),
      ),
    ).rejects.toThrow(/at most 500/);
  });
});
