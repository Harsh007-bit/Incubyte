import type { Decimal } from "decimal.js";

export type EmployeeStatus = "active" | "inactive";

export type Employee = {
  id: string;
  employeeCode: string;
  name: string;
  email: string;
  countryCode: string;
  department: string;
  designation: string;
  status: EmployeeStatus;
  createdAt: Date;
  updatedAt: Date;
};

export type SalaryRecord = {
  id: string;
  employeeId: string;
  baseAmount: Decimal;
  currency: string;
  effectiveFrom: string;
  reason: string;
  createdAt: Date;
};

export type ExchangeRate = {
  currency: string;
  rateToUsd: Decimal;
  updatedAt: Date;
};

export type ListFilters = {
  names: string[];
  countries: string[];
  departments: string[];
  statuses: string[];
  offset: number;
  limit: number;
};
