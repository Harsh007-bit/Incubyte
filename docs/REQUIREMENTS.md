ACME SALARY MANAGEMENT — PRODUCT REQUIREMENTS
================================================

GOAL
----
Replace ACME's spreadsheet-based salary management for approximately
10,000 employees with a simple web application that allows HR to manage
employee compensation, preserve salary history, and understand how the
organization pays people.

PRIMARY USER
------------
HR Manager — responsible for maintaining employee profiles and
compensation data and answering organization-level salary questions.

MVP SCOPE
---------

1. Employee Directory

HR can:
  - Search employees by name.
  - Filter by country_code, department, and active/inactive status.
  - Navigate results using pagination.
  - View an employee's profile and current compensation.

2. Employee Management

HR can:
  - Add a new employee (compensation is optional at creation time — an
    employee can be added first and have a salary record added later;
    hiring and setting pay are not required to be a single atomic step).
  - Edit employee profile information.
  - Mark an employee as inactive.

Employees will not be hard-deleted so that historical salary information
remains intact.

Basic domain validation applies to employee profiles: name and email are
required and non-empty, email must be valid format, country_code must be
a recognized value, and status must be one of {active, inactive}.

3. Salary Management

HR can update an employee's compensation by providing:
  - Amount
  - Currency
  - effective_from
  - Reason for the change

Salary changes are append-only. Adding a new salary creates a new
record; existing salary records are never overwritten or deleted.

An employee cannot have more than one salary record with the same
effective_from (enforced at the database level). This keeps "current
salary" a deterministic query rather than one with an implicit,
unstated assumption.

Basic domain validation applies to salary records: amount must be
greater than zero, currency must be a supported currency, effective_from
must be a valid date, and reason must be non-empty.

4. Salary History

An employee's profile displays their complete salary history, including
previous amounts, currencies, effective_from dates, and change reasons.

The current salary is the salary record with the latest effective_from
that is not in the future (effective_from <= today, ordered descending,
limit 1). Because effective_from is unique per employee, this query is
deterministic.

Salary history is an immutable record of compensation changes, not a
full audit trail. It does not capture who made a change or from where —
that would require actor identity, which is out of scope since
authentication is excluded from the MVP. If a full audit trail is needed
later, it depends on authentication being added first.

Employees with no salary record yet (added but not yet given a
compensation entry) are included in headcount but excluded from average
salary and spend calculations, since there is no amount to average.

5. Salary Insights

HR can view:
  - Headcount by country and department.
  - Current salary spend by country and department.
  - Average salary by country and department.

Because employees may be paid in different currencies, all cross-country
averages and spend figures use USD conversion based on a fixed,
versioned exchange-rate table. Original salary amounts and currencies
are always preserved alongside the converted values.

ASSUMPTIONS
-----------
- The MVP has a single HR Manager persona.
- Salary amounts represent annual compensation.
- Salary history is immutable once recorded.
- An employee cannot have two salary records with the same
  effective_from.
- The current salary is the salary record with the latest effective_from
  that is not in the future.
- Inactive employees retain their salary history but are excluded from
  current headcount and spend calculations.
- Employees without any salary record are included in headcount but
  excluded from average salary and spend calculations.
- USD conversion is intended for comparison and reporting and does not
  modify the employee's original compensation.
- "Spend" refers to current annual salary cost.

DELIBERATELY OUT OF SCOPE
--------------------------
- Authentication and multi-role authorization — the assessment assumes
  a single HR user. As a consequence, a full audit trail (who changed
  what) is also out of scope, since actor identity isn't available
  without auth.
- Payroll, tax, benefits, and approval workflows — these belong to a
  broader payroll/HR product.
- CSV import/export — the seed script provides the required initial
  dataset; export can be added later if needed.
- Live foreign-exchange integration — a fixed rate table keeps reporting
  deterministic and avoids introducing an external dependency.
- Redis, background workers, and a separate analytics warehouse — the
  expected dataset of 10,000 employees does not justify this
  operational complexity for the MVP.
- Organizational hierarchy, performance reviews, and other HR workflows
  unrelated to compensation.
- Natural-language "ask a question about pay" feature — see Stretch
  Goals below. Not part of the committed MVP.

STRETCH GOAL (POST-MVP, NOT COMMITTED)
----------------------------------------
If time remains after the MVP above is complete and tested:

"Ask about compensation" — HR types a natural-language question (e.g.
"what's the average salary in engineering?"). An LLM converts the
question into a structured, validated intent (metric, group_by,
filters) — never raw SQL. The backend, not the LLM, then runs the
actual calculation against the database using that structured intent.
This keeps the answer deterministic and safe from prompt injection or
hallucinated numbers; the LLM only interprets intent, it never touches
data directly.

This is explicitly a stretch goal, not a scoped MVP feature, so it does
not appear in Success Criteria below.

TECHNOLOGY DIRECTION
----------------------
- Backend: Node.js + TypeScript
- Database: PostgreSQL
- Frontend: React + TypeScript

A modular monolithic architecture is sufficient for the MVP. PostgreSQL
gives us real DECIMAL and UUID types, and it is the database I would
actually run if this left the assessment. Domain logic stays independent
of the SQL layer so the persistence can change without rewriting
salary rules.

SUCCESS CRITERIA
------------------
The MVP is successful when an HR manager can:

1. Find an employee within the 10,000-person dataset.
2. View their current compensation and complete salary history.
3. Change compensation without losing previous records.
4. View meaningful salary/headcount insights by country and department.
5. Run the application end-to-end with seeded data.
6. Verify the core salary-management rules through fast, deterministic
   automated tests.
