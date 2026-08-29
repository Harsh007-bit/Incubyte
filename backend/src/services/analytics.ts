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

  private async groupedActive(groupBy: string) {
    if (!(groupBy in GROUP_FIELDS)) {
      throw new DomainError("groupBy must be country or department");
    }
    const field = GROUP_FIELDS[groupBy as keyof typeof GROUP_FIELDS];
    const buckets = new Map<string, Employee[]>();
    for (const person of await this.employees.listActive()) {
      const list = buckets.get(person[field]) ?? [];
      list.push(person);
      buckets.set(person[field], list);
    }
    return [...buckets.entries()].sort(([a], [b]) => a.localeCompare(b));
  }

  private async snapshot(groupBy: string, today: string) {
    const [buckets, rates] = await Promise.all([this.groupedActive(groupBy), this.fx.table()]);
    const current = await this.salaries.currentForMany(
      buckets.flatMap(([, people]) => people.map((person) => person.id)),
      today,
    );
    return { buckets, rates, current };
  }

  private usd(record: SalaryRecord, rates: Map<string, Decimal>) {
    return this.fx.toUsd(record.baseAmount, record.currency, rates);
  }

  async headcount(groupBy = "country") {
    const buckets = await this.groupedActive(groupBy);
    return buckets.map(([group, people]) => ({ group, headcount: people.length }));
  }

  async spend(groupBy = "country", today: string) {
    const { buckets, rates, current } = await this.snapshot(groupBy, today);
    return buckets.map(([group, people]) => {
      let spendUsd = new Decimal(0);
      let paidHeadcount = 0;
      for (const person of people) {
        const record = current.get(person.id);
        if (!record) continue;
        spendUsd = spendUsd.add(this.usd(record, rates));
        paidHeadcount += 1;
      }
      return { group, spendUsd, paidHeadcount };
    });
  }

  async avgSalary(groupBy = "country", today: string) {
    const { buckets, rates, current } = await this.snapshot(groupBy, today);
    return buckets.map(([group, people]) => {
      const paid = people.flatMap((person) => {
        const record = current.get(person.id);
        return record ? [this.usd(record, rates)] : [];
      });
      const avgSalaryUsd =
        paid.length === 0
          ? null
          : paid.reduce((sum, value) => sum.add(value), new Decimal(0)).div(paid.length).toDecimalPlaces(2);
      return { group, avgSalaryUsd, paidHeadcount: paid.length, headcount: people.length };
    });
  }
}
