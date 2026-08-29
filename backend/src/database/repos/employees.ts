import type { Employee, ListFilters } from "../../common/types.js";

export interface EmployeeRepository {
  get(id: string): Promise<Employee | null>;
  getByCode(code: string): Promise<Employee | null>;
  getByEmail(email: string): Promise<Employee | null>;
  add(employee: Employee): Promise<Employee>;
  save(employee: Employee): Promise<Employee>;
  listPage(filters: ListFilters): Promise<{ items: Employee[]; total: number }>;
  listActive(): Promise<Employee[]>;
}
