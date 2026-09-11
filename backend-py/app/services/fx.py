from __future__ import annotations

from datetime import datetime, timezone
from decimal import ROUND_HALF_UP, Decimal

from app.constants import DEFAULT_RATES, SUPPORTED_CURRENCIES
from app.errors import DomainError
from app.models import ExchangeRate
from app.repos import FxRepository


class FxService:
    def __init__(self, rates: FxRepository):
        self.rates = rates

    def get_rate_table(self) -> dict[str, Decimal]:
        table = {row.currency: row.rate_to_usd for row in self.rates.list()}
        if not table:
            raise DomainError("exchange rates have not been seeded")
        return table

    def to_usd(self, amount: Decimal, currency: str, table: dict[str, Decimal]) -> Decimal:
        rate = table.get(currency)
        if rate is None:
            raise DomainError(f"no exchange rate for {currency}")
        return (amount * rate).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    def seed_defaults(self, updated_at: datetime | None = None) -> None:
        if self.rates.list():
            return
        when = updated_at or datetime.now(timezone.utc)
        for currency in SUPPORTED_CURRENCIES:
            self.rates.upsert(
                ExchangeRate(
                    currency=currency,
                    rate_to_usd=Decimal(DEFAULT_RATES[currency]),
                    updated_at=when,
                )
            )
