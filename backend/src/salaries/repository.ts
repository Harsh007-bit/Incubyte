import type { SalaryRecord } from "../shared/types.js";

export interface SalaryRepository {
  add(record: SalaryRecord): Promise<SalaryRecord>;
  listForEmployee(employeeId: string): Promise<SalaryRecord[]>;
  existsOn(employeeId: string, effectiveFrom: string): Promise<boolean>;
  currentForMany(employeeIds: string[], today: string): Promise<Map<string, SalaryRecord>>;
}
