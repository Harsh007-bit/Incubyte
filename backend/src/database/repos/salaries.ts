import type { SalaryRecord } from "../../common/types.js";

export interface SalaryRepository {
  insert(record: SalaryRecord): Promise<SalaryRecord>;
  listForEmployee(employeeId: string): Promise<SalaryRecord[]>;
  getCurrentForMany(employeeIds: string[], today: string): Promise<Map<string, SalaryRecord>>;
}
