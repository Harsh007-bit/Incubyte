import { useEffect, useState } from "react";

import { api } from "../../../api";
import { Skeleton, TableSkeleton } from "../../Skeleton";
import { useSnackBar } from "../../SnackBar/SnackBarContext";
import { SnackBarVariant } from "../../SnackBar/SnackbarWrapper";
import { formatUsd, sumUsd } from "../../../utils/money";
import type { AvgRow, HeadcountRow, SpendRow } from "../../../models/types";

export function Insights() {
  const snackbar = useSnackBar();
  const [groupBy, setGroupBy] = useState("country");
  const [headcount, setHeadcount] = useState<HeadcountRow[]>([]);
  const [spend, setSpend] = useState<SpendRow[]>([]);
  const [avg, setAvg] = useState<AvgRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([api.getHeadcount(groupBy), api.getSpend(groupBy), api.getAvgSalary(groupBy)])
      .then(([h, s, a]) => {
        if (cancelled) return;
        setHeadcount(h);
        setSpend(s);
        setAvg(a);
      })
      .catch((err: Error) => {
        if (!cancelled) snackbar({ message: err.message, variant: SnackBarVariant.ERROR });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [groupBy, snackbar]);

  const people = headcount.reduce((sum, row) => sum + row.headcount, 0);
  const totalSpend = sumUsd(spend.map((row) => row.spend_usd));
  const maxSpend = Math.max(...spend.map((row) => Number(row.spend_usd)), 1);

  return (
    <div>
      <h1>How we pay people</h1>
      <p className="lede">
        Live totals in USD at the current rate. Inactive people drop out of spend.
        People without a salary stay in headcount.
      </p>

      <div className="toolbar">
        <label>
          Group by
          <select value={groupBy} onChange={(e) => setGroupBy(e.target.value)}>
            <option value="country">country</option>
            <option value="department">department</option>
          </select>
        </label>
      </div>

      <div className="metrics">
        <div className="card metric">
          Active headcount
          {loading ? <Skeleton className="skel-metric" /> : <strong>{people.toLocaleString()}</strong>}
        </div>
        <div className="card metric">
          Current spend (USD)
          {loading ? <Skeleton className="skel-metric" /> : <strong>{formatUsd(totalSpend)}</strong>}
        </div>
        <div className="card metric">
          Groups
          {loading ? <Skeleton className="skel-metric" /> : <strong>{headcount.length}</strong>}
        </div>
      </div>

      <div className="card" style={{ padding: 20 }} aria-busy={loading}>
        <h2>Spend by {groupBy}</h2>
        {loading
          ? Array.from({ length: 6 }, (_, i) => (
              <div className="bar-row" key={i}>
                <Skeleton className="skel-mid" />
                <div className="bar" />
                <Skeleton className="skel-mid" />
              </div>
            ))
          : spend.map((row) => (
              <div className="bar-row" key={row.group}>
                <span>{row.group}</span>
                <div className="bar">
                  <i style={{ width: `${(Number(row.spend_usd) / maxSpend) * 100}%` }} />
                </div>
                <span className="mono">{formatUsd(row.spend_usd)}</span>
              </div>
            ))}
      </div>

      <div className="card" style={{ padding: 20, marginTop: 20 }} aria-busy={loading}>
        <h2>Average salary (USD)</h2>
        <table>
          <thead>
            <tr>
              <th>{groupBy}</th>
              <th>Headcount</th>
              <th>Paid</th>
              <th>Average</th>
            </tr>
          </thead>
          {loading ? (
            <TableSkeleton rows={6} cols={4} />
          ) : (
            <tbody>
              {avg.map((row) => (
                <tr key={row.group}>
                  <td>{row.group}</td>
                  <td>{row.headcount}</td>
                  <td>{row.paid_headcount}</td>
                  <td>{formatUsd(row.avg_salary_usd)}</td>
                </tr>
              ))}
            </tbody>
          )}
        </table>
      </div>
    </div>
  );
}
