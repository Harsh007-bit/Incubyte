import { useEffect, useState } from "react";

import { api } from "../api";
import { formatUsd } from "../money";
import type { AvgRow, HeadcountRow, SpendRow } from "../types";

export function Insights() {
  const [groupBy, setGroupBy] = useState("country");
  const [headcount, setHeadcount] = useState<HeadcountRow[]>([]);
  const [spend, setSpend] = useState<SpendRow[]>([]);
  const [avg, setAvg] = useState<AvgRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.headcount(groupBy), api.spend(groupBy), api.avgSalary(groupBy)])
      .then(([h, s, a]) => {
        setHeadcount(h);
        setSpend(s);
        setAvg(a);
      })
      .catch((err: Error) => setError(err.message));
  }, [groupBy]);

  const people = headcount.reduce((sum, row) => sum + row.headcount, 0);
  const totalSpend = spend.reduce((sum, row) => sum + Number(row.spend_usd), 0);
  const maxSpend = Math.max(...spend.map((row) => Number(row.spend_usd)), 1);

  return (
    <div>
      <h1>How we pay people</h1>
      <p className="lede">
        Live totals in USD at the current rate. Inactive people drop out of spend.
        People without a salary stay in headcount.
      </p>
      {error && <p className="error">{error}</p>}

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
          <strong>{people.toLocaleString()}</strong>
        </div>
        <div className="card metric">
          Current spend (USD)
          <strong>{formatUsd(String(totalSpend))}</strong>
        </div>
        <div className="card metric">
          Groups
          <strong>{headcount.length}</strong>
        </div>
      </div>

      <div className="card" style={{ padding: 20 }}>
        <h2>Spend by {groupBy}</h2>
        {spend.map((row) => (
          <div className="bar-row" key={row.group}>
            <span>{row.group}</span>
            <div className="bar">
              <i style={{ width: `${(Number(row.spend_usd) / maxSpend) * 100}%` }} />
            </div>
            <span className="mono">{formatUsd(row.spend_usd)}</span>
          </div>
        ))}
      </div>

      <div className="card" style={{ padding: 20, marginTop: 20 }}>
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
        </table>
      </div>
    </div>
  );
}
