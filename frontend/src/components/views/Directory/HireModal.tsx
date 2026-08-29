import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";

import { api } from "../../../api";
import { useSnackBar } from "../../SnackBar/SnackBarContext";
import { SnackBarVariant } from "../../SnackBar/SnackbarWrapper";
import type { Meta } from "../../../models/types";

const SAMPLE_CSV = `name,email,country_code,department,designation
Priya Shah,csv.priya.shah@acme.test,IN,Engineering,Software Engineer
James Chen,csv.james.chen@acme.test,US,Product,Product Manager
`;

type Tab = "one" | "csv";

type ImportError = { line: number; detail: string };

export function HireModal({
  meta,
  onClose,
  onHired,
}: {
  meta: Meta | null;
  onClose: () => void;
  onHired: () => void;
}) {
  const [tab, setTab] = useState<Tab>("one");
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [csv, setCsv] = useState("");
  const [importing, setImporting] = useState(false);
  const [created, setCreated] = useState<number | null>(null);
  const [rowErrors, setRowErrors] = useState<ImportError[]>([]);
  const snackbar = useSnackBar();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onCloseRef.current();
    }
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, []);

  async function onHire(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      setError(null);
      await api.createEmployee({
        name: String(form.get("name")),
        email: String(form.get("email")),
        country_code: String(form.get("country_code")),
        department: String(form.get("department")),
        designation: String(form.get("designation")),
      });
      snackbar({ message: "Person added", variant: SnackBarVariant.SUCCESS });
      onHired();
      onClose();
    } catch (err) {
      const message = (err as Error).message;
      setError(message);
      snackbar({ message, variant: SnackBarVariant.ERROR });
    }
  }

  function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setCreated(null);
    setRowErrors([]);
    setError(null);
    const reader = new FileReader();
    reader.onload = () => setCsv(String(reader.result ?? ""));
    reader.readAsText(file);
  }

  async function onImport() {
    if (!csv.trim()) {
      const message = "Choose a CSV file first";
      setError(message);
      snackbar({ message, variant: SnackBarVariant.ERROR });
      return;
    }
    try {
      setImporting(true);
      setError(null);
      const result = await api.importEmployees(csv);
      setCreated(result.created);
      setRowErrors(result.errors);
      if (result.created > 0) onHired();
      if (result.errors.length === 0) {
        snackbar({
          message: `Created ${result.created} ${result.created === 1 ? "person" : "people"}`,
          variant: SnackBarVariant.SUCCESS,
        });
        onClose();
      } else {
        snackbar({
          message: `Created ${result.created}, ${result.errors.length} row${result.errors.length === 1 ? "" : "s"} failed`,
          variant: SnackBarVariant.ERROR,
        });
      }
    } catch (err) {
      const message = (err as Error).message;
      setError(message);
      snackbar({ message, variant: SnackBarVariant.ERROR });
    } finally {
      setImporting(false);
    }
  }

  function downloadSample() {
    const blob = new Blob([SAMPLE_CSV], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "employees-sample.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="hire-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-head">
          <h2 id="hire-title">Add people</h2>
          <button type="button" className="modal-close" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="modal-tabs" role="tablist">
          <button
            type="button"
            className={`tab ${tab === "one" ? "active" : ""}`}
            role="tab"
            aria-selected={tab === "one"}
            onClick={() => setTab("one")}
          >
            One person
          </button>
          <button
            type="button"
            className={`tab ${tab === "csv" ? "active" : ""}`}
            role="tab"
            aria-selected={tab === "csv"}
            onClick={() => setTab("csv")}
          >
            CSV upload
          </button>
        </div>
        <div className="modal-body">
          {error && <p className="error">{error}</p>}
          {tab === "one" && (
            <form className="form-grid" onSubmit={onHire}>
              <label>
                Name
                <input name="name" required autoFocus />
              </label>
              <label>
                Email
                <input name="email" type="email" required />
              </label>
              <label>
                Country
                <select name="country_code" defaultValue="IN" disabled={!meta}>
                  {(meta?.country_codes ?? ["IN"]).map((code) => (
                    <option key={code}>{code}</option>
                  ))}
                </select>
              </label>
              <label>
                Department
                <select name="department" disabled={!meta}>
                  {(meta?.departments ?? ["Engineering"]).map((name) => (
                    <option key={name}>{name}</option>
                  ))}
                </select>
              </label>
              <label>
                Designation
                <input name="designation" required />
              </label>
              <button className="btn" type="submit" disabled={!meta}>
                Create without salary
              </button>
              <button className="btn secondary" type="button" onClick={onClose}>
                Cancel
              </button>
            </form>
          )}
          {tab === "csv" && (
            <div className="csv-panel">
              <p className="lede" style={{ marginBottom: 12 }}>
                Upload a CSV with columns <code>name, email, country_code, department, designation</code>.
                Optional: <code>employee_code</code>. Up to 500 people. Invalid rows are skipped.
              </p>
              <div className="csv-actions">
                <label className="file-pick">
                  Choose CSV
                  <input type="file" accept=".csv,text/csv" onChange={onFile} />
                </label>
                <button type="button" className="btn secondary" onClick={downloadSample}>
                  Download sample
                </button>
                <button type="button" className="btn" disabled={importing || !csv} onClick={() => void onImport()}>
                  {importing ? "Uploading…" : "Upload and create"}
                </button>
              </div>
              {fileName && <p className="file-name">{fileName}</p>}
              {created !== null && (
                <p className={rowErrors.length ? "error" : "lede"}>
                  Created {created} {created === 1 ? "person" : "people"}
                  {rowErrors.length > 0 ? `, ${rowErrors.length} row${rowErrors.length === 1 ? "" : "s"} failed` : ""}.
                </p>
              )}
              {rowErrors.length > 0 && (
                <ul className="import-errors">
                  {rowErrors.map((row) => (
                    <li key={row.line}>
                      Line {row.line}: {row.detail}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
