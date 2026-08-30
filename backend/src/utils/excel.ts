import ExcelJS from "exceljs";

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

export type HireRow = {
  name: string;
  email: string;
  countryCode: string;
  department: string;
  designation: string;
  employeeCode?: string;
  line: number;
};

function cellText(value: ExcelJS.CellValue): string {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value).trim();
  }
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    if ("text" in value && value.text != null) return String(value.text).trim();
    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText.map((part) => part.text).join("").trim();
    }
    if ("result" in value) return cellText(value.result);
  }
  return "";
}

function rowTexts(row: ExcelJS.Row, width: number): string[] {
  const texts: string[] = [];
  for (let col = 1; col <= width; col += 1) {
    texts.push(cellText(row.getCell(col).value));
  }
  return texts;
}

export function decodeExcelBase64(file: string): Buffer {
  const payload = file.includes(",") ? file.slice(file.indexOf(",") + 1) : file;
  return Buffer.from(payload, "base64");
}

export async function parseEmployeeExcel(buffer: Buffer): Promise<HireRow[]> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer as never);
  } catch {
    throw new DomainError("file must be a valid Excel workbook (.xlsx)");
  }
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new DomainError("Excel file needs a worksheet");

  const width = Math.max(sheet.columnCount, 1);
  const extracted: Array<{ line: number; cells: string[] }> = [];
  sheet.eachRow((row, rowNumber) => {
    const cells = rowTexts(row, width);
    if (cells.every((cell) => !cell)) return;
    extracted.push({ line: rowNumber, cells });
  });

  const headerRow = extracted[0];
  if (!headerRow || extracted.length < 2) {
    throw new DomainError("Excel needs a header and at least one person");
  }
  const header = headerRow.cells.map((label) => COLUMNS[label.toLowerCase()]);
  for (const required of ["name", "email", "countryCode", "department", "designation"]) {
    if (!header.includes(required)) {
      throw new DomainError(
        "Excel header must include name, email, country_code, department, designation",
      );
    }
  }

  const people = extracted.slice(1).map((row) => {
    const get = (key: string) => row.cells[header.indexOf(key)] ?? "";
    const employeeCode = get("employeeCode");
    return {
      name: get("name"),
      email: get("email"),
      countryCode: get("countryCode"),
      department: get("department"),
      designation: get("designation"),
      employeeCode: employeeCode || undefined,
      line: row.line,
    };
  });
  if (people.length > MAX_ROWS) {
    throw new DomainError(`Excel can have at most ${MAX_ROWS} people`);
  }
  return people;
}

export async function sampleEmployeeExcel(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("People");
  sheet.addRow(["name", "email", "country_code", "department", "designation"]);
  sheet.addRow(["Priya Shah", "excel.priya.shah@acme.test", "IN", "Engineering", "Software Engineer"]);
  sheet.addRow(["James Chen", "excel.james.chen@acme.test", "US", "Product", "Product Manager"]);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}
