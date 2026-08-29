import type { EmployeeRepository } from "../employees/repository.js";
import type { FxRepository } from "../fx/repository.js";
import type { SalaryRepository } from "../salaries/repository.js";
import { currentSalary } from "../salaries/domain.js";
import { ConflictError } from "./errors.js";
import type { Employee, ExchangeRate, ListFilters, SalaryRecord } from "./types.js";

export class MemoryEmployeeRepository implements EmployeeRepository {
  constructor(private readonly rows: Employee[] = []) {}

  async get(id: string) {
    return this.rows.find((row) => row.id === id) ?? null;
  }

  async getByCode(code: string) {
    return this.rows.find((row) => row.employeeCode === code) ?? null;
  }

  async getByEmail(email: string) {
    const needle = email.toLowerCase();
    return this.rows.find((row) => row.email.toLowerCase() === needle) ?? null;
  }

  async add(employee: Employee) {
    if (await this.getByEmail(employee.email)) {
      throw new ConflictError("email already exists");
    }
    this.rows.push(employee);
    return employee;
  }

  async save(employee: Employee) {
    const other = await this.getByEmail(employee.email);
    if (other && other.id !== employee.id) {
      throw new ConflictError("email already exists");
    }
    const index = this.rows.findIndex((row) => row.id === employee.id);
    if (index >= 0) {
      this.rows[index] = employee;
    }
    return employee;
  }

  async nextCodeNumber() {
    const last = [...this.rows]
      .map((row) => row.employeeCode)
      .filter((code) => code.startsWith("ACME-"))
      .sort()
      .at(-1);
    if (!last) {
      return 1;
    }
    return Number(last.split("-")[1]) + 1;
  }

  async listPage(filters: ListFilters) {
    let items = [...this.rows];
    if (filters.q) {
      const q = filters.q.trim().toLowerCase();
      items = items.filter((row) => row.name.toLowerCase().includes(q));
    }
    if (filters.country) {
      items = items.filter((row) => row.countryCode === filters.country);
    }
    if (filters.department) {
      items = items.filter((row) => row.department === filters.department);
    }
    if (filters.status) {
      items = items.filter((row) => row.status === filters.status);
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
    if (await this.existsOn(record.employeeId, record.effectiveFrom)) {
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

  async existsOn(employeeId: string, effectiveFrom: string) {
    return this.rows.some(
      (row) => row.employeeId === employeeId && row.effectiveFrom === effectiveFrom,
    );
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
