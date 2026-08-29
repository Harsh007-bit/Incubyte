import { Router } from "express";

import { PAGE_SIZE_DEFAULT, PAGE_SIZE_MAX } from "../common/constants.js";
import type { Employee, SalaryRecord } from "../common/types.js";
import type { EmployeeService } from "../services/employees.js";
import type { SalaryService } from "../services/salaries.js";
import { parseEmployeeCsv } from "../utils/csv.js";
import { queryParam, queryValues } from "../utils/query.js";
import { createEmployeeBody, importCsvBody, updateEmployeeBody } from "../validators/employees.js";
import { parseAmount, salaryBody } from "../validators/salaries.js";

function salaryJson(record: SalaryRecord) {
  return {
    id: record.id,
    employee_id: record.employeeId,
    base_amount: record.baseAmount.toFixed(2),
    currency: record.currency,
    effective_from: record.effectiveFrom,
    reason: record.reason,
    created_at: record.createdAt.toISOString(),
  };
}

function positiveInt(value: unknown, fallback: number, max = Number.MAX_SAFE_INTEGER): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) return fallback;
  return Math.min(max, n);
}

function employeeJson(employee: Employee, current: SalaryRecord | null) {
  return {
    id: employee.id,
    employee_code: employee.employeeCode,
    name: employee.name,
    email: employee.email,
    country_code: employee.countryCode,
    department: employee.department,
    designation: employee.designation,
    status: employee.status,
    created_at: employee.createdAt.toISOString(),
    updated_at: employee.updatedAt.toISOString(),
    current_salary: current ? salaryJson(current) : null,
  };
}

export function employeeRoutes(deps: {
  employees: EmployeeService;
  salaries: SalaryService;
  today: () => string;
}) {
  const router = Router();

  router.get("/", async (req, res, next) => {
    try {
      const page = positiveInt(queryParam(req, "page_index") ?? queryParam(req, "page"), 1);
      const pageSize = positiveInt(queryParam(req, "page_size"), PAGE_SIZE_DEFAULT, PAGE_SIZE_MAX);
      const { items, total } = await deps.employees.listPage({
        names: queryValues(req.query.q),
        countries: queryValues(req.query.country),
        departments: queryValues(req.query.department),
        statuses: queryValues(req.query.status),
        offset: (page - 1) * pageSize,
        limit: pageSize,
      });
      const current = await deps.salaries.currentForMany(
        items.map((row) => row.id),
        deps.today(),
      );
      res.json({
        items: items.map((row) => employeeJson(row, current.get(row.id) ?? null)),
        page,
        page_size: pageSize,
        total,
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/", async (req, res, next) => {
    try {
      const body = createEmployeeBody.parse(req.body);
      const employee = await deps.employees.create({
        name: body.name,
        email: body.email,
        countryCode: body.country_code,
        department: body.department,
        designation: body.designation,
        employeeCode: body.employee_code,
      });
      res.status(201).json(employeeJson(employee, null));
    } catch (error) {
      next(error);
    }
  });

  router.post("/import", async (req, res, next) => {
    try {
      const { csv } = importCsvBody.parse(req.body);
      const { created, errors } = await deps.employees.createMany(parseEmployeeCsv(csv));
      res.json({ created: created.length, errors });
    } catch (error) {
      next(error);
    }
  });

  router.get("/:id", async (req, res, next) => {
    try {
      const employee = await deps.employees.get(req.params.id);
      const current = await deps.salaries.current(employee.id, deps.today());
      res.json(employeeJson(employee, current));
    } catch (error) {
      next(error);
    }
  });

  router.patch("/:id", async (req, res, next) => {
    try {
      const body = updateEmployeeBody.parse(req.body);
      const employee = await deps.employees.update(req.params.id, {
        name: body.name,
        email: body.email,
        countryCode: body.country_code,
        department: body.department,
        designation: body.designation,
        status: body.status,
      });
      const current = await deps.salaries.current(employee.id, deps.today());
      res.json(employeeJson(employee, current));
    } catch (error) {
      next(error);
    }
  });

  router.get("/:id/salary-history", async (req, res, next) => {
    try {
      const rows = await deps.salaries.history(req.params.id);
      res.json(rows.map(salaryJson));
    } catch (error) {
      next(error);
    }
  });

  router.post("/:id/salary", async (req, res, next) => {
    try {
      const body = salaryBody.parse(req.body);
      const row = await deps.salaries.addSalary({
        employeeId: req.params.id,
        baseAmount: parseAmount(body.base_amount),
        currency: body.currency,
        effectiveFrom: body.effective_from,
        reason: body.reason,
      });
      res.status(201).json(salaryJson(row));
    } catch (error) {
      next(error);
    }
  });

  return router;
}
