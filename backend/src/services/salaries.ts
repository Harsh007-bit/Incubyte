import { randomUUID } from "node:crypto";

import { Decimal } from "decimal.js";

import type { EmployeeRepository } from "../database/repos/employees.js";
import type { SalaryRepository } from "../database/repos/salaries.js";
import { NotFoundError } from "../common/errors.js";
import type { SalaryRecord } from "../common/types.js";
import { currentSalary, validateSalary } from "../validators/salaries.js";

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
    return currentSalary(await this.salaries.listForEmployee(employeeId), today);
  }

  currentForMany(employeeIds: string[], today: string) {
    return this.salaries.currentForMany(employeeIds, today);
  }
}
