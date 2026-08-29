import type { ExchangeRate } from "../shared/types.js";

export interface FxRepository {
  upsert(rate: ExchangeRate): Promise<void>;
  list(): Promise<ExchangeRate[]>;
}
