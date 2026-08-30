import { ConflictError } from "../../common/errors.js";
import type { Employee, ExchangeRate, ListFilters, SalaryRecord } from "../../common/types.js";
import { currentSalary } from "../../validators/salaries.js";
import type { EmployeeRepository } from "./employees.js";
import type { FxRepository } from "./fx.js";
import type { SalaryRepository } from "./salaries.js";

export class MemoryEmployeeRepository implements EmployeeRepository {
  constructor(private readonly rows: Employee[] = []) {}

  async get(id: string) {
    return this.rows.find((row) => row.id === id) ?? null;
  }

  private byCode(code: string) {
    return this.rows.find((row) => row.employeeCode === code);
  }

  private byEmail(email: string) {
    const needle = email.toLowerCase();
    return this.rows.find((row) => row.email.toLowerCase() === needle);
  }

  async add(employee: Employee) {
    const last = [...this.rows]
      .map((row) => row.employeeCode)
      .filter((code) => code.startsWith("ACME-"))
      .sort()
      .at(-1);
    const next =
      employee.employeeCode ||
      `ACME-${String((last ? Number(last.split("-")[1]) : 0) + 1).padStart(5, "0")}`;
    if (this.byEmail(employee.email)) {
      throw new ConflictError("email already exists");
    }
    if (this.byCode(next)) {
      throw new ConflictError(`employee_code ${next} already exists`);
    }
    const stored = { ...employee, employeeCode: next };
    this.rows.push(stored);
    return stored;
  }

  async save(employee: Employee) {
    const other = this.byEmail(employee.email);
    if (other && other.id !== employee.id) {
      throw new ConflictError("email already exists");
    }
    const index = this.rows.findIndex((row) => row.id === employee.id);
    if (index >= 0) {
      this.rows[index] = employee;
    }
    return employee;
  }

  async listPage(filters: ListFilters) {
    let items = [...this.rows];
    if (filters.names.length > 0) {
      items = items.filter((row) =>
        filters.names.some((name) => row.name.toLowerCase().includes(name.toLowerCase())),
      );
    }
    if (filters.countries.length > 0) {
      items = items.filter((row) => filters.countries.includes(row.countryCode));
    }
    if (filters.departments.length > 0) {
      items = items.filter((row) => filters.departments.includes(row.department));
    }
    if (filters.statuses.length > 0) {
      items = items.filter((row) => filters.statuses.includes(row.status));
    }
    items.sort((a, b) => a.name.localeCompare(b.name));
    return {
      items: items.slice(filters.offset, filters.offset + filters.limit),
      total: items.length,
    };
  }

  async listActive() {
    return this.rows.filter((row) => row.status === "active");
  }
}

export class MemorySalaryRepository implements SalaryRepository {
  constructor(private readonly rows: SalaryRecord[] = []) {}

  async add(record: SalaryRecord) {
    if (
      this.rows.some(
        (row) => row.employeeId === record.employeeId && row.effectiveFrom === record.effectiveFrom,
      )
    ) {
      throw new ConflictError(
        "an employee cannot have two salary records with the same effective_from",
      );
    }
    this.rows.push(record);
    return record;
  }

  async listForEmployee(employeeId: string) {
    return this.rows
      .filter((row) => row.employeeId === employeeId)
      .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));
  }

  async currentForMany(employeeIds: string[], today: string) {
    const latest = new Map<string, SalaryRecord>();
    for (const id of employeeIds) {
      const current = currentSalary(
        this.rows.filter((row) => row.employeeId === id),
        today,
      );
      if (current) {
        latest.set(id, current);
      }
    }
    return latest;
  }
}

export class MemoryFxRepository implements FxRepository {
  constructor(private readonly rows: ExchangeRate[] = []) {}

  async upsert(rate: ExchangeRate) {
    const index = this.rows.findIndex((row) => row.currency === rate.currency);
    if (index >= 0) {
      this.rows[index] = rate;
    } else {
      this.rows.push(rate);
    }
  }

  async list() {
    return [...this.rows];
  }
}
