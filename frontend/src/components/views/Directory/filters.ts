export const PAGE_SIZES = [10, 25, 50, 100] as const;
export const DEFAULT_PAGE_SIZE = 25;

export type FilterField = "name" | "country" | "department" | "status";

export type DirectoryQuery = {
  names: string[];
  countries: string[];
  departments: string[];
  statuses: string[];
};

export type FilterChip = {
  id: string;
  field: FilterField;
  label: string;
  value: string;
};

const LABELS: Record<FilterField, string> = {
  name: "Name",
  country: "Country",
  department: "Department",
  status: "Status",
};

export function pushUnique(list: string[], value: string): string[] {
  const trimmed = value.trim();
  if (!trimmed) return list;
  if (list.some((item) => item.toLowerCase() === trimmed.toLowerCase())) return list;
  return [...list, trimmed];
}

export function parseNameTerms(raw: string): string[] {
  return raw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

export function withoutValue(list: string[], value: string): string[] {
  return list.filter((item) => item.toLowerCase() !== value.toLowerCase());
}

export function emptyQuery(): DirectoryQuery {
  return { names: [], countries: [], departments: [], statuses: [] };
}

export function activeFilterChips(query: DirectoryQuery): FilterChip[] {
  const chips: FilterChip[] = [];
  const add = (field: FilterField, value: string) => {
    chips.push({ id: `${field}:${value.toLowerCase()}`, field, label: LABELS[field], value });
  };
  for (const name of query.names) add("name", name);
  for (const country of query.countries) add("country", country);
  for (const department of query.departments) add("department", department);
  for (const status of query.statuses) add("status", status);
  return chips;
}
