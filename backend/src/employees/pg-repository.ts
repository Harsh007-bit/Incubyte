import type { Pool } from "pg";

import { ConflictError } from "../shared/errors.js";
import type { Employee, ListFilters } from "../shared/types.js";
import type { EmployeeRepository } from "./repository.js";

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

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "23505";
}

export class PgEmployeeRepository implements EmployeeRepository {
  constructor(private readonly db: Pool) {}

  async get(id: string) {
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
    try {
      const { rows } = await this.db.query<Row>(
        `INSERT INTO employees
          (id, employee_code, name, email, country_code, department, designation, status, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         RETURNING *`,
        [
          employee.id,
          employee.employeeCode,
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
      return toEmployee(rows[0]);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictError("employee_code or email already exists");
      }
      throw error;
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
      return toEmployee(rows[0]);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictError("email already exists");
      }
      throw error;
    }
  }

  async nextCodeNumber() {
    const { rows } = await this.db.query<{ employee_code: string }>(
      "SELECT employee_code FROM employees ORDER BY employee_code DESC LIMIT 1",
    );
    const last = rows[0]?.employee_code;
    if (!last?.startsWith("ACME-")) {
      return 1;
    }
    return Number(last.split("-")[1]) + 1;
  }

  async listPage(filters: ListFilters) {
    const clauses: string[] = [];
    const params: unknown[] = [];
    const add = (sql: string, value: unknown) => {
      params.push(value);
      clauses.push(sql.replace("?", `$${params.length}`));
    };
    if (filters.q) {
      add("name ILIKE ?", `%${filters.q}%`);
    }
    if (filters.country) {
      add("country_code = ?", filters.country);
    }
    if (filters.department) {
      add("department = ?", filters.department);
    }
    if (filters.status) {
      add("status = ?", filters.status);
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
    return { items: rows.map(toEmployee), total: Number(count.rows[0]?.count ?? 0) };
  }

  async listActive() {
    const { rows } = await this.db.query<Row>("SELECT * FROM employees WHERE status = 'active'");
    return rows.map(toEmployee);
  }
}
