import type { SalaryRecord } from "../../common/types.js";

export interface SalaryRepository {
  add(record: SalaryRecord): Promise<SalaryRecord>;
  listForEmployee(employeeId: string): Promise<SalaryRecord[]>;
  currentForMany(employeeIds: string[], today: string): Promise<Map<string, SalaryRecord>>;
}
