# ACME Pay

Web app for one HR manager to look up ~10,000 people, change pay without
losing history, and see how the org spends on salary.

Docs first: [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md),
[docs/DESIGN.md](docs/DESIGN.md),
[docs/IMPLEMENTATION.md](docs/IMPLEMENTATION.md) (what actually shipped),
[docs/AI_NOTES.md](docs/AI_NOTES.md).

Live: https://acme-pay.vercel.app  
API: https://acme-pay-api.vercel.app/api/health

## Stack

React + TypeScript + Vite · **Python + FastAPI** · PostgreSQL · Pydantic · pytest

The original Node/Express API is still in `backend/` (not used for local run).
Live UI and API are FastAPI on Vercel (`acme-pay` + `acme-pay-api`).

## Run locally

```bash
docker compose up -d

cd backend-py
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
export DATABASE_URL=postgresql://acme:acme@localhost:5432/acme
export APP_TZ=Asia/Kolkata
pytest
python seed.py
uvicorn app.server:app --reload --port 8000
```

In another terminal:

```bash
cd frontend
npm install
npm run dev
```

UI: http://localhost:5173 · API: http://localhost:8000/api/health

Vite proxies `/api` to `:8000`, so the React app does not need `VITE_API_URL` locally.

## Demo script (2–5 min)

1. Open the directory. Search a name. Filter by country or department.
2. Open someone with a salary. Add a raise. Confirm the old row stays.
3. Try the same `effective_from` again — it is rejected.
4. Edit their profile. Mark someone inactive. History is still there. Insights drop them from spend.
5. Insights: headcount vs spend by country / department.

## Tests

`cd backend-py && pytest` runs in-memory unit tests and does **not**
touch the seeded database.

Postgres UNIQUE / CHECK tests need a **separate** database (`acme_test`).
They `TRUNCATE`. Never set `TEST_DATABASE_URL` to Neon.

```bash
export TEST_DATABASE_URL=postgresql://acme:acme@localhost:5432/acme_test
cd backend-py && pytest
```

```bash
# Node API tests (legacy)
cd backend && npm test
```
