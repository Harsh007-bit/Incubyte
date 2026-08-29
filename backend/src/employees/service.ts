import { randomUUID } from "node:crypto";

import { ConflictError, NotFoundError } from "../shared/errors.js";
import type { Employee, EmployeeStatus, ListFilters } from "../shared/types.js";
import { validateProfile } from "./domain.js";
import type { EmployeeRepository } from "./repository.js";

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
    validateProfile({ ...input, status: "active" });
    const email = input.email.trim();
    if (await this.employees.getByEmail(email)) {
      throw new ConflictError("email already exists");
    }
    const code =
      input.employeeCode?.trim() ||
      `ACME-${String(await this.employees.nextCodeNumber()).padStart(5, "0")}`;
    if (await this.employees.getByCode(code)) {
      throw new ConflictError(`employee_code ${code} already exists`);
    }
    const now = new Date();
    return this.employees.add({
      id: randomUUID(),
      employeeCode: code,
      name: input.name.trim(),
      email,
      countryCode: input.countryCode,
      department: input.department,
      designation: input.designation.trim(),
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
  }

  async get(id: string): Promise<Employee> {
    const employee = await this.employees.get(id);
    if (!employee) {
      throw new NotFoundError("employee not found");
    }
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
      name: changes.name ?? employee.name,
      email: changes.email ?? employee.email,
      countryCode: changes.countryCode ?? employee.countryCode,
      department: changes.department ?? employee.department,
      designation: changes.designation ?? employee.designation,
      status: changes.status ?? employee.status,
    };
    validateProfile(next);
    const clash = await this.employees.getByEmail(next.email);
    if (clash && clash.id !== employee.id) {
      throw new ConflictError("email already exists");
    }
    return this.employees.save({ ...employee, ...next, updatedAt: new Date() });
  }

  listPage(filters: ListFilters) {
    return this.employees.listPage(filters);
  }
}
