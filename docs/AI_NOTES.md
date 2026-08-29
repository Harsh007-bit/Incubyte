AI NOTES
========

I used Cursor as a collaborator. The PRD and architecture notes were
written first. Implementation follows those rules.

STACK (LOCKED)
--------------
React + TypeScript + Vite
Node.js + TypeScript + Express
PostgreSQL via pg
Zod at the API
Vitest + Supertest

No ORM. No Prisma. I started down that path once and rolled it back —
the schema is small and UNIQUE / CHECK should be visible SQL, not an
ORM mapping.

WHAT I REJECTED
---------------
1. is_current flag — current salary is a query, not a column.
2. Stored USD at write time — reports use the current rate at query
   time (DESIGN 4.1).
3. Redis for 10k rows — not needed.
4. A second index on (employee_id, effective_from). UNIQUE already
   creates that index.
5. Versioned FX (id + set_at + "latest active"). There is no active
   flag and the assignment does not need historical reports. One row
   per currency is enough.
6. Proving Postgres UNIQUE with an in-memory fake. Domain tests stay
   in-memory. Constraint tests hit a real database.

WHAT I KEPT
-----------
- Same salary-history invariants.
- Validation in three places: UI, Zod, CHECK / UNIQUE in Postgres.
- Routes under /api so the SPA and API can share a host.
