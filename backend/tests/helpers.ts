import { Decimal } from "decimal.js";

import { AnalyticsService } from "../src/services/analytics.js";
import { EmployeeService } from "../src/services/employees.js";
import { FxService } from "../src/services/fx.js";
import { SalaryService } from "../src/services/salaries.js";
import {
  MemoryEmployeeRepository,
  MemoryFxRepository,
  MemorySalaryRepository,
} from "../src/database/repos/memory.js";

export function world() {
  const employees = new MemoryEmployeeRepository();
  const salaries = new MemorySalaryRepository();
  const rates = new MemoryFxRepository();
  const fx = new FxService(rates);
  return {
    employees: new EmployeeService(employees),
    salaries: new SalaryService(employees, salaries),
    fx,
    analytics: new AnalyticsService(employees, salaries, fx),
  };
}

export function hire(
  service: EmployeeService,
  overrides: Partial<{
    name: string;
    email: string;
    countryCode: string;
    department: string;
    designation: string;
  }> = {},
) {
  return service.create({
    name: overrides.name ?? "Ada Lovelace",
    email: overrides.email ?? "ada@acme.test",
    countryCode: overrides.countryCode ?? "IN",
    department: overrides.department ?? "Engineering",
    designation: overrides.designation ?? "Engineer",
  });
}

export function pay(
  service: SalaryService,
  employeeId: string,
  amount: string,
  when: string,
  reason = "annual revision",
) {
  return service.addSalary({
    employeeId,
    baseAmount: new Decimal(amount),
    currency: "INR",
    effectiveFrom: when,
    reason,
  });
}
