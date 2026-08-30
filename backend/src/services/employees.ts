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
    return this.employees.insert({
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

  async getById(employeeId: string): Promise<Employee> {
    const employee = await this.employees.getById(employeeId);
    if (!employee) throw new NotFoundError("employee not found");
    return employee;
  }

  async updateById(
    employeeId: string,
    changes: Partial<{
      name: string;
      email: string;
      countryCode: string;
      department: string;
      designation: string;
      status: EmployeeStatus;
    }>,
  ): Promise<Employee> {
    const employee = await this.getById(employeeId);
    const next = {
      name: (changes.name ?? employee.name).trim(),
      email: (changes.email ?? employee.email).trim(),
      countryCode: (changes.countryCode ?? employee.countryCode).trim(),
      department: (changes.department ?? employee.department).trim(),
      designation: (changes.designation ?? employee.designation).trim(),
      status: changes.status ?? employee.status,
    };
    validateProfile(next);
    return this.employees.update({ ...employee, ...next, updatedAt: new Date() });
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
