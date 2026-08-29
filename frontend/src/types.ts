export type Salary = {
  id: string;
  employee_id?: string;
  base_amount: string;
  currency: string;
  effective_from: string;
  reason: string;
};

export type Employee = {
  id: string;
  employee_code: string;
  name: string;
  email: string;
  country_code: string;
  department: string;
  designation: string;
  status: "active" | "inactive";
  current_salary: Salary | null;
};

export type EmployeeList = {
  items: Employee[];
  page: number;
  page_size: number;
  total: number;
};

export type Meta = {
  country_codes: string[];
  departments: string[];
  currencies: string[];
  statuses: string[];
};

export type HeadcountRow = { group: string; headcount: number };
export type SpendRow = { group: string; spend_usd: string; paid_headcount: number };
export type AvgRow = {
  group: string;
  avg_salary_usd: string | null;
  paid_headcount: number;
  headcount: number;
};
