from __future__ import annotations

from datetime import date, datetime
from zoneinfo import ZoneInfo

from app.config import config


def calendar_date_today(time_zone: str | None = None) -> str:
    tz = ZoneInfo(time_zone or config.tz)
    return datetime.now(tz).date().isoformat()


def is_calendar_date(value: str) -> bool:
    if len(value) != 10 or value[4] != "-" or value[7] != "-":
        return False
    try:
        year = int(value[0:4])
        month = int(value[5:7])
        day = int(value[8:10])
        parsed = date(year, month, day)
    except ValueError:
        return False
    return parsed.year == year and parsed.month == month and parsed.day == day
