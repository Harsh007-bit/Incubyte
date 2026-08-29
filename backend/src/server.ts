import { createApp } from "./app.js";
import { config } from "./config.js";
import { PgEmployeeRepository } from "./database/repos/pgEmployees.js";
import { PgFxRepository } from "./database/repos/pgFx.js";
import { PgSalaryRepository } from "./database/repos/pgSalaries.js";
import { migrate, pool } from "./db.js";
import { FxService } from "./services/fx.js";

await migrate();

const rates = new PgFxRepository(pool);
await new FxService(rates).seedDefaults();

const app = createApp({
  employees: new PgEmployeeRepository(pool),
  salaries: new PgSalaryRepository(pool),
  rates,
});

const server = app.listen(config.port, () => {
  console.log(`ACME salary API on http://localhost:${config.port}`);
});

async function shutdown() {
  server.close();
  await pool.end();
}

process.on("SIGTERM", () => {
  void shutdown();
});
process.on("SIGINT", () => {
  void shutdown();
});
