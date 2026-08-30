import cors from "cors";
import express from "express";
import { ZodError } from "zod";

import { analyticsRoutes } from "./controllers/analytics.js";
import { AnalyticsService } from "./services/analytics.js";
import { employeeRoutes } from "./controllers/employees.js";
import type { EmployeeRepository } from "./database/repos/employees.js";
import { EmployeeService } from "./services/employees.js";
import type { FxRepository } from "./database/repos/fx.js";
import { FxService } from "./services/fx.js";
import type { SalaryRepository } from "./database/repos/salaries.js";
import { SalaryService } from "./services/salaries.js";
import {
  COUNTRY_CODES,
  DEPARTMENTS,
  STATUSES,
  SUPPORTED_CURRENCIES,
} from "./common/constants.js";
import { calendarDateToday } from "./common/dates.js";
import { ConflictError, DomainError, NotFoundError } from "./common/errors.js";

export function createApp(deps: {
  employees: EmployeeRepository;
  salaries: SalaryRepository;
  rates: FxRepository;
  today?: () => string;
}) {
  const today = deps.today ?? calendarDateToday;
  const employees = new EmployeeService(deps.employees);
  const salaries = new SalaryService(deps.employees, deps.salaries);
  const fx = new FxService(deps.rates);
  const analytics = new AnalyticsService(deps.employees, deps.salaries, fx);

  const corsOrigin = process.env.VERCEL
    ? true
    : ["http://localhost:5173", "http://127.0.0.1:5173"];

  const app = express();
  app.use(cors({ origin: corsOrigin }));
  app.use(express.json({ limit: "1mb" }));

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });
  app.get("/api/meta", (_req, res) => {
    res.json({
      country_codes: [...COUNTRY_CODES],
      departments: [...DEPARTMENTS],
      currencies: [...SUPPORTED_CURRENCIES],
      statuses: [...STATUSES],
    });
  });
  app.use(
    "/api/employees",
    employeeRoutes({ employees, salaries, today }),
  );
  app.use("/api/analytics", analyticsRoutes({ analytics, today }));

  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (error instanceof ZodError) {
      res.status(422).json({ detail: error.issues[0]?.message ?? "invalid input", code: "invalid" });
      return;
    }
    if (error instanceof NotFoundError) {
      res.status(404).json({ detail: error.message, code: error.code });
      return;
    }
    if (error instanceof ConflictError) {
      res.status(409).json({ detail: error.message, code: error.code });
      return;
    }
    if (error instanceof DomainError) {
      res.status(400).json({ detail: error.message, code: error.code });
      return;
    }
    console.error(error);
    res.status(500).json({ detail: "internal error", code: "internal" });
  });

  return app;
}
