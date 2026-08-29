CREATE TABLE IF NOT EXISTS employees (
    id UUID PRIMARY KEY,
    employee_code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    country_code TEXT NOT NULL,
    department TEXT NOT NULL,
    designation TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS salary_records (
    id UUID PRIMARY KEY,
    employee_id UUID NOT NULL REFERENCES employees(id),
    base_amount DECIMAL(12,2) NOT NULL CHECK (base_amount > 0),
    currency TEXT NOT NULL,
    effective_from DATE NOT NULL,
    reason TEXT NOT NULL CHECK (length(trim(reason)) > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (employee_id, effective_from)
);

CREATE TABLE IF NOT EXISTS exchange_rates (
    currency TEXT PRIMARY KEY,
    rate_to_usd DECIMAL(12,6) NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_employees_country ON employees(country_code);
CREATE INDEX IF NOT EXISTS idx_employees_dept ON employees(department);
CREATE INDEX IF NOT EXISTS idx_employees_status ON employees(status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_employees_email ON employees (LOWER(email));

DO $$ BEGIN
    ALTER TABLE employees ADD CONSTRAINT employees_country_code_check
        CHECK (country_code IN ('IN','US','GB','DE','SG','AU','CA','JP','NL','AE'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE employees ADD CONSTRAINT employees_department_check
        CHECK (department IN (
            'Engineering','Product','Design','Sales','Marketing','Finance',
            'HR','Operations','Customer Success','Legal'
        ));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE salary_records ADD CONSTRAINT salary_records_currency_check
        CHECK (currency IN ('USD','INR','GBP','EUR','SGD','AUD','CAD','JPY','AED'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
