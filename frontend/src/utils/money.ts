export function formatMoney(amount: string, currency: string): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
  }).format(Number(amount));
}

export function sumUsd(amounts: string[]): string {
  const cents = amounts.reduce((sum, amount) => sum + Math.round(Number(amount) * 100), 0);
  return (cents / 100).toFixed(2);
}

export function formatUsd(amount: string | null): string {
  if (amount === null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number(amount));
}
