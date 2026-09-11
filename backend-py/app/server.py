from app.db import create_pool, migrate
from app.http import create_app
from app.repos.pg import PgEmployeeRepository, PgFxRepository, PgSalaryRepository
from app.services.fx import FxService

pool = create_pool()
migrate(pool)
FxService(PgFxRepository(pool)).seed_defaults()

app = create_app(
    PgEmployeeRepository(pool),
    PgSalaryRepository(pool),
    PgFxRepository(pool),
)
