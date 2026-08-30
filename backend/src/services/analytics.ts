import { Decimal } from "decimal.js";

import type { EmployeeRepository } from "../database/repos/employees.js";
import type { SalaryRepository } from "../database/repos/salaries.js";
import { DomainError } from "../common/errors.js";
import type { Employee, SalaryRecord } from "../common/types.js";
import type { FxService } from "./fx.js";

const GROUP_FIELDS = {
  country: "countryCode",
  department: "department",
} as const;

export class AnalyticsService {
  constructor(
    private readonly employees: EmployeeRepository,
    private readonly salaries: SalaryRepository,
    private readonly fx: FxService,
  ) {}

  private async groupActiveEmployees(groupBy: string) {
    if (!(groupBy in GROUP_FIELDS)) {
      throw new DomainError("groupBy must be country or department");
    }
    const field = GROUP_FIELDS[groupBy as keyof typeof GROUP_FIELDS];
    const buckets = new Map<string, Employee[]>();
    for (const employee of await this.employees.listActive()) {
      const list = buckets.get(employee[field]) ?? [];
      list.push(employee);
      buckets.set(employee[field], list);
    }
    return [...buckets.entries()].sort(([a], [b]) => a.localeCompare(b));
  }

  private async loadGroupedPay(groupBy: string, today: string) {
    const [buckets, rates] = await Promise.all([this.groupActiveEmployees(groupBy), this.fx.getRateTable()]);
    const currentByEmployeeId = await this.salaries.getCurrentForMany(
      buckets.flatMap(([, employees]) => employees.map((employee) => employee.id)),
      today,
    );
    return { buckets, rates, currentByEmployeeId };
  }

  private amountInUsd(record: SalaryRecord, rates: Map<string, Decimal>) {
    return this.fx.toUsd(record.baseAmount, record.currency, rates);
  }

  async headcount(groupBy = "country") {
    const buckets = await this.groupActiveEmployees(groupBy);
    return buckets.map(([group, employees]) => ({ group, headcount: employees.length }));
  }

  async spend(groupBy = "country", today: string) {
    const { buckets, rates, currentByEmployeeId } = await this.loadGroupedPay(groupBy, today);
    return buckets.map(([group, employees]) => {
      let spendUsd = new Decimal(0);
      let paidHeadcount = 0;
      for (const employee of employees) {
        const record = currentByEmployeeId.get(employee.id);
        if (!record) continue;
        spendUsd = spendUsd.add(this.amountInUsd(record, rates));
        paidHeadcount += 1;
      }
      return { group, spendUsd, paidHeadcount };
    });
  }

  async avgSalary(groupBy = "country", today: string) {
    const { buckets, rates, currentByEmployeeId } = await this.loadGroupedPay(groupBy, today);
    return buckets.map(([group, employees]) => {
      const paid = employees.flatMap((employee) => {
        const record = currentByEmployeeId.get(employee.id);
        return record ? [this.amountInUsd(record, rates)] : [];
      });
      const avgSalaryUsd =
        paid.length === 0
          ? null
          : paid.reduce((sum, value) => sum.add(value), new Decimal(0)).div(paid.length).toDecimalPlaces(2);
      return { group, avgSalaryUsd, paidHeadcount: paid.length, headcount: employees.length };
    });
  }
}
