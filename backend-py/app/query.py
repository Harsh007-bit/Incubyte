from __future__ import annotations


def query_values(value: str | list[str] | None) -> list[str]:
    if value is None:
        return []
    raw = value if isinstance(value, list) else [value]
    unique: list[str] = []
    for item in raw:
        if not isinstance(item, str):
            continue
        for piece in item.split(","):
            trimmed = piece.strip()
            if trimmed and not any(existing.lower() == trimmed.lower() for existing in unique):
                unique.append(trimmed)
    return unique


def parse_positive_int(value: str | None, fallback: int, maximum: int = 2**53 - 1) -> int:
    if value is None:
        return fallback
    try:
        n = int(value)
    except (TypeError, ValueError):
        return fallback
    if n < 1:
        return fallback
    return min(maximum, n)
