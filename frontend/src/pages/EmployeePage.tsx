import { FormEvent, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { api } from "../api";
import { formatMoney } from "../money";
import type { Employee, Meta, Salary } from "../types";

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
    api.meta().then(setMeta);
    refresh().catch((err: Error) => setError(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function onSalary(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!id) return;
    const form = new FormData(event.currentTarget);
    try {
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
    try {
      await api.updateEmployee(person.id, {
        status: person.status === "active" ? "inactive" : "active",
      });
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  if (!person) {
    return <p className="lede">{error ?? "Loading…"}</p>;
  }

  return (
    <div>
      <p>
        <Link to="/">← Directory</Link>
      </p>
      <h1>{person.name}</h1>
      <p className="lede">
        {person.employee_code} · {person.designation} · {person.department} · {person.country_code}
      </p>
      {error && <p className="error">{error}</p>}

      <div className="profile">
        <section className="card">
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
          <h2>Adjust salary</h2>
          <p className="lede">Appends a new record. Same effective_from is rejected.</p>
          <form className="form-grid" onSubmit={onSalary} style={{ flexDirection: "column", alignItems: "stretch" }}>
            <label>
              Amount
              <input name="base_amount" type="number" min="1" step="0.01" required />
            </label>
            <label>
              Currency
              <select name="currency" defaultValue="INR">
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
