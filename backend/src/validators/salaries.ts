import { Decimal } from "decimal.js";
import { z } from "zod";

import { SUPPORTED_CURRENCIES } from "../common/constants.js";
import { isCalendarDate } from "../common/dates.js";
import { DomainError } from "../common/errors.js";
import type { SalaryRecord } from "../common/types.js";

export const salaryBody = z.object({
  base_amount: z.union([z.string(), z.number()]),
  currency: z.string(),
  effective_from: z.string(),
  reason: z.string(),
});

export function parseAmount(value: string | number): Decimal {
  try {
    const amount = new Decimal(value);
    if (amount.isFinite()) return amount;
  } catch {
    /* invalid decimal */
  }
  throw new DomainError("base_amount must be a number greater than zero");
}

export function currentSalary(records: SalaryRecord[], today: string): SalaryRecord | null {
  let latest: SalaryRecord | null = null;
  for (const row of records) {
    if (row.effectiveFrom > today) continue;
    if (!latest || row.effectiveFrom > latest.effectiveFrom) latest = row;
  }
  return latest;
}

export function validateSalary(input: {
  baseAmount: Decimal;
  currency: string;
  effectiveFrom: string;
  reason: string;
}): void {
  if (input.baseAmount.lte(0)) throw new DomainError("base_amount must be greater than zero");
  if (!SUPPORTED_CURRENCIES.includes(input.currency as (typeof SUPPORTED_CURRENCIES)[number])) {
    throw new DomainError(`currency must be one of ${SUPPORTED_CURRENCIES.join(", ")}`);
  }
  if (!isCalendarDate(input.effectiveFrom)) throw new DomainError("effective_from must be a valid date");
  if (!input.reason.trim()) throw new DomainError("reason must be non-empty");
}
