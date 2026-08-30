import { Router } from "express";

import { PAGE_SIZE_DEFAULT, PAGE_SIZE_MAX } from "../common/constants.js";
import type { Employee, SalaryRecord } from "../common/types.js";
import type { EmployeeService } from "../services/employees.js";
import type { SalaryService } from "../services/salaries.js";
import { decodeExcelBase64, parseEmployeeExcel, sampleEmployeeExcel } from "../utils/excel.js";
import { queryParam, queryValues } from "../utils/query.js";
import { createEmployeeBody, importExcelBody, updateEmployeeBody } from "../validators/employees.js";
import { parseAmount, salaryBody } from "../validators/salaries.js";

function toSalaryJson(record: SalaryRecord) {
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

function parsePositiveInt(value: unknown, fallback: number, max = Number.MAX_SAFE_INTEGER): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) return fallback;
  return Math.min(max, n);
}

function toEmployeeJson(employee: Employee, currentSalary?: SalaryRecord | null) {
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
    current_salary: currentSalary ? toSalaryJson(currentSalary) : null,
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
      const page = parsePositiveInt(queryParam(req, "page"), 1);
      const pageSize = parsePositiveInt(queryParam(req, "page_size"), PAGE_SIZE_DEFAULT, PAGE_SIZE_MAX);
      const { items, total } = await deps.employees.listPage({
        names: queryValues(req.query.q),
        countries: queryValues(req.query.country),
        departments: queryValues(req.query.department),
        statuses: queryValues(req.query.status),
        offset: (page - 1) * pageSize,
        limit: pageSize,
      });
      const currentByEmployeeId = await deps.salaries.getCurrentForMany(
        items.map((row) => row.id),
        deps.today(),
      );
      res.json({
        items: items.map((row) => toEmployeeJson(row, currentByEmployeeId.get(row.id))),
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
      res.status(201).json(toEmployeeJson(employee, null));
    } catch (error) {
      next(error);
    }
  });

  router.get("/import/sample", async (_req, res, next) => {
    try {
      const file = await sampleEmployeeExcel();
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      res.setHeader("Content-Disposition", "attachment; filename=employees-sample.xlsx");
      res.send(file);
    } catch (error) {
      next(error);
    }
  });

  router.post("/import", async (req, res, next) => {
    try {
      const { file } = importExcelBody.parse(req.body);
      const { created, errors } = await deps.employees.createMany(
        await parseEmployeeExcel(decodeExcelBase64(file)),
      );
      res.json({ created: created.length, errors });
    } catch (error) {
      next(error);
    }
  });

  router.get("/:id", async (req, res, next) => {
    try {
      const employeeId = req.params.id;
      const employee = await deps.employees.getById(employeeId);
      const currentSalary = await deps.salaries.getCurrent(employee.id, deps.today());
      res.json(toEmployeeJson(employee, currentSalary));
    } catch (error) {
      next(error);
    }
  });

  router.patch("/:id", async (req, res, next) => {
    try {
      const body = updateEmployeeBody.parse(req.body);
      const employee = await deps.employees.updateById(req.params.id, {
        name: body.name,
        email: body.email,
        countryCode: body.country_code,
        department: body.department,
        designation: body.designation,
        status: body.status,
      });
      const currentSalary = await deps.salaries.getCurrent(employee.id, deps.today());
      res.json(toEmployeeJson(employee, currentSalary));
    } catch (error) {
      next(error);
    }
  });

  router.get("/:id/salary-history", async (req, res, next) => {
    try {
      const salaryHistory = await deps.salaries.listHistory(req.params.id);
      res.json(salaryHistory.map(toSalaryJson));
    } catch (error) {
      next(error);
    }
  });

  router.post("/:id/salary", async (req, res, next) => {
    try {
      const body = salaryBody.parse(req.body);
      const salary = await deps.salaries.addSalary({
        employeeId: req.params.id,
        baseAmount: parseAmount(body.base_amount),
        currency: body.currency,
        effectiveFrom: body.effective_from,
        reason: body.reason,
      });
      res.status(201).json(toSalaryJson(salary));
    } catch (error) {
      next(error);
    }
  });

  return router;
}
