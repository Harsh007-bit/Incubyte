import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { Pool } from "pg";

import { config } from "./config.js";

export function createPool(url = config.databaseUrl) {
  return new Pool({ connectionString: url });
}

export const pool = createPool();

export async function migrate(db = pool): Promise<void> {
  const here = dirname(fileURLToPath(import.meta.url));
  const sql = readFileSync(join(here, "../sql/schema.sql"), "utf8");
  await db.query(sql);
}
