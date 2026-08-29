ACME SALARY MANAGEMENT — ARCHITECTURE & DESIGN NOTES
=======================================================

Companion to the PRD. Covers system design, schema, and the reasoning
behind non-obvious decisions — the kind of detail that doesn't belong in
a requirements doc but matters when building or defending the design.

1. HIGH-LEVEL ARCHITECTURE
-----------------------------

  React + TypeScript SPA
          |
          v
  Node.js + TypeScript (Express)
          |
          v
  PostgreSQL

Modular monolith. No caching layer, no background workers, no separate
analytics store — see PRD's "Deliberately Out of Scope" for why.

Domain logic (salary rules, aggregation logic) is kept independent of
the persistence layer so PostgreSQL is a delivery choice, not
something the salary rules know about.

Backend internal structure follows a layered boundary rather than a flat
routes file, so business rules are easy to unit-test in isolation from
HTTP and the database:

  HTTP (routes)
      -> Application/service layer
      -> Domain/business rules
      -> Persistence (repository)

Example flow:

  POST /employees/{id}/salary
      -> SalaryService.add_salary(...)
      -> validate business rules (amount > 0, unique effective_from, ...)
      -> SalaryRepository.create(...)
      -> PostgreSQL

Suggested module layout (created as needed, not for aesthetics):

  backend/src/
    employees/   routes, service, repository
    salaries/    routes, service, repository
    analytics/   routes, service
    fx/          service
    shared/      db, constants, errors

2. DATABASE SCHEMA
---------------------

employees
  id                 UUID PK
  employee_code      TEXT UNIQUE NOT NULL
  name               TEXT NOT NULL
  email              TEXT NOT NULL
  country_code       TEXT NOT NULL
  department         TEXT NOT NULL
  designation        TEXT NOT NULL
  status             TEXT NOT NULL
                         CHECK (status IN ('active', 'inactive'))
  created_at         TIMESTAMP NOT NULL
  updated_at         TIMESTAMP NOT NULL

  UNIQUE INDEX idx_employees_email ON LOWER(email)

salary_records
  id                 UUID PK
  employee_id        UUID FK NOT NULL -> employees.id
  base_amount        DECIMAL(12,2) NOT NULL
                         CHECK (base_amount > 0)
  currency           TEXT NOT NULL
  effective_from     DATE NOT NULL
  reason             TEXT NOT NULL
                         CHECK (length(trim(reason)) > 0)
  created_at         TIMESTAMP NOT NULL

  UNIQUE(employee_id, effective_from)

exchange_rates
  currency           TEXT PRIMARY KEY
  rate_to_usd        DECIMAL(12,6) NOT NULL
  updated_at         TIMESTAMP NOT NULL

Notes on the schema:

- Salary history is append-only: a new compensation change inserts a new
  salary_records row rather than updating an existing one.
- UNIQUE(employee_id, effective_from) is a deliberate invariant: without
  it, two salary records could share the same effective date and
  "current salary" would be ambiguous. With it, current salary is a
  simple, deterministic query (see section 4.2). That UNIQUE constraint
  already creates an index — I am not adding a second one on the same
  columns.
- Email uniqueness is case-insensitive (LOWER(email)). ada@acme.com and
  Ada@acme.com are the same person to HR.
- CHECK constraints sit under the API. Zod can be skipped or wrong;
  Postgres still refuses a zero salary or an empty reason.
- "Current salary" is derived at query time, not stored as a separate
  mutable flag — this avoids a second source of truth that could drift
  out of sync with the actual latest record.
- PostgreSQL has native UUID and DECIMAL types. That is one reason I
  switched off SQLite — see section 4.4.

3. API DESIGN (representative)
---------------------------------

  GET  /employees?country=IN&department=Engineering&status=active&page=1
  GET  /employees/{id}
  POST /employees
  PATCH /employees/{id}
  GET  /employees/{id}/salary-history
  POST /employees/{id}/salary            -- appends a new salary_records row

  GET  /analytics/headcount?groupBy=country
  GET  /analytics/avg-salary?groupBy=department
  GET  /analytics/spend?groupBy=country

