# ACME Pay — What Was Implemented

This is the as-built list. Product intent is in [REQUIREMENTS.md](REQUIREMENTS.md). Why the schema and APIs look this way is in [DESIGN.md](DESIGN.md).

Live demo: https://acme-pay.vercel.app  
API health: https://acme-pay-api.vercel.app/api/health

---

## 1. MVP coverage

Everything in the committed MVP is in. Stretch “ask about compensation” is not.

| Area | Status |
|------|--------|
| Directory: search, filter, paginate | Done |
| Profile + current compensation | Done |
| Hire without salary | Done |
| CSV bulk hire (partial success) | Done |
| Edit profile | Done |
| Deactivate (no hard delete) | Done |
| Append-only salary + reason | Done |
| Unique `(employee_id, effective_from)` | Done (API + Postgres) |
| Full salary history | Done |
| Current salary = latest `effective_from <= today` | Done (IST calendar date) |
| Insights: headcount / spend / avg, USD at query time | Done |
| Seed ~10k employees | Done (local + production) |
| Automated tests for salary rules | Done |

Out of scope and **not** built: auth, payroll, CSV export, live FX, Redis, workers, NL “ask about pay”.

---

## 2. UI (React + Vite)

Three screens, one HR user, no login.

**Directory** (`/`)
- Search by name (debounced; multiple name chips).
- Filters: country, department, status (default **active**).
- Pagination (25 / 50 / 100).
- Each row: code, name, country, department, current pay (or empty).
- **Add Person** opens a modal (not a separate page). Overlay, X, Cancel, Escape.

**Hire modal**
- Single hire: name, email, country, department, designation. No salary on this form.
- CSV tab: paste or pick a file, `POST /api/employees/import`. Valid rows create; invalid rows return `{ line, detail }`. Cap **500** people. Sample CSV download.

**Employee** (`/employees/:id`)
- Current compensation (or “no salary yet”).
- Edit profile and save.
- Confirm before activate / deactivate. History stays.
- Append a salary: amount, currency, `effective_from`, reason. Duplicate date is rejected; old rows stay.

**Insights** (`/insights`)
- Group by country or department.
- Active headcount, current annual spend (USD), average USD.
- Inactive people out of spend. People with no salary stay in headcount.

Money in the UI is formatted; totals use cent-safe addition, not float `reduce`.

---

## 3. API (Express, prefix `/api`)

| Method | Path | What it does |
|--------|------|----------------|
| GET | `/health` | `{ status: "ok" }` |
| GET | `/meta` | Allowed countries, departments, currencies, statuses |
| GET | `/employees` | Search `q`, filters `country` / `department` / `status` (repeatable), `page`, `page_size` (default 25, max 100). Includes `current_salary` or `null`. |
| POST | `/employees` | Hire. Optional `employee_code`; otherwise `ACME-NNNNN`. Status starts `active`. No salary. **201** |
| POST | `/employees/import` | JSON `{ csv }`. Partial success: `{ created, errors: [{ line, detail }] }`. Registered **before** `/:id`. |
| GET | `/employees/:id` | Profile + current salary |
| PATCH | `/employees/:id` | Profile fields and/or `status` |
| GET | `/employees/:id/salary-history` | All rows, newest `effective_from` first |
| POST | `/employees/:id/salary` | Append only. **201** |
| GET | `/analytics/headcount?groupBy=` | `country` or `department` |
| GET | `/analytics/spend?groupBy=` | USD spend + paid headcount |
| GET | `/analytics/avg-salary?groupBy=` | USD average, paid headcount, total headcount |

Errors: **400** domain, **404** missing, **409** unique conflict, **422** Zod, **500** unexpected. Body `{ detail, code }`.

Create/update **trim** name, email, country, department, designation so padded email cannot bypass `UNIQUE (LOWER(email))`.

---

## 4. Domain rules that shipped

- Amounts are **annual**, `DECIMAL`, `decimal.js` (`{ Decimal }`). Not cents in storage.
- Salary rows are insert-only. No update/delete of history.
- Current salary: `effective_from <= today`, latest wins. Future-dated rows show in history only.
- **Today** is the calendar date in `APP_TZ` (default `Asia/Kolkata`), not UTC midnight.
- One salary per `(employee_id, effective_from)` — service conflict + Postgres `UNIQUE`.
- Email unique case-insensitive.
- No salary → in headcount, out of spend and averages.
- Inactive → history kept, out of insights.
- FX: one row per currency; USD conversion at **query** time. Original amount/currency never overwritten.
- Validation in three places: UI, Zod + domain validators, Postgres `CHECK` / `UNIQUE`.

