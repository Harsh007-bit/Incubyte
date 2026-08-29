import { KeyboardEvent, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

import { api } from "../../../api";
import {
  activeFilterChips,
  DEFAULT_PAGE_SIZE,
  emptyQuery,
  PAGE_SIZES,
  parseNameTerms,
  pushUnique,
  withoutValue,
  type FilterChip,
} from "./filters";
import { TableSkeleton } from "../../Skeleton";
import { formatMoney } from "../../../utils/money";
import type { Employee, Meta } from "../../../models/types";
import { HireModal } from "./HireModal";

const SEARCH_DEBOUNCE_MS = 300;

export function Directory() {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [items, setItems] = useState<Employee[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [draft, setDraft] = useState("");
  const [debouncedDraft, setDebouncedDraft] = useState("");
  const [names, setNames] = useState<string[]>([]);
  const [countries, setCountries] = useState<string[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [statuses, setStatuses] = useState<string[]>(["active"]);
  const [error, setError] = useState<string | null>(null);
  const [hiring, setHiring] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pageDraft, setPageDraft] = useState("1");
  const requestId = useRef(0);

  const nameTerms = pushUnique(names, debouncedDraft);
  const chips = activeFilterChips({
    names: nameTerms,
    countries,
    departments,
    statuses,
  });
  const extraFilterCount = countries.length + departments.length + statuses.length;
  const pages = Math.max(1, Math.ceil(total / pageSize));

  async function load(nextPage: number, queryNames = nameTerms) {
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const result = await api.employees({
        q: queryNames,
        country: countries,
        department: departments,
        status: statuses,
        page: nextPage,
        page_size: pageSize,
      });
      if (id !== requestId.current) return;
      setItems(result.items);
      setTotal(result.total);
      setPage(result.page);
    } catch (err) {
      if (id !== requestId.current) return;
      setError((err as Error).message);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }

  function goToPage(next: number) {
    const clamped = Math.min(pages, Math.max(1, Number.isInteger(next) ? next : 1));
    void load(clamped);
  }

  function jumpFromDraft() {
    const n = Number(pageDraft);
    if (!Number.isInteger(n) || n < 1) {
      setPageDraft(String(page));
      return;
    }
    goToPage(n);
  }

  useEffect(() => {
    api.meta().then(setMeta).catch((err: Error) => setError(err.message));
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedDraft(draft), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [draft]);

  useEffect(() => {
    void load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedDraft, names, countries, departments, statuses, pageSize]);

  useEffect(() => {
    setPageDraft(String(page));
  }, [page]);

  function addNames(raw: string) {
    const next = parseNameTerms(raw).reduce(pushUnique, names);
    setNames(next);
    setDraft("");
    setDebouncedDraft("");
  }

  function onSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter" && event.key !== ",") return;
    event.preventDefault();
    addNames(draft);
  }

  function clearChip(chip: FilterChip) {
    if (chip.field === "name") {
      setNames((current) => withoutValue(current, chip.value));
      if (draft.trim().toLowerCase() === chip.value.toLowerCase()) {
        setDraft("");
        setDebouncedDraft("");
      }
      return;
    }
    if (chip.field === "country") setCountries((current) => withoutValue(current, chip.value));
    if (chip.field === "department") setDepartments((current) => withoutValue(current, chip.value));
    if (chip.field === "status") setStatuses((current) => withoutValue(current, chip.value));
  }

  function clearAllFilters() {
    const blank = emptyQuery();
    setDraft("");
    setDebouncedDraft("");
    setNames(blank.names);
    setCountries(blank.countries);
    setDepartments(blank.departments);
    setStatuses(blank.statuses);
  }

  return (
    <div>
      <h1>People</h1>
      <p className="lede">
        Search the 10,000-person directory. Compensation is optional at hire — you can
        add pay later.
      </p>
      {error && <p className="error">{error}</p>}

      <form
        className="toolbar"
        onSubmit={(event) => {
          event.preventDefault();
          addNames(draft);
        }}
      >
        <label className="toolbar-search">
          Search
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onSearchKeyDown}
            placeholder="Name, Enter to add another"
            autoComplete="off"
          />
        </label>
        <button
          className="btn secondary filters-toggle"
          type="button"
          aria-expanded={filtersOpen}
          aria-controls="directory-filters"
          onClick={() => setFiltersOpen((open) => !open)}
        >
          Filters
          {extraFilterCount > 0 && <span className="filters-count">{extraFilterCount}</span>}
          <span className="chevron" aria-hidden="true" />
        </button>
        <button className="btn secondary" type="button" onClick={() => setHiring(true)}>
          Add person
        </button>
      </form>

      {filtersOpen && (
        <div className="filters-panel" id="directory-filters">
          <AddSelect
            label="Country"
            placeholder="Add country"
            options={meta?.country_codes}
            selected={countries}
            onAdd={(value) => setCountries((current) => pushUnique(current, value))}
          />
          <AddSelect
            label="Department"
            placeholder="Add department"
            options={meta?.departments}
            selected={departments}
            onAdd={(value) => setDepartments((current) => pushUnique(current, value))}
          />
          <AddSelect
            label="Status"
            placeholder="Add status"
            options={["active", "inactive"]}
            selected={statuses}
            onAdd={(value) => setStatuses((current) => pushUnique(current, value))}
          />
        </div>
      )}

      <ActiveFilters chips={chips} onClear={clearChip} onClearAll={clearAllFilters} />

      {hiring && (
        <HireModal
          meta={meta}
          onClose={() => setHiring(false)}
          onHired={() => void load(1)}
        />
      )}

      <div className="card" aria-busy={loading}>
        <table>
          <thead>
            <tr>
              <th>Code</th>
              <th>Name</th>
              <th>Country</th>
              <th>Department</th>
              <th>Current pay</th>
              <th>Status</th>
            </tr>
          </thead>
          {loading ? (
            <TableSkeleton rows={Math.min(pageSize, 10)} />
          ) : (
            <tbody>
              {items.map((person) => (
                <tr key={person.id}>
                  <td className="mono">{person.employee_code}</td>
                  <td>
                    <Link to={`/employees/${person.id}`}>{person.name}</Link>
                  </td>
                  <td>{person.country_code}</td>
                  <td>{person.department}</td>
                  <td>
                    {person.current_salary
                      ? formatMoney(person.current_salary.base_amount, person.current_salary.currency)
                      : "—"}
                  </td>
                  <td>
                    <span className={`pill ${person.status}`}>{person.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          )}
        </table>
        {!loading && items.length === 0 && <div className="empty">No people match those filters.</div>}
        <div className="pager">
          <span>{total.toLocaleString()} people</span>
          <label className="pager-size">
            Rows per page
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              aria-label="Rows per page"
              disabled={loading}
            >
              {PAGE_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
          <form
            className="pager-jump"
            onSubmit={(event) => {
              event.preventDefault();
              jumpFromDraft();
            }}
          >
            <label>
              Page
              <input
                type="number"
                min={1}
                max={pages}
                value={pageDraft}
                disabled={loading}
                aria-label="Page number"
                onChange={(e) => setPageDraft(e.target.value)}
                onBlur={() => {
                  if (pageDraft !== String(page)) jumpFromDraft();
                }}
              />
            </label>
            <span className="pager-of">of {pages.toLocaleString()}</span>
          </form>
          <span className="pager-nav">
            <button className="btn secondary" disabled={loading || page <= 1} onClick={() => goToPage(1)}>
              First
            </button>
            <button className="btn secondary" disabled={loading || page <= 1} onClick={() => goToPage(page - 1)}>
              Previous
            </button>
            <button className="btn secondary" disabled={loading || page >= pages} onClick={() => goToPage(page + 1)}>
              Next
            </button>
            <button className="btn secondary" disabled={loading || page >= pages} onClick={() => goToPage(pages)}>
              Last
            </button>
          </span>
        </div>
      </div>
    </div>
  );
}

function AddSelect({
  label,
  placeholder,
  options = [],
  selected,
  onAdd,
}: {
  label: string;
  placeholder: string;
  options?: string[];
  selected: string[];
  onAdd: (value: string) => void;
}) {
  const remaining = options.filter((option) => !selected.includes(option));
  return (
    <label>
      {label}
      <select
        value=""
        disabled={remaining.length === 0}
        onChange={(event) => onAdd(event.target.value)}
      >
        <option value="">{remaining.length === 0 ? "All added" : placeholder}</option>
        {remaining.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function ActiveFilters({
  chips,
  onClear,
  onClearAll,
}: {
  chips: FilterChip[];
  onClear: (chip: FilterChip) => void;
  onClearAll: () => void;
}) {
  if (chips.length === 0) return null;

  return (
    <div className="filter-bar" aria-label="Active filters">
      <span className="filter-bar-label">
        {chips.length === 1 ? "Filter" : `${chips.length} filters`}
      </span>
      {chips.map((chip) => (
        <button
          key={chip.id}
          type="button"
          className="filter-chip"
          onClick={() => onClear(chip)}
          aria-label={`Remove ${chip.label} filter ${chip.value}`}
        >
          <span className="filter-chip-key">{chip.label}</span>
          {chip.value}
          <span aria-hidden="true">×</span>
        </button>
      ))}
      {chips.length > 1 && (
        <button type="button" className="filter-clear" onClick={onClearAll}>
          Clear all
        </button>
      )}
    </div>
  );
}