All /analytics/* endpoints run live aggregation queries against
PostgreSQL. At 10,000 rows with proper indexing, this is fast enough
that a caching layer would add complexity without a measurable benefit.

4. DESIGN DECISIONS
-----------------------

4.1 Currency conversion: a fixed table, current rate at query time

The MVP uses a fixed exchange-rate table. One row per currency. Reports
use the currently configured rate at query time. Salary records keep
their original amount and currency. Historical report reconstruction
("what did this dashboard show on July 15") is out of scope.

  currency     rate_to_usd
  USD          1.000000
  INR          0.012000
  EUR          1.080000
  GBP          1.270000

I am not versioning rates. A versioned table with set_at / "latest
active" implies an active flag or an effective date I would then have
to explain and test. The assignment does not ask for historical
financial reporting, so that complexity is not earned.

Why query-time conversion, not a stored USD column:
  - The PRD frames USD as comparison and reporting, not books.
  - Converting on the salary's effective date would make two identical
    Rs.10L salaries look different in USD just because FX moved.
  - One current rate is easy to explain: "this is what they earn now,
    in USD terms."

4.2 Duplicate effective dates and deterministic "current salary"

An employee could otherwise end up with two salary records sharing the
same effective_from (e.g. two Rs.15L entries both dated 2026-07-01),
making "current salary" ambiguous — which one wins?

Decision: enforce UNIQUE(employee_id, effective_from) at the database
level. Attempting to add a second salary record for a date that already
has one is rejected.

With that invariant in place, current salary becomes a simple,
deterministic query:

  SELECT * FROM salary_records
  WHERE employee_id = ? AND effective_from <= today
  ORDER BY effective_from DESC
  LIMIT 1

4.3 Salary history is not an audit trail

salary_records stores employee_id, amount, currency, effective_from,
reason, and created_at. It does not store who made the change
(changed_by) — and since authentication is explicitly out of scope,
actor identity isn't available to capture even if we wanted to.

So: salary history provides an immutable record of compensation
changes (what changed, and when it took effect) — it is not a full
audit trail. A full audit trail, including actor identity and request
metadata, is out of scope for the MVP and depends on authentication
being added first.

4.4 Why UUIDs instead of integer IDs

PostgreSQL has a native UUID type, so identifiers are stored as UUID,
not as a string workaround.

"UUIDs were chosen because the identifier isn't intended to encode
ordering and it avoids coupling identifiers to database-generated
sequences. For a 10,000-row application, the performance difference
versus integer IDs is irrelevant. If simplicity were the priority,
integer IDs would also be a perfectly reasonable choice."

4.5 Employees without a salary record

An employee can be created without an initial salary record — hiring an
employee and setting their compensation are not required to be a single
atomic step. POST /employees creates the employee; POST
/employees/{id}/salary sets compensation, at the same time or later.

Consequence: such employees are included in headcount (they exist and
are active) but excluded from average salary and spend calculations
(there's no amount to include). This is stated explicitly so it isn't
left as an implicit assumption in the aggregation logic.

5. INDEXING
--------------

  CREATE INDEX idx_employees_country ON employees(country_code);
  CREATE INDEX idx_employees_dept ON employees(department);
  CREATE INDEX idx_employees_status ON employees(status);
  CREATE UNIQUE INDEX idx_employees_email ON employees (LOWER(email));

No extra index on salary_records(employee_id, effective_from).
UNIQUE(employee_id, effective_from) already is that index.

These filter indexes matter more as a demonstration of scale-awareness
than as a real necessity at 10K rows — noted here so the reasoning is
explicit rather than assumed.

6. TESTING PHILOSOPHY
-------------------------

Not chasing an arbitrary coverage number. About 15–25 good tests is
enough. Split by what they can actually prove:

  Unit tests (fast, in-memory / domain)
    amount > 0, currency supported, reason required
    current-salary selection (including future-dated rows)
    inactive employees drop out of spend
    analytics math
    hire without salary

  Integration tests (real PostgreSQL + pg + Supertest)
    schema, FK, CHECK constraints
    UNIQUE(employee_id, effective_from) — a fake repo cannot prove this
    case-insensitive unique email
    salary insert + employee retrieval + analytics SQL

An in-memory repository can prove the service asked for a reject. It
cannot prove Postgres enforces UNIQUE. That test hits a real database.

Representative cases:

  Test 1 - Salary history isn't overwritten
    Given employee has Rs.10L salary
    When Rs.12L salary is added
    Then two salary records exist

  Test 2 - Current salary
    Given Rs.10L effective Jan 1, Rs.12L effective Jul 1
    When current salary is requested (today >= Jul 1)
    Then Rs.12L is returned

  Test 3 - Future-dated salary is ignored for "current"
    Given Rs.10L effective Jan 1, Rs.15L effective Dec 1
    When current salary is requested in August
    Then Rs.10L is returned

  Test 4 - Duplicate effective date is rejected (integration)
    Given employee already has a salary effective Jul 1
    When another salary is added for Jul 1
    Then the request is rejected by UNIQUE
    And no second row exists

  Test 5 - Inactive employees excluded from spend
    Given employee is inactive
    When current spend is calculated
    Then employee isn't included

  Test 6 - Currency conversion
    Given Rs.10L salary, USD rate = 0.012
    When spend is calculated
    Then USD value = 12000

  Test 7 - Employee without a salary record, in analytics
    Given employee has no salary_records
    When headcount and average salary are calculated
    Then employee is included in headcount, excluded from average

  Test 8 - Hire without salary
    Given no salary
    When employee is created
    Then the employee exists
    And current salary is null

  Test 9 - Inactive employee still has history
    Given employee has salary history
    When employee becomes inactive
    Then salary history remains accessible

  Test 10 - Invalid salary rejected
    Given amount = 0
    When salary is added
    Then the request is rejected
    And no salary record is created

These are business-behavior tests, not tests that merely assert HTTP
status codes.

7. STRETCH GOAL: "ASK ABOUT COMPENSATION" (POST-MVP)
--------------------------------------------------------

Not part of the committed MVP (see PRD). If pursued after the MVP is
complete and tested:

  HR question (natural language)
        -> LLM
        -> structured intent (validated), e.g.:
             { "metric": "average_salary",
               "group_by": "department",
               "filters": { "department": "Engineering" } }
        -> validation against known metrics/fields
        -> analytics service
        -> PostgreSQL
        -> deterministic result

The LLM only interprets intent; it never generates or executes SQL
directly, and it never performs the calculation itself. The backend
computes the actual answer from validated structured input. This avoids
LLM -> raw SQL -> execute, which would be unsafe (prompt injection,
hallucinated values, non-reproducible answers).
