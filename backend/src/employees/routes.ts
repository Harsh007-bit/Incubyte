import Decimal from "decimal.js";
import { Router } from "express";
import { z } from "zod";

import { PAGE_SIZE_DEFAULT, PAGE_SIZE_MAX } from "../shared/constants.js";
import type { SalaryRepository } from "../salaries/repository.js";
import type { SalaryService } from "../salaries/service.js";
import type { EmployeeService } from "./service.js";

const createBody = z.object({
  name: z.string(),
  email: z.string().email(),
  country_code: z.string(),
  department: z.string(),
  designation: z.string(),
  employee_code: z.string().optional(),
});

const updateBody = z.object({
  name: z.string().optional(),
  email: z.string().email().optional(),
  country_code: z.string().optional(),
  department: z.string().optional(),
  designation: z.string().optional(),
  status: z.enum(["active", "inactive"]).optional(),
});

const salaryBody = z.object({
  base_amount: z.union([z.string(), z.number()]),
  currency: z.string(),
  effective_from: z.string(),
  reason: z.string(),
});

function salaryJson(record: {
  id: string;
  employeeId?: string;
  baseAmount: Decimal;
  currency: string;
  effectiveFrom: string;
  reason: string;
  createdAt?: Date;
}) {
  return {
    id: record.id,
    employee_id: record.employeeId,
    base_amount: record.baseAmount.toFixed(2),
    currency: record.currency,
    effective_from: record.effectiveFrom,
    reason: record.reason,
    created_at: record.createdAt?.toISOString(),
  };
}

function employeeJson(
  employee: {
    id: string;
    employeeCode: string;
    name: string;
    email: string;
    countryCode: string;
    department: string;
    designation: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
  },
  current: Parameters<typeof salaryJson>[0] | null,
) {
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
  salaryRepo: SalaryRepository;
  today: () => string;
}) {
  const router = Router();

  router.get("/", async (req, res, next) => {
    try {
      const page = Math.max(1, Number(req.query.page ?? 1));
      const pageSize = Math.min(
        PAGE_SIZE_MAX,
        Math.max(1, Number(req.query.page_size ?? PAGE_SIZE_DEFAULT)),
      );
      const { items, total } = await deps.employees.listPage({
        q: typeof req.query.q === "string" ? req.query.q : undefined,
        country: typeof req.query.country === "string" ? req.query.country : undefined,
        department: typeof req.query.department === "string" ? req.query.department : undefined,
        status: typeof req.query.status === "string" ? req.query.status : undefined,
        offset: (page - 1) * pageSize,
        limit: pageSize,
      });
      const current = await deps.salaryRepo.currentForMany(
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
      const body = createBody.parse(req.body);
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
      const body = updateBody.parse(req.body);
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
        baseAmount: new Decimal(body.base_amount),
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
