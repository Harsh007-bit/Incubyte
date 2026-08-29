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
