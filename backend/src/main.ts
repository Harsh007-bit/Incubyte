import { createApp } from "./app.js";
import { PgEmployeeRepository } from "./employees/pg-repository.js";
import { PgFxRepository } from "./fx/pg-repository.js";
import { PgSalaryRepository } from "./salaries/pg-repository.js";
import { migrate, pool } from "./shared/db.js";

await migrate();

const app = createApp({
  employees: new PgEmployeeRepository(pool),
  salaries: new PgSalaryRepository(pool),
  rates: new PgFxRepository(pool),
});

const port = Number(process.env.PORT ?? 8000);
app.listen(port, () => {
  console.log(`ACME salary API on http://localhost:${port}`);
});
