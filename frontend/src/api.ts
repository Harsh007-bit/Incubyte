import type { AvgRow, Employee, EmployeeList, HeadcountRow, Meta, Salary, SpendRow } from "./types";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
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
  meta: () => request<Meta>("/api/meta"),
  employees: (params: Record<string, string | number | undefined>) => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== "") query.set(key, String(value));
    }
    return request<EmployeeList>(`/api/employees?${query}`);
  },
  employee: (id: string) => request<Employee>(`/api/employees/${id}`),
  createEmployee: (body: Record<string, string>) =>
    request<Employee>("/api/employees", { method: "POST", body: JSON.stringify(body) }),
  updateEmployee: (id: string, body: Record<string, string>) =>
    request<Employee>(`/api/employees/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  history: (id: string) => request<Salary[]>(`/api/employees/${id}/salary-history`),
  addSalary: (id: string, body: Record<string, string>) =>
    request<Salary>(`/api/employees/${id}/salary`, { method: "POST", body: JSON.stringify(body) }),
  headcount: (groupBy: string) => request<HeadcountRow[]>(`/api/analytics/headcount?groupBy=${groupBy}`),
  spend: (groupBy: string) => request<SpendRow[]>(`/api/analytics/spend?groupBy=${groupBy}`),
  avgSalary: (groupBy: string) => request<AvgRow[]>(`/api/analytics/avg-salary?groupBy=${groupBy}`),
};
