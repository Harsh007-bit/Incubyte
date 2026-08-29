import { COUNTRY_CODES, DEPARTMENTS, STATUSES } from "../shared/constants.js";
import { DomainError } from "../shared/errors.js";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateProfile(input: {
  name: string;
  email: string;
  countryCode: string;
  department: string;
  designation: string;
  status?: string;
}): void {
  if (!input.name.trim()) {
    throw new DomainError("name is required");
  }
  if (!input.email.trim() || !EMAIL.test(input.email.trim())) {
    throw new DomainError("email must be a valid email address");
  }
  if (!COUNTRY_CODES.includes(input.countryCode as (typeof COUNTRY_CODES)[number])) {
    throw new DomainError(`country_code must be one of ${COUNTRY_CODES.join(", ")}`);
  }
  if (!DEPARTMENTS.includes(input.department as (typeof DEPARTMENTS)[number])) {
    throw new DomainError(`department must be one of ${DEPARTMENTS.join(", ")}`);
  }
  if (!input.designation.trim()) {
    throw new DomainError("designation is required");
  }
  const status = input.status ?? "active";
  if (!STATUSES.includes(status as (typeof STATUSES)[number])) {
    throw new DomainError("status must be active or inactive");
  }
}
