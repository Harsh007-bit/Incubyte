export function queryValues(value: unknown): string[] {
  const raw = Array.isArray(value) ? value : value == null ? [] : [value];
  const unique: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    for (const piece of item.split(",")) {
      const trimmed = piece.trim();
      if (trimmed && !unique.some((existing) => existing.toLowerCase() === trimmed.toLowerCase())) {
        unique.push(trimmed);
      }
    }
  }
  return unique;
}

function firstString(value: unknown): string | undefined {
  if (Array.isArray(value)) return firstString(value[0]);
  return typeof value === "string" ? value : undefined;
}

export function queryParam(
  req: { query: Record<string, unknown>; url?: string; originalUrl?: string },
  key: string,
): string | undefined {
  const raw = req.originalUrl ?? req.url ?? "";
  const q = raw.includes("?") ? raw.slice(raw.indexOf("?") + 1) : "";
  if (q) {
    const fromUrl = new URLSearchParams(q).get(key);
    if (fromUrl) return fromUrl;
  }
  return firstString(req.query[key]);
}
