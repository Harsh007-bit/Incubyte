import { Decimal } from "decimal.js";

import { DEFAULT_RATES, SUPPORTED_CURRENCIES } from "../common/constants.js";
import { DomainError } from "../common/errors.js";
import type { FxRepository } from "../database/repos/fx.js";

export class FxService {
  constructor(private readonly rates: FxRepository) {}

  async table(): Promise<Map<string, Decimal>> {
    const rows = await this.rates.list();
    const table = new Map(rows.map((row) => [row.currency, row.rateToUsd]));
    if (table.size === 0) {
      throw new DomainError("exchange rates have not been seeded");
    }
    return table;
  }

  toUsd(amount: Decimal, currency: string, table: Map<string, Decimal>): Decimal {
    const rate = table.get(currency);
    if (!rate) {
      throw new DomainError(`no exchange rate for ${currency}`);
    }
    return amount.mul(rate).toDecimalPlaces(2);
  }

  async seedDefaults(updatedAt = new Date()): Promise<void> {
    if ((await this.rates.list()).length > 0) {
      return;
    }
    for (const currency of SUPPORTED_CURRENCIES) {
      await this.rates.upsert({
        currency,
        rateToUsd: new Decimal(DEFAULT_RATES[currency]),
        updatedAt,
      });
    }
  }
}
