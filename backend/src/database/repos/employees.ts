import type { Employee, ListFilters } from "../../common/types.js";

export interface EmployeeRepository {
  getById(employeeId: string): Promise<Employee | null>;
  insert(employee: Employee): Promise<Employee>;
  update(employee: Employee): Promise<Employee>;
  listPage(filters: ListFilters): Promise<{ items: Employee[]; total: number }>;
  listActive(): Promise<Employee[]>;
}
