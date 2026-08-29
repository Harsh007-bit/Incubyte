import { Pool } from "pg";

import { SCHEMA_SQL } from "./common/schemaSql.js";
import { config } from "./config.js";

function isLocalUrl(url: string) {
  return url.includes("localhost") || url.includes("127.0.0.1");
}

export function createPool(url = config.databaseUrl) {
  return new Pool({
    connectionString: url,
    max: process.env.VERCEL ? 1 : 10,
    ssl: isLocalUrl(url) ? undefined : { rejectUnauthorized: false },
  });
}

export const pool = createPool();

export async function migrate(db = pool): Promise<void> {
  await db.query(SCHEMA_SQL);
}
