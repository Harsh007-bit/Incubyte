import { FormEvent, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { api } from "../../../api";
import { Skeleton } from "../../Skeleton";
import { useSnackBar } from "../../SnackBar/SnackBarContext";
import { SnackBarVariant } from "../../SnackBar/SnackbarWrapper";
import { formatMoney } from "../../../utils/money";
import type { Employee, Meta, Salary } from "../../../models/types";

export function EmployeePage() {
  const { id: employeeId } = useParams<{ id: string }>();
  const snackbar = useSnackBar();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [salaryHistory, setSalaryHistory] = useState<Salary[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  async function refresh() {
    if (!employeeId) return;
    const [detail, rows] = await Promise.all([
      api.getEmployee(employeeId),
      api.listSalaryHistory(employeeId),
    ]);
    setEmployee(detail);
    setSalaryHistory(rows);
  }

  useEffect(() => {
    api.getMeta().then(setMeta).catch((err: Error) =>
      snackbar({ message: err.message, variant: SnackBarVariant.ERROR }),
    );
    refresh().catch((err: Error) => setLoadError(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId]);

  async function onProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!employee) return;
    const form = new FormData(event.currentTarget);
    try {
      await api.updateEmployee(employee.id, {
        name: String(form.get("name")),
        email: String(form.get("email")),
        country_code: String(form.get("country_code")),
        department: String(form.get("department")),
        designation: String(form.get("designation")),
      });
      await refresh();
      snackbar({ message: "Profile saved", variant: SnackBarVariant.SUCCESS });
    } catch (err) {
      snackbar({ message: (err as Error).message, variant: SnackBarVariant.ERROR });
    }
  }

  async function onSalary(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!employee) return;
    const formEl = event.currentTarget;
    const form = new FormData(formEl);
    try {
      await api.addSalary(employee.id, {
        base_amount: String(form.get("base_amount")),
        currency: String(form.get("currency")),
        effective_from: String(form.get("effective_from")),
        reason: String(form.get("reason")),
      });
      formEl.reset();
      await refresh();
      snackbar({ message: "Salary record added", variant: SnackBarVariant.SUCCESS });
    } catch (err) {
      snackbar({ message: (err as Error).message, variant: SnackBarVariant.ERROR });
    }
  }

  async function toggleStatus() {
    if (!employee) return;
    const next = employee.status === "active" ? "inactive" : "active";
    if (!window.confirm(`Mark ${employee.name} as ${next}?`)) return;
    try {
      await api.updateEmployee(employee.id, { status: next });
      await refresh();
      snackbar({ message: `Marked ${next}`, variant: SnackBarVariant.SUCCESS });
    } catch (err) {
      snackbar({ message: (err as Error).message, variant: SnackBarVariant.ERROR });
    }
  }

  if (!employee) {
    if (loadError) return <p className="error">{loadError}</p>;
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
      <h1>{employee.name}</h1>
      <p className="lede">
        {employee.employee_code} · {employee.email} · {employee.designation} · {employee.department} ·{" "}
        {employee.country_code}
      </p>

      <div className="profile">
        <section className="card profile-pay">
          <h2>Current pay</h2>
          {employee.current_salary ? (
            <>
              <p className="money">
                {formatMoney(employee.current_salary.base_amount, employee.current_salary.currency)}
              </p>
              <p className="lede">Effective {employee.current_salary.effective_from}</p>
            </>
          ) : (
            <p className="lede">No salary recorded yet.</p>
          )}
          <p>
            <span className={`pill ${employee.status}`}>{employee.status}</span>{" "}
            <button className="btn secondary" type="button" onClick={toggleStatus}>
              Mark {employee.status === "active" ? "inactive" : "active"}
            </button>
          </p>
          <h2>History</h2>
          <ol className="history">
            {salaryHistory.map((row) => (
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
            key={employee.updated_at}
          >
            <label>
              Name
              <input name="name" defaultValue={employee.name} required />
            </label>
            <label>
              Email
              <input name="email" type="email" defaultValue={employee.email} required />
            </label>
            <label>
              Country
              <select name="country_code" defaultValue={employee.country_code}>
                {meta?.country_codes.map((code) => (
                  <option key={code}>{code}</option>
                ))}
              </select>
            </label>
            <label>
              Department
              <select name="department" defaultValue={employee.department}>
                {meta?.departments.map((name) => (
                  <option key={name}>{name}</option>
                ))}
              </select>
            </label>
            <label>
              Designation
              <input name="designation" defaultValue={employee.designation} required />
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
              <select name="currency" defaultValue={employee.current_salary?.currency ?? "INR"}>
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
