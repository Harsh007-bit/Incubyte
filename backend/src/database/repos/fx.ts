import type { ExchangeRate } from "../../common/types.js";

export interface FxRepository {
  upsert(rate: ExchangeRate): Promise<void>;
  list(): Promise<ExchangeRate[]>;
}
