import { randomUUID } from "node:crypto";

import { faker } from "@faker-js/faker";
import { Decimal } from "decimal.js";

import { PgFxRepository } from "./database/repos/pgFx.js";
import { FxService } from "./services/fx.js";
import {
  COUNTRY_CODES,
  COUNTRY_CURRENCY,
  DEPARTMENTS,
} from "./common/constants.js";
import { migrate, pool } from "./db.js";

const TOTAL = 10_000;
const SEED = 42;

const COUNTRY_BASE: Record<string, string> = {
  US: "120000",
  GB: "75000",
  DE: "80000",
  NL: "78000",
  SG: "110000",
  AU: "115000",
  CA: "105000",
  JP: "8500000",
  AE: "220000",
  IN: "1800000",
};

const DEPT_FACTOR: Record<string, string> = {
  Engineering: "1.15",
  Product: "1.10",
  Design: "1.00",
  Sales: "1.05",
  Marketing: "0.95",
  Finance: "1.00",
  HR: "0.90",
  Operations: "0.85",
  "Customer Success": "0.88",
  Legal: "1.12",
};

const TITLES: Record<string, string[]> = {
  Engineering: ["Software Engineer", "Senior Engineer", "Staff Engineer", "Engineering Manager"],
  Product: ["Product Manager", "Senior Product Manager", "Product Lead"],
  Design: ["Product Designer", "Senior Designer", "Design Lead"],
  Sales: ["Account Executive", "Senior AE", "Sales Manager"],
  Marketing: ["Marketing Manager", "Content Lead", "Growth Manager"],
  Finance: ["Financial Analyst", "Accountant", "Finance Manager"],
  HR: ["HR Generalist", "HRBP", "People Partner"],
  Operations: ["Operations Associate", "Ops Manager"],
  "Customer Success": ["CSM", "Senior CSM"],
  Legal: ["Counsel", "Senior Counsel"],
};

function pick<T>(items: readonly T[], rng: () => number): T {
  return items[Math.floor(rng() * items.length)] as T;
}

function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function amount(country: string, department: string, rng: () => number): Decimal {
  const mid = new Decimal(COUNTRY_BASE[country]).mul(DEPT_FACTOR[department]);
  return mid.mul(new Decimal((0.72 + rng() * 0.73).toFixed(4))).toDecimalPlaces(0);
}

function addDays(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

async function insert(
  sql: string,
  rows: unknown[][],
) {
  const batch = 200;
  for (let i = 0; i < rows.length; i += batch) {
    const slice = rows.slice(i, i + batch);
    const values: string[] = [];
    const params: unknown[] = [];
    for (const row of slice) {
      const start = params.length;
      values.push(`(${row.map((_, idx) => `$${start + idx + 1}`).join(",")})`);
      params.push(...row);
    }
    await pool.query(`${sql} VALUES ${values.join(",")}`, params);
  }
}

async function run() {
  await migrate();
  const existing = await pool.query<{ count: number }>("SELECT COUNT(*)::int AS count FROM employees");
  if ((existing.rows[0]?.count ?? 0) > 0 && !process.argv.includes("--force")) {
    console.log("Database already has employees. Refusing to seed twice. Pass --force to replace.");
    return;
  }
  if (process.argv.includes("--force")) {
    await pool.query("TRUNCATE salary_records, employees CASCADE");
  }

  await new FxService(new PgFxRepository(pool)).seedDefaults();

  const rng = mulberry32(SEED);
  faker.seed(SEED);
  const asOf = "2026-08-29";
  const countryWeights = [28, 22, 10, 8, 6, 6, 6, 5, 5, 4];
  const weightSum = countryWeights.reduce((a, b) => a + b, 0);

  const employees: unknown[][] = [];
  const salaries: unknown[][] = [];

  for (let index = 1; index <= TOTAL; index += 1) {
    const countryRoll = rng() * weightSum;
    let acc = 0;
    let country: (typeof COUNTRY_CODES)[number] = COUNTRY_CODES[0];
    for (let i = 0; i < COUNTRY_CODES.length; i += 1) {
      acc += countryWeights[i];
      if (countryRoll <= acc) {
        country = COUNTRY_CODES[i];
        break;
      }
    }
    const department = pick(DEPARTMENTS, rng);
    const now = new Date();
    const id = randomUUID();
    employees.push([
      id,
      `ACME-${String(index).padStart(5, "0")}`,
      faker.person.fullName(),
      `${faker.internet.username()}.${index}@acme.test`.toLowerCase(),
      country,
      department,
      pick(TITLES[department], rng),
      rng() < 0.08 ? "inactive" : "active",
      now,
      now,
    ]);

    if (rng() < 0.02) {
      continue;
    }

    const hired = addDays(asOf, -Math.floor(30 + rng() * 365 * 8));
    const currency = COUNTRY_CURRENCY[country];
    let lastFrom = addDays(hired, Math.floor(rng() * 60));
    let lastAmount = amount(country, department, rng);
    salaries.push([
      randomUUID(),
      id,
      lastAmount.toFixed(2),
      currency,
      lastFrom,
      "offer accepted",
      now,
    ]);

    const extra = rng() < 0.55 ? 0 : rng() < 0.78 ? 1 : 2;
    for (let step = 0; step < extra; step += 1) {
      lastFrom = addDays(lastFrom, Math.floor(280 + rng() * 140));
      if (lastFrom > addDays(asOf, 180)) {
        break;
      }
      lastAmount = lastAmount.mul(new Decimal((1.04 + rng() * 0.14).toFixed(4))).toDecimalPlaces(0);
      salaries.push([
        randomUUID(),
        id,
        lastAmount.toFixed(2),
        currency,
        lastFrom,
        lastFrom > asOf
          ? "scheduled raise"
          : pick(["annual revision", "promotion", "market adjustment"], rng),
        now,
      ]);
    }
  }

  await insert(
    `INSERT INTO employees
      (id, employee_code, name, email, country_code, department, designation, status, created_at, updated_at)`,
    employees,
  );
  await insert(
    `INSERT INTO salary_records
      (id, employee_id, base_amount, currency, effective_from, reason, created_at)`,
    salaries,
  );

  console.log(`Seeded ${employees.length} employees and ${salaries.length} salary records.`);
  await pool.end();
}

run().catch(async (error) => {
  console.error(error);
  await pool.end();
  process.exit(1);
});
