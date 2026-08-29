import Decimal from "decimal.js";

import type { EmployeeRepository } from "../employees/repository.js";
import type { FxService } from "../fx/service.js";
import type { SalaryRepository } from "../salaries/repository.js";
import { DomainError } from "../shared/errors.js";

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
    const people = await this.employees.listActive();
    const buckets = new Map<string, typeof people>();
    for (const person of people) {
      const key = person[field];
      const list = buckets.get(key) ?? [];
      list.push(person);
      buckets.set(key, list);
    }
    return [...buckets.entries()].sort(([a], [b]) => a.localeCompare(b));
  }

  async headcount(groupBy = "country") {
    const buckets = await this.groupedActive(groupBy);
    return buckets.map(([group, people]) => ({ group, headcount: people.length }));
  }

  async spend(groupBy = "country", today: string) {
    const rates = await this.fx.table();
    const buckets = await this.groupedActive(groupBy);
    const results = [];
    for (const [group, people] of buckets) {
      const current = await this.salaries.currentForMany(
        people.map((person) => person.id),
        today,
      );
      let total = new Decimal(0);
      let paid = 0;
      for (const person of people) {
        const record = current.get(person.id);
        if (!record) {
          continue;
        }
        total = total.add(this.fx.toUsd(record.baseAmount, record.currency, rates));
        paid += 1;
      }
      results.push({ group, spendUsd: total, paidHeadcount: paid });
    }
    return results;
  }

  async avgSalary(groupBy = "country", today: string) {
    const rates = await this.fx.table();
    const buckets = await this.groupedActive(groupBy);
    const results = [];
    for (const [group, people] of buckets) {
      const current = await this.salaries.currentForMany(
        people.map((person) => person.id),
        today,
      );
      const amounts: Decimal[] = [];
      for (const person of people) {
        const record = current.get(person.id);
        if (record) {
          amounts.push(this.fx.toUsd(record.baseAmount, record.currency, rates));
        }
      }
      const average =
        amounts.length === 0
          ? null
          : amounts
              .reduce((sum, value) => sum.add(value), new Decimal(0))
              .div(amounts.length)
              .toDecimalPlaces(2);
      results.push({
        group,
        avgSalaryUsd: average,
        paidHeadcount: amounts.length,
        headcount: people.length,
      });
    }
    return results;
  }
}
