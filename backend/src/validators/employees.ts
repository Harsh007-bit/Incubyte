import { z } from "zod";

import { COUNTRY_CODES, DEPARTMENTS, STATUSES } from "../common/constants.js";
import { DomainError } from "../common/errors.js";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const createEmployeeBody = z.object({
  name: z.string().trim(),
  email: z.string().trim(),
  country_code: z.string().trim(),
  department: z.string().trim(),
  designation: z.string().trim(),
  employee_code: z.string().trim().optional(),
});

export const updateEmployeeBody = z.object({
  name: z.string().trim().optional(),
  email: z.string().trim().optional(),
  country_code: z.string().trim().optional(),
  department: z.string().trim().optional(),
  designation: z.string().trim().optional(),
  status: z.enum(["active", "inactive"]).optional(),
});

export const importCsvBody = z.object({ csv: z.string().min(1) });

export function validateProfile(input: {
  name: string;
  email: string;
  countryCode: string;
  department: string;
  designation: string;
  status: string;
}): void {
  if (!input.name.trim()) throw new DomainError("name is required");
  if (!EMAIL.test(input.email.trim())) throw new DomainError("email must be a valid email address");
  if (!COUNTRY_CODES.includes(input.countryCode as (typeof COUNTRY_CODES)[number])) {
    throw new DomainError(`country_code must be one of ${COUNTRY_CODES.join(", ")}`);
  }
  if (!DEPARTMENTS.includes(input.department as (typeof DEPARTMENTS)[number])) {
    throw new DomainError(`department must be one of ${DEPARTMENTS.join(", ")}`);
  }
  if (!input.designation.trim()) throw new DomainError("designation is required");
  if (!STATUSES.includes(input.status as (typeof STATUSES)[number])) {
    throw new DomainError("status must be active or inactive");
  }
}
