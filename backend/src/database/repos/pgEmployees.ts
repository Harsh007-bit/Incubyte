import type { Pool } from "pg";

import { ConflictError } from "../../common/errors.js";
import type { Employee, ListFilters } from "../../common/types.js";
import { postgresCode } from "../../utils/postgres.js";
import type { EmployeeRepository } from "./employees.js";

type Row = {
  id: string;
  employee_code: string;
  name: string;
  email: string;
  country_code: string;
  department: string;
  designation: string;
  status: string;
  created_at: Date;
  updated_at: Date;
};

function toEmployee(row: Row): Employee {
  return {
    id: row.id,
    employeeCode: row.employee_code,
    name: row.name,
    email: row.email,
    countryCode: row.country_code,
    department: row.department,
    designation: row.designation,
    status: row.status as Employee["status"],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function escapeIlike(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class PgEmployeeRepository implements EmployeeRepository {
  constructor(private readonly db: Pool) {}

  async get(id: string) {
    if (!UUID.test(id)) {
      return null;
    }
    const { rows } = await this.db.query<Row>("SELECT * FROM employees WHERE id = $1", [id]);
    return rows[0] ? toEmployee(rows[0]) : null;
  }

  async getByCode(code: string) {
    const { rows } = await this.db.query<Row>(
      "SELECT * FROM employees WHERE employee_code = $1",
      [code],
    );
    return rows[0] ? toEmployee(rows[0]) : null;
  }

  async getByEmail(email: string) {
    const { rows } = await this.db.query<Row>(
      "SELECT * FROM employees WHERE LOWER(email) = LOWER($1)",
      [email],
    );
    return rows[0] ? toEmployee(rows[0]) : null;
  }

  async add(employee: Employee) {
    const client = await this.db.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(87231001)");
      let code = employee.employeeCode;
      if (!code) {
        const { rows: seq } = await client.query<{ n: string }>(
          `SELECT COALESCE(MAX(CAST(SUBSTRING(employee_code FROM 6) AS INTEGER)), 0)::text AS n
           FROM employees
           WHERE employee_code ~ '^ACME-[0-9]+$'`,
        );
        code = `ACME-${String(Number(seq[0]!.n) + 1).padStart(5, "0")}`;
      }
      const { rows } = await client.query<Row>(
        `INSERT INTO employees
          (id, employee_code, name, email, country_code, department, designation, status, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         RETURNING *`,
        [
          employee.id,
          code,
          employee.name,
          employee.email,
          employee.countryCode,
          employee.department,
          employee.designation,
          employee.status,
          employee.createdAt,
          employee.updatedAt,
        ],
      );
      await client.query("COMMIT");
      return toEmployee(rows[0]!);
    } catch (error) {
      await client.query("ROLLBACK");
      if (postgresCode(error) === "23505") {
        throw new ConflictError("employee_code or email already exists");
      }
      throw error;
    } finally {
      client.release();
    }
  }

  async save(employee: Employee) {
    try {
      const { rows } = await this.db.query<Row>(
        `UPDATE employees
         SET name=$2, email=$3, country_code=$4, department=$5, designation=$6, status=$7, updated_at=$8
         WHERE id=$1
         RETURNING *`,
        [
          employee.id,
          employee.name,
          employee.email,
          employee.countryCode,
          employee.department,
          employee.designation,
          employee.status,
          employee.updatedAt,
        ],
      );
      return toEmployee(rows[0]!);
    } catch (error) {
      if (postgresCode(error) === "23505") {
        throw new ConflictError("email already exists");
      }
      throw error;
    }
  }

  async listPage(filters: ListFilters) {
    const clauses: string[] = [];
    const params: unknown[] = [];
    const add = (sql: string, value: unknown) => {
      params.push(value);
      clauses.push(sql.replace("?", `$${params.length}`));
    };
    if (filters.names.length > 0) {
      const parts = filters.names.map((name) => {
        params.push(`%${escapeIlike(name)}%`);
        return `name ILIKE $${params.length} ESCAPE '\\'`;
      });
      clauses.push(`(${parts.join(" OR ")})`);
    }
    if (filters.countries.length > 0) {
      add("country_code = ANY(?::text[])", filters.countries);
    }
    if (filters.departments.length > 0) {
      add("department = ANY(?::text[])", filters.departments);
    }
    if (filters.statuses.length > 0) {
      add("status = ANY(?::text[])", filters.statuses);
    }
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const count = await this.db.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM employees ${where}`,
      params,
    );
    const { rows } = await this.db.query<Row>(
      `SELECT * FROM employees ${where} ORDER BY name ASC OFFSET $${params.length + 1} LIMIT $${params.length + 2}`,
      [...params, filters.offset, filters.limit],
    );
    return { items: rows.map(toEmployee), total: Number(count.rows[0]!.count) };
  }

  async listActive() {
    const { rows } = await this.db.query<Row>("SELECT * FROM employees WHERE status = 'active'");
    return rows.map(toEmployee);
  }
}
