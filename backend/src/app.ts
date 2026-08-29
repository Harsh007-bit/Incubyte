import cors from "cors";
import express from "express";
import { ZodError } from "zod";

import { analyticsRoutes } from "./analytics/routes.js";
import { AnalyticsService } from "./analytics/service.js";
import { employeeRoutes } from "./employees/routes.js";
import type { EmployeeRepository } from "./employees/repository.js";
import { EmployeeService } from "./employees/service.js";
import type { FxRepository } from "./fx/repository.js";
import { FxService } from "./fx/service.js";
import type { SalaryRepository } from "./salaries/repository.js";
import { SalaryService } from "./salaries/service.js";
import {
  COUNTRY_CODES,
  DEPARTMENTS,
  STATUSES,
  SUPPORTED_CURRENCIES,
} from "./shared/constants.js";
import { ConflictError, DomainError, NotFoundError } from "./shared/errors.js";

export function createApp(deps: {
  employees: EmployeeRepository;
  salaries: SalaryRepository;
  rates: FxRepository;
  today?: () => string;
}) {
  const today = deps.today ?? (() => new Date().toISOString().slice(0, 10));
  const employees = new EmployeeService(deps.employees);
  const salaries = new SalaryService(deps.employees, deps.salaries);
  const fx = new FxService(deps.rates);
  const analytics = new AnalyticsService(deps.employees, deps.salaries, fx);

  const app = express();
  app.use(cors({ origin: ["http://localhost:5173", "http://127.0.0.1:5173"] }));
  app.use(express.json());

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
    employeeRoutes({ employees, salaries, salaryRepo: deps.salaries, today }),
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
