import { randomUUID } from "node:crypto";

import Decimal from "decimal.js";

import type { EmployeeRepository } from "../employees/repository.js";
import { ConflictError, NotFoundError } from "../shared/errors.js";
import type { SalaryRecord } from "../shared/types.js";
import { currentSalary, validateSalary } from "./domain.js";
import type { SalaryRepository } from "./repository.js";

export class SalaryService {
  constructor(
    private readonly employees: EmployeeRepository,
    private readonly salaries: SalaryRepository,
  ) {}

  async addSalary(input: {
    employeeId: string;
    baseAmount: Decimal;
    currency: string;
    effectiveFrom: string;
    reason: string;
  }): Promise<SalaryRecord> {
    if (!(await this.employees.get(input.employeeId))) {
      throw new NotFoundError("employee not found");
    }
    validateSalary(input);
    if (await this.salaries.existsOn(input.employeeId, input.effectiveFrom)) {
      throw new ConflictError(
        "an employee cannot have two salary records with the same effective_from",
      );
    }
    return this.salaries.add({
      id: randomUUID(),
      employeeId: input.employeeId,
      baseAmount: input.baseAmount,
      currency: input.currency,
      effectiveFrom: input.effectiveFrom,
      reason: input.reason.trim(),
      createdAt: new Date(),
    });
  }

  async history(employeeId: string): Promise<SalaryRecord[]> {
    if (!(await this.employees.get(employeeId))) {
      throw new NotFoundError("employee not found");
    }
    return this.salaries.listForEmployee(employeeId);
  }

  async current(employeeId: string, today: string): Promise<SalaryRecord | null> {
    const rows = await this.history(employeeId);
    return currentSalary(rows, today);
  }
}
