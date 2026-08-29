AI NOTES
========

I used Cursor as a collaborator. The PRD and architecture notes were
written first. Implementation follows those rules.

STACK CHANGE
------------
First pass started as FastAPI + SQLite because the brief mentioned
SQLite. I rolled that back and rebuilt on Node + TypeScript +
PostgreSQL. Reasons:

- PostgreSQL has real DECIMAL and UUID types. SQLite does not.
- The JD lists TypeScript. I want the submission to match how I
  actually work on JS/TS systems.
- Domain rules did not change. Only the delivery stack did.

WHAT I REJECTED
---------------
1. is_current flag — current salary is a query, not a column.
2. Stored USD at write time — reports use the current rate at query
   time (DESIGN 4.1).
3. Redis for 10k rows — not needed.
4. Testing against a live Postgres for the seven business-behavior
   cases. Those tests hit in-memory repositories so they stay fast and
   deterministic. Prisma is the production adapter, not the test
   harness.

WHAT I KEPT
-----------
- Same schema invariants and the same seven tests.
- Routes mounted under /api so the SPA and API can share a host.
