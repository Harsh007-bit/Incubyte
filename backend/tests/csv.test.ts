import { describe, expect, it } from "vitest";

import { parseEmployeeCsv } from "../src/utils/csv.js";
import { DomainError } from "../src/common/errors.js";

const HEADER = "name,email,country_code,department,designation";

describe("employee csv", () => {
  it("parses aliases, quoted commas, and optional codes", () => {
    const rows = parseEmployeeCsv(
      `${HEADER.replace("country_code", "country").replace("department", "dept")},employee_code\n` +
        `"Chen, James",james@acme.test,US,Product,Lead,ACME-00001\n`,
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

  it("rejects a missing header column", () => {
    expect(() => parseEmployeeCsv("name,email\nAda,ada@acme.test")).toThrow(DomainError);
  });

  it("keeps original file line numbers when blank rows are skipped", () => {
    const rows = parseEmployeeCsv(
      [HEADER, "", "Ada Lovelace,ada@acme.test,IN,Engineering,Engineer", "", "Bad,not-an-email,IN,Engineering,Engineer"].join(
        "\n",
      ),
    );
    expect(rows.map((row) => row.line)).toEqual([3, 5]);
  });

  it("rejects more than 500 people", () => {
    const people = Array.from(
      { length: 501 },
      (_, i) => `Person ${i},p${i}@acme.test,IN,Engineering,Engineer`,
    );
    expect(() => parseEmployeeCsv([HEADER, ...people].join("\n"))).toThrow(/at most 500/);
  });
});