Allowed countries: `IN US GB DE SG AU CA JP NL AE`  
Currencies: `USD INR GBP EUR SGD AUD CAD JPY AED`  
Departments: Engineering, Product, Design, Sales, Marketing, Finance, HR, Operations, Customer Success, Legal.

CSV headers: `name,email,country_code,department,designation`  
Aliases: `country`, `dept`, `title`. Optional `employee_code`. Line numbers are original file lines (blank lines skipped, numbers not compacted).

---

## 5. Data

**Schema** (`employees`, `salary_records`, `exchange_rates`) — see DESIGN §2. Boot runs `CREATE IF NOT EXISTS` + CHECKs from `backend/src/common/schemaSql.ts` (same SQL as `backend/sql/schema.sql`).

**Seed** (`npm run seed` in `backend/`):
- 10,000 people, deterministic faker seed `42`
- ~2% with no salary
- ~8% inactive
- Extra raises for a subset → about **14,680** salary rows
- Refuses to run twice unless `--force` (does not wipe unless forced)

Production Neon is already seeded. Do **not** point `npm test` at that database.

---

## 6. Architecture (as built)

Modular monolith. HTTP is REST in `controllers/`.

```
backend/src/
  server.ts          boot, migrate, listen; Vercel entry
  http.ts            createApp() — named http.ts so Vercel does not treat it as the Express entry
  db.ts, config.ts
  common/            constants, types, errors, dates, schema SQL
  controllers/       employees, analytics
  services/          employees, salaries, analytics, fx
  validators/        Zod bodies + domain rules
  database/repos/    interfaces + pg* + in-memory fake
  utils/             csv, query, postgres errors
  types/             local shims for pg / express / cors (NodeNext)

frontend/src/
  components/views/  Directory (+ HireModal), Employee, Insights
  api/               fetch client (`VITE_API_URL` in production)
  models/, utils/, routes/
```

Services talk to repository interfaces. Unit tests use the in-memory repo. Postgres repos are a delivery detail.

---

## 7. Tests

`cd backend && npm test` — in-memory only; **does not** touch the 10k seed.

`npm run test:pg` — only if `TEST_DATABASE_URL` is a **separate** DB (`acme_test`). Those tests `TRUNCATE`.

Covered:
- History is not overwritten
- Current vs future-dated salary
- Duplicate `effective_from`
- Hire without salary
- Inactive out of spend, history still readable
- Headcount vs average (unpaid people)
- USD conversion
- Amount ≤ 0 / empty reason rejected
- CSV line numbers
- Update trim vs unique email
- HTTP 201 / 409 / 422 via Supertest
- Postgres UNIQUE / CHECK when `TEST_DATABASE_URL` is set

---

## 8. Run locally

```bash
docker compose up -d
cd backend
export DATABASE_URL=postgresql://acme:acme@localhost:5432/acme
npm install && npm test && npm run seed && npm run dev
```

```bash
cd frontend && npm install && npm run dev
```

UI http://localhost:5173 (proxies `/api` → `:8000`).

---

## 9. Production

| Piece | Where |
|-------|--------|
| UI | Vercel project `acme-pay` — https://acme-pay.vercel.app |
| API | Vercel project `acme-pay-api` (Express) — https://acme-pay-api.vercel.app |
| DB | Neon (Vercel Marketplace), Singapore, free plan |
| Frontend → API | `frontend/.env.production` → `VITE_API_URL=https://acme-pay-api.vercel.app` |
| CORS | Reflects request origin when `VERCEL` is set |

First API request after idle can cold-start. Insights over 10k rows is a couple of queries plus in-memory grouping (no warehouse).

---

## 10. What a 2–5 min demo should show

1. Directory: search a name, filter country/department.
2. Open someone with pay. Add a raise. Old row remains.
3. Same `effective_from` again → rejected.
4. Edit profile. Deactivate. History still there. Insights drop them from spend.
5. Insights: headcount vs spend by country / department.
6. Add Person without salary; optional CSV with one bad row (partial success).
