import type { AvgRow, Employee, EmployeeList, HeadcountRow, Meta, Salary, SpendRow } from "../models/types";

const API_BASE = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { detail?: string };
    throw new Error(body.detail ?? `Request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}

export const api = {
  getMeta: () => request<Meta>("/api/meta"),
  listEmployees: (params: {
    q?: string[];
    country?: string[];
    department?: string[];
    status?: string[];
    page?: number;
    page_size?: number;
  }) => {
    const query = new URLSearchParams();
    const appendAll = (key: string, values: string[] = []) => {
      for (const value of values) query.append(key, value);
    };
    appendAll("q", params.q);
    appendAll("country", params.country);
    appendAll("department", params.department);
    appendAll("status", params.status);
    if (params.page !== undefined) query.set("page", String(params.page));
    if (params.page_size !== undefined) query.set("page_size", String(params.page_size));
    return request<EmployeeList>(`/api/employees?${query}`);
  },
  getEmployee: (employeeId: string) => request<Employee>(`/api/employees/${employeeId}`),
  createEmployee: (body: Record<string, string>) =>
    request<Employee>("/api/employees", { method: "POST", body: JSON.stringify(body) }),
  importEmployees: (file: string) =>
    request<{ created: number; errors: Array<{ line: number; detail: string }> }>(
      "/api/employees/import",
      { method: "POST", body: JSON.stringify({ file }) },
    ),
  importSample: async () => {
    const response = await fetch(`${API_BASE}/api/employees/import/sample`);
    if (!response.ok) throw new Error(`Request failed (${response.status})`);
    return response.blob();
  },
  updateEmployee: (employeeId: string, body: Record<string, string>) =>
    request<Employee>(`/api/employees/${employeeId}`, { method: "PATCH", body: JSON.stringify(body) }),
  listSalaryHistory: (employeeId: string) => request<Salary[]>(`/api/employees/${employeeId}/salary-history`),
  addSalary: (employeeId: string, body: Record<string, string>) =>
    request<Salary>(`/api/employees/${employeeId}/salary`, { method: "POST", body: JSON.stringify(body) }),
  getHeadcount: (groupBy: string) => request<HeadcountRow[]>(`/api/analytics/headcount?groupBy=${groupBy}`),
  getSpend: (groupBy: string) => request<SpendRow[]>(`/api/analytics/spend?groupBy=${groupBy}`),
  getAvgSalary: (groupBy: string) => request<AvgRow[]>(`/api/analytics/avg-salary?groupBy=${groupBy}`),
};
