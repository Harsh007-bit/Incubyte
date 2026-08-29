import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { api } from "../api";
import { formatMoney } from "../money";
import type { Employee, Meta } from "../types";

export function Directory() {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [items, setItems] = useState<Employee[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [country, setCountry] = useState("");
  const [department, setDepartment] = useState("");
  const [status, setStatus] = useState("active");
  const [error, setError] = useState<string | null>(null);
  const [hiring, setHiring] = useState(false);

  async function load(nextPage = page) {
    const result = await api.employees({ q, country, department, status, page: nextPage });
    setItems(result.items);
    setTotal(result.total);
    setPage(result.page);
  }

  useEffect(() => {
    api.meta().then(setMeta).catch((err: Error) => setError(err.message));
  }, []);

  useEffect(() => {
    load(1).catch((err: Error) => setError(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [country, department, status]);

  async function onSearch(event: FormEvent) {
    event.preventDefault();
    try {
      await load(1);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function onHire(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await api.createEmployee({
        name: String(form.get("name")),
        email: String(form.get("email")),
        country_code: String(form.get("country_code")),
        department: String(form.get("department")),
        designation: String(form.get("designation")),
      });
      setHiring(false);
      await load(1);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  const pages = Math.max(1, Math.ceil(total / 25));

  return (
    <div>
      <h1>People</h1>
      <p className="lede">
        Search the 10,000-person directory. Compensation is optional at hire — you can
        add pay later.
      </p>
      {error && <p className="error">{error}</p>}

      <form className="toolbar" onSubmit={onSearch}>
        <label>
          Search
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name" />
        </label>
        <label>
          Country
          <select value={country} onChange={(e) => setCountry(e.target.value)}>
            <option value="">All</option>
            {meta?.country_codes.map((code) => (
              <option key={code}>{code}</option>
            ))}
          </select>
        </label>
        <label>
          Department
          <select value={department} onChange={(e) => setDepartment(e.target.value)}>
            <option value="">All</option>
            {meta?.departments.map((name) => (
              <option key={name}>{name}</option>
            ))}
          </select>
        </label>
        <label>
          Status
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All</option>
            <option value="active">active</option>
            <option value="inactive">inactive</option>
          </select>
        </label>
        <button className="btn" type="submit">
          Find
        </button>
        <button className="btn secondary" type="button" onClick={() => setHiring((v) => !v)}>
          Add person
        </button>
      </form>

      {hiring && meta && (
        <form className="card form-grid" style={{ padding: 16, marginBottom: 16 }} onSubmit={onHire}>
          <label>
            Name
            <input name="name" required />
          </label>
          <label>
            Email
            <input name="email" type="email" required />
          </label>
          <label>
            Country
            <select name="country_code" defaultValue="IN">
              {meta.country_codes.map((code) => (
                <option key={code}>{code}</option>
              ))}
            </select>
          </label>
          <label>
            Department
            <select name="department">
              {meta.departments.map((name) => (
                <option key={name}>{name}</option>
              ))}
            </select>
          </label>
          <label>
            Designation
            <input name="designation" required />
          </label>
          <button className="btn" type="submit">
            Create without salary
          </button>
        </form>
      )}

      <div className="card">
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
        </table>
        {items.length === 0 && <div className="empty">No people match those filters.</div>}
        <div className="pager">
          <span>
            {total} people · page {page} of {pages}
          </span>
          <span>
            <button className="btn secondary" disabled={page <= 1} onClick={() => load(page - 1)}>
              Previous
            </button>{" "}
            <button className="btn secondary" disabled={page >= pages} onClick={() => load(page + 1)}>
              Next
            </button>
          </span>
        </div>
      </div>
    </div>
  );
}
