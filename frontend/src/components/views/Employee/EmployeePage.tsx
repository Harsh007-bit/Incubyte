import { FormEvent, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { api } from "../../../api";
import { Skeleton } from "../../Skeleton";
import { formatMoney } from "../../../utils/money";
import type { Employee, Meta, Salary } from "../../../models/types";

export function EmployeePage() {
  const { id } = useParams<{ id: string }>();
  const [person, setPerson] = useState<Employee | null>(null);
  const [history, setHistory] = useState<Salary[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    if (!id) return;
    const [detail, rows] = await Promise.all([api.employee(id), api.history(id)]);
    setPerson(detail);
    setHistory(rows);
  }

  useEffect(() => {
    api.meta().then(setMeta).catch((err: Error) => setError(err.message));
    refresh().catch((err: Error) => setError(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function onProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!person) return;
    const form = new FormData(event.currentTarget);
    try {
      setError(null);
      await api.updateEmployee(person.id, {
        name: String(form.get("name")),
        email: String(form.get("email")),
        country_code: String(form.get("country_code")),
        department: String(form.get("department")),
        designation: String(form.get("designation")),
      });
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function onSalary(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!id) return;
    const form = new FormData(event.currentTarget);
    try {
      setError(null);
      await api.addSalary(id, {
        base_amount: String(form.get("base_amount")),
        currency: String(form.get("currency")),
        effective_from: String(form.get("effective_from")),
        reason: String(form.get("reason")),
      });
      event.currentTarget.reset();
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function toggleStatus() {
    if (!person) return;
    const next = person.status === "active" ? "inactive" : "active";
    if (!window.confirm(`Mark ${person.name} as ${next}?`)) return;
    try {
      setError(null);
      await api.updateEmployee(person.id, { status: next });
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  if (!person) {
    if (error) return <p className="error">{error}</p>;
    return (
      <div aria-busy="true">
        <p>
          <Link to="/">← Directory</Link>
        </p>
        <Skeleton className="skel-lg" />
        <p className="lede">
          <Skeleton className="skel-wide" />
        </p>
        <div className="profile">
          <section className="card profile-pay">
            <h2>Current pay</h2>
            <Skeleton className="skel-lg" />
            <Skeleton className="skel-mid" />
            <h2>History</h2>
            <Skeleton className="skel-wide" />
            <Skeleton className="skel-mid" />
            <Skeleton className="skel-wide" />
          </section>
          <section className="card">
            <h2>Profile</h2>
            <Skeleton className="skel-wide" />
            <Skeleton className="skel-mid" />
            <Skeleton className="skel-wide" />
          </section>
        </div>
      </div>
    );
  }

  return (
    <div>
      <p>
        <Link to="/">← Directory</Link>
      </p>
      <h1>{person.name}</h1>
      <p className="lede">
        {person.employee_code} · {person.email} · {person.designation} · {person.department} ·{" "}
        {person.country_code}
      </p>
      {error && <p className="error">{error}</p>}

      <div className="profile">
        <section className="card profile-pay">
          <h2>Current pay</h2>
          {person.current_salary ? (
            <>
              <p className="money">
                {formatMoney(person.current_salary.base_amount, person.current_salary.currency)}
              </p>
              <p className="lede">Effective {person.current_salary.effective_from}</p>
            </>
          ) : (
            <p className="lede">No salary recorded yet.</p>
          )}
          <p>
            <span className={`pill ${person.status}`}>{person.status}</span>{" "}
            <button className="btn secondary" type="button" onClick={toggleStatus}>
              Mark {person.status === "active" ? "inactive" : "active"}
            </button>
          </p>
          <h2>History</h2>
          <ol className="history">
            {history.map((row) => (
              <li key={row.id}>
                <span className="mono">{row.effective_from}</span>
                <div>
                  <strong>{formatMoney(row.base_amount, row.currency)}</strong>
                  <div className="lede">{row.reason}</div>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="card">
          <h2>Profile</h2>
          <p className="lede">Name, email, country, department, and designation.</p>
          <form
            className="form-grid"
            onSubmit={onProfile}
            style={{ flexDirection: "column", alignItems: "stretch" }}
            key={person.updated_at}
          >
            <label>
              Name
              <input name="name" defaultValue={person.name} required />
            </label>
            <label>
              Email
              <input name="email" type="email" defaultValue={person.email} required />
            </label>
            <label>
              Country
              <select name="country_code" defaultValue={person.country_code}>
                {meta?.country_codes.map((code) => (
                  <option key={code}>{code}</option>
                ))}
              </select>
            </label>
            <label>
              Department
              <select name="department" defaultValue={person.department}>
                {meta?.departments.map((name) => (
                  <option key={name}>{name}</option>
                ))}
              </select>
            </label>
            <label>
              Designation
              <input name="designation" defaultValue={person.designation} required />
            </label>
            <button className="btn" type="submit">
              Save profile
            </button>
          </form>
        </section>

        <section className="card">
          <h2>Adjust salary</h2>
          <p className="lede">Appends a new record. Same effective_from is rejected.</p>
          <form className="form-grid" onSubmit={onSalary} style={{ flexDirection: "column", alignItems: "stretch" }}>
            <label>
              Amount
              <input name="base_amount" type="number" min="0.01" step="0.01" required />
            </label>
            <label>
              Currency
              <select name="currency" defaultValue={person.current_salary?.currency ?? "INR"}>
                {meta?.currencies.map((code) => (
                  <option key={code}>{code}</option>
                ))}
              </select>
            </label>
            <label>
              effective_from
              <input name="effective_from" type="date" required />
            </label>
            <label>
              Reason
              <input name="reason" required minLength={1} />
            </label>
            <button className="btn" type="submit">
              Add salary record
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
