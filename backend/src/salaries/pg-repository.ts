import type { Pool } from "pg";
import Decimal from "decimal.js";

import { ConflictError, DomainError } from "../shared/errors.js";
import type { SalaryRecord } from "../shared/types.js";
import { currentSalary } from "./domain.js";
import type { SalaryRepository } from "./repository.js";

type Row = {
  id: string;
  employee_id: string;
  base_amount: string;
  currency: string;
  effective_from: string;
  reason: string;
  created_at: Date;
};

function toRecord(row: Row): SalaryRecord {
  return {
    id: row.id,
    employeeId: row.employee_id,
    baseAmount: new Decimal(row.base_amount),
    currency: row.currency,
    effectiveFrom: row.effective_from,
    reason: row.reason,
    createdAt: row.created_at,
  };
}

export class PgSalaryRepository implements SalaryRepository {
  constructor(private readonly db: Pool) {}

  async add(record: SalaryRecord) {
    try {
      const { rows } = await this.db.query<Row>(
        `INSERT INTO salary_records
          (id, employee_id, base_amount, currency, effective_from, reason, created_at)
         VALUES ($1,$2,$3,$4,$5::date,$6,$7)
         RETURNING id, employee_id, base_amount::text, currency, effective_from::text, reason, created_at`,
        [
          record.id,
          record.employeeId,
          record.baseAmount.toFixed(2),
          record.currency,
          record.effectiveFrom,
          record.reason,
          record.createdAt,
        ],
      );
      return toRecord(rows[0]);
    } catch (error) {
      if (typeof error === "object" && error && "code" in error && error.code === "23505") {
        throw new ConflictError(
          "an employee cannot have two salary records with the same effective_from",
        );
      }
      if (typeof error === "object" && error && "code" in error && error.code === "23514") {
        throw new DomainError("salary failed a database check constraint");
      }
      throw error;
    }
  }

  async listForEmployee(employeeId: string) {
    const { rows } = await this.db.query<Row>(
      `SELECT id, employee_id, base_amount::text, currency, effective_from::text, reason, created_at
       FROM salary_records
       WHERE employee_id = $1
       ORDER BY effective_from DESC`,
      [employeeId],
    );
    return rows.map(toRecord);
  }

  async existsOn(employeeId: string, effectiveFrom: string) {
    const { rows } = await this.db.query(
      `SELECT 1 FROM salary_records WHERE employee_id = $1 AND effective_from = $2::date`,
      [employeeId, effectiveFrom],
    );
    return rows.length > 0;
  }

  async currentForMany(employeeIds: string[], today: string) {
    if (employeeIds.length === 0) {
      return new Map<string, SalaryRecord>();
    }
    const { rows } = await this.db.query<Row>(
      `SELECT id, employee_id, base_amount::text, currency, effective_from::text, reason, created_at
       FROM salary_records
       WHERE employee_id = ANY($1::uuid[]) AND effective_from <= $2::date`,
      [employeeIds, today],
    );
    const byEmployee = new Map<string, SalaryRecord[]>();
    for (const record of rows.map(toRecord)) {
      const list = byEmployee.get(record.employeeId) ?? [];
      list.push(record);
      byEmployee.set(record.employeeId, list);
    }
    const latest = new Map<string, SalaryRecord>();
    for (const [id, list] of byEmployee) {
      const current = currentSalary(list, today);
      if (current) {
        latest.set(id, current);
      }
    }
    return latest;
  }
}
