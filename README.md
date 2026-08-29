# ACME Pay

Web app for one HR manager to look up ~10,000 people, change pay without
losing history, and see how the org spends on salary.

Docs first: [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md),
[docs/DESIGN.md](docs/DESIGN.md),
[docs/IMPLEMENTATION.md](docs/IMPLEMENTATION.md) (what actually shipped),
[docs/AI_NOTES.md](docs/AI_NOTES.md).

Live: https://acme-pay.vercel.app

## Stack

React + TypeScript + Vite · Node + TypeScript + Express · PostgreSQL · `pg` · Zod · Vitest

## Run locally

```bash
docker compose up -d
cd backend
cp .env.example .env
npm install
export DATABASE_URL=postgresql://acme:acme@localhost:5432/acme
npm test
npm run seed
npm run dev
```

In another terminal:

```bash
cd frontend
npm install
npm run dev
```

UI: http://localhost:5173 · API: http://localhost:8000/api/health

## Demo script (2–5 min)

1. Open the directory. Search a name. Filter by country or department.
2. Open someone with a salary. Add a raise. Confirm the old row stays.
3. Try the same `effective_from` again — it is rejected.
4. Edit their profile. Mark someone inactive. History is still there. Insights drop them from spend.
5. Insights: headcount vs spend by country / department.

## Tests

`cd backend && npm test` runs the in-memory unit tests and does **not**
touch the seeded database.

Postgres constraint tests run only when `TEST_DATABASE_URL` points at a
**separate** database (so they cannot `TRUNCATE` the 10k seed):

```bash
# once, if acme_test does not exist yet
docker compose exec db createdb -U acme acme_test
cd backend && npm run test:pg
```

Unit tests cover salary history, current-pay selection, analytics, and
hire-without-salary. Integration tests prove UNIQUE / CHECK in Postgres.
