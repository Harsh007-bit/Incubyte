import { DomainError } from "../common/errors.js";

const MAX_ROWS = 500;

const COLUMNS: Record<string, string> = {
  name: "name",
  email: "email",
  country: "countryCode",
  country_code: "countryCode",
  department: "department",
  dept: "department",
  designation: "designation",
  title: "designation",
  employee_code: "employeeCode",
};

export type CsvHire = {
  name: string;
  email: string;
  countryCode: string;
  department: string;
  designation: string;
  employeeCode?: string;
  line: number;
};

export function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (quoted && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === "," && !quoted) {
      cells.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current.trim());
  return cells;
}

export function parseEmployeeCsv(text: string): CsvHire[] {
  const numbered = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line, index) => ({ line, number: index + 1 }))
    .filter((row) => row.line.trim());
  if (numbered.length < 2) {
    throw new DomainError("CSV needs a header and at least one person");
  }
  if (numbered.length - 1 > MAX_ROWS) {
    throw new DomainError(`CSV can have at most ${MAX_ROWS} people`);
  }

  const header = splitCsvLine(numbered[0]!.line).map((cell) => COLUMNS[cell.toLowerCase()]);
  for (const required of ["name", "email", "countryCode", "department", "designation"]) {
    if (!header.includes(required)) {
      throw new DomainError("CSV header must include name, email, country_code, department, designation");
    }
  }

  return numbered.slice(1).map((row) => {
    const cells = splitCsvLine(row.line);
    const get = (key: string) => cells[header.indexOf(key)] ?? "";
    const employeeCode = get("employeeCode");
    return {
      name: get("name"),
      email: get("email"),
      countryCode: get("countryCode"),
      department: get("department"),
      designation: get("designation"),
      employeeCode: employeeCode || undefined,
      line: row.number,
    };
  });
}
