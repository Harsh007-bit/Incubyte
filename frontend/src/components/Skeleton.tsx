export function Skeleton({ className = "" }: { className?: string }) {
  return <span className={`skel ${className}`} aria-hidden="true" />;
}

export function TableSkeleton({ rows = 8, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <tbody>
      {Array.from({ length: rows }, (_, row) => (
        <tr key={row} className="skel-row">
          {Array.from({ length: cols }, (_, col) => (
            <td key={col}>
              <Skeleton className={col === 1 ? "skel-wide" : "skel-mid"} />
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  );
}
