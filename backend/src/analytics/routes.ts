import { Router } from "express";

import type { AnalyticsService } from "./service.js";

export function analyticsRoutes(deps: { analytics: AnalyticsService; today: () => string }) {
  const router = Router();

  router.get("/headcount", async (req, res, next) => {
    try {
      const groupBy = typeof req.query.groupBy === "string" ? req.query.groupBy : "country";
      res.json(await deps.analytics.headcount(groupBy));
    } catch (error) {
      next(error);
    }
  });

  router.get("/avg-salary", async (req, res, next) => {
    try {
      const groupBy = typeof req.query.groupBy === "string" ? req.query.groupBy : "country";
      const rows = await deps.analytics.avgSalary(groupBy, deps.today());
      res.json(
        rows.map((row) => ({
          group: row.group,
          avg_salary_usd: row.avgSalaryUsd?.toFixed(2) ?? null,
          paid_headcount: row.paidHeadcount,
          headcount: row.headcount,
        })),
      );
    } catch (error) {
      next(error);
    }
  });

  router.get("/spend", async (req, res, next) => {
    try {
      const groupBy = typeof req.query.groupBy === "string" ? req.query.groupBy : "country";
      const rows = await deps.analytics.spend(groupBy, deps.today());
      res.json(
        rows.map((row) => ({
          group: row.group,
          spend_usd: row.spendUsd.toFixed(2),
          paid_headcount: row.paidHeadcount,
        })),
      );
    } catch (error) {
      next(error);
    }
  });

  return router;
}
