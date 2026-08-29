import Decimal from "decimal.js";

import { SUPPORTED_CURRENCIES } from "../shared/constants.js";
import { DomainError } from "../shared/errors.js";
import type { SalaryRecord } from "../shared/types.js";

export function currentSalary(
  records: SalaryRecord[],
  today: string,
): SalaryRecord | null {
  const eligible = records.filter((row) => row.effectiveFrom <= today);
  if (eligible.length === 0) {
    return null;
  }
  return eligible.reduce((latest, row) =>
    row.effectiveFrom > latest.effectiveFrom ? row : latest,
  );
}

export function validateSalary(input: {
  baseAmount: Decimal;
  currency: string;
  effectiveFrom: string;
  reason: string;
}): void {
  if (input.baseAmount.lte(0)) {
    throw new DomainError("base_amount must be greater than zero");
  }
  if (!SUPPORTED_CURRENCIES.includes(input.currency as (typeof SUPPORTED_CURRENCIES)[number])) {
    throw new DomainError(`currency must be one of ${SUPPORTED_CURRENCIES.join(", ")}`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.effectiveFrom)) {
    throw new DomainError("effective_from must be a valid date");
  }
  if (!input.reason.trim()) {
    throw new DomainError("reason must be non-empty");
  }
}
