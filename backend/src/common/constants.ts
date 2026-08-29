export const COUNTRY_CODES = [
  "IN",
  "US",
  "GB",
  "DE",
  "SG",
  "AU",
  "CA",
  "JP",
  "NL",
  "AE",
] as const;

export const COUNTRY_CURRENCY: Record<string, string> = {
  IN: "INR",
  US: "USD",
  GB: "GBP",
  DE: "EUR",
  SG: "SGD",
  AU: "AUD",
  CA: "CAD",
  JP: "JPY",
  NL: "EUR",
  AE: "AED",
};

export const SUPPORTED_CURRENCIES = [
  "USD",
  "INR",
  "GBP",
  "EUR",
  "SGD",
  "AUD",
  "CAD",
  "JPY",
  "AED",
] as const;

export const DEPARTMENTS = [
  "Engineering",
  "Product",
  "Design",
  "Sales",
  "Marketing",
  "Finance",
  "HR",
  "Operations",
  "Customer Success",
  "Legal",
] as const;

export const STATUSES = ["active", "inactive"] as const;

export const PAGE_SIZE_DEFAULT = 25;
export const PAGE_SIZE_MAX = 100;

export const DEFAULT_RATES: Record<string, string> = {
  USD: "1.000000",
  INR: "0.012000",
  GBP: "1.270000",
  EUR: "1.080000",
  SGD: "0.740000",
  AUD: "0.650000",
  CAD: "0.730000",
  JPY: "0.006700",
  AED: "0.272000",
};
