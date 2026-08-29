import { randomUUID } from "node:crypto";

import { NotFoundError } from "../common/errors.js";
import type { Employee, EmployeeStatus, ListFilters } from "../common/types.js";
import type { EmployeeRepository } from "../database/repos/employees.js";
import { validateProfile } from "../validators/employees.js";

export class EmployeeService {
  constructor(private readonly employees: EmployeeRepository) {}

  async create(input: {
    name: string;
    email: string;
    countryCode: string;
    department: string;
    designation: string;
    employeeCode?: string;
  }): Promise<Employee> {
    const name = input.name.trim();
    const email = input.email.trim();
    const designation = input.designation.trim();
    const countryCode = input.countryCode.trim();
    const department = input.department.trim();
    validateProfile({ name, email, countryCode, department, designation, status: "active" });
    const now = new Date();
    return this.employees.add({
      id: randomUUID(),
      employeeCode: input.employeeCode?.trim() ?? "",
      name,
      email,
      countryCode,
      department,
      designation,
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
  }

  async get(id: string): Promise<Employee> {
    const employee = await this.employees.get(id);
    if (!employee) throw new NotFoundError("employee not found");
    return employee;
  }

  async update(
    id: string,
    changes: Partial<{
      name: string;
      email: string;
      countryCode: string;
      department: string;
      designation: string;
      status: EmployeeStatus;
    }>,
  ): Promise<Employee> {
    const employee = await this.get(id);
    const next = {
      name: changes.name !== undefined ? changes.name.trim() : employee.name,
      email: changes.email !== undefined ? changes.email.trim() : employee.email,
      countryCode: changes.countryCode !== undefined ? changes.countryCode.trim() : employee.countryCode,
      department: changes.department !== undefined ? changes.department.trim() : employee.department,
      designation: changes.designation !== undefined ? changes.designation.trim() : employee.designation,
      status: changes.status ?? employee.status,
    };
    validateProfile(next);
    return this.employees.save({ ...employee, ...next, updatedAt: new Date() });
  }

  listPage(filters: ListFilters) {
    return this.employees.listPage(filters);
  }

  async createMany(rows: Array<{
    name: string;
    email: string;
    countryCode: string;
    department: string;
    designation: string;
    employeeCode?: string;
    line: number;
  }>) {
    const created: Employee[] = [];
    const errors: Array<{ line: number; detail: string }> = [];
    for (const row of rows) {
      try {
        created.push(await this.create(row));
      } catch (error) {
        errors.push({
          line: row.line,
          detail: error instanceof Error ? error.message : "failed",
        });
      }
    }
    return { created, errors };
  }
}
