import type { Pool } from "pg";
import { Decimal } from "decimal.js";

import type { ExchangeRate } from "../../common/types.js";
import type { FxRepository } from "./fx.js";

export class PgFxRepository implements FxRepository {
  constructor(private readonly db: Pool) {}

  async upsert(rate: ExchangeRate) {
    await this.db.query(
      `INSERT INTO exchange_rates (currency, rate_to_usd, updated_at)
       VALUES ($1,$2,$3)
       ON CONFLICT (currency)
       DO UPDATE SET rate_to_usd = EXCLUDED.rate_to_usd, updated_at = EXCLUDED.updated_at`,
      [rate.currency, rate.rateToUsd.toString(), rate.updatedAt],
    );
  }

  async list() {
    const { rows } = await this.db.query<{
      currency: string;
      rate_to_usd: string;
      updated_at: Date;
    }>("SELECT currency, rate_to_usd::text, updated_at FROM exchange_rates");
    return rows.map((row) => ({
      currency: row.currency,
      rateToUsd: new Decimal(row.rate_to_usd),
      updatedAt: row.updated_at,
    }));
  }
}
