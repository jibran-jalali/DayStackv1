# Architecture Overview

DayStack is a Next.js App Router application backed by PostgreSQL and Drizzle ORM.

## Runtime Surfaces

- Marketing site at `/`
- Auth routes at `/login`, `/signin`, and `/signup`
- Protected planner workspace at `/app`
- Internal admin console at `/admin`
- Automation API at `/api/v1/*`
- Reminder, assistant, calendar, and admin API routes under `src/app/api` and `src/app/admin/api`

## Main Layers

### UI

`src/components` is split by surface:

- `app` for authenticated planner UI
- `marketing` for the landing page
- `auth` for sign in/sign up
- `admin` for internal account management
- `shared` for reusable primitives

### Data

`src/db/schema.ts` defines the PostgreSQL schema. `src/lib/data/daystack.ts` contains planner data access and mutations. `src/lib/admin/data.ts` contains admin-only account operations.

### Authentication

Normal user authentication uses Auth.js credentials auth with JWT sessions. Admin authentication uses a separate HttpOnly admin session cookie scoped to `/admin`.

### AI Planning

DayStack AI scheduling is handled server-side through `src/lib/assistant/planner.ts` and `/api/assistant/plan`. The planner combines provider output with deterministic scheduling heuristics.

### Notifications

Reminder preferences, task reminders, and push subscriptions are stored in PostgreSQL. `/api/reminders/dispatch` is designed for protected cron execution with `CRON_SECRET`.

### Google Calendar

Google Calendar OAuth state, encrypted tokens, imported events, and task-calendar links are handled by the calendar API routes and related database tables.

## Operational Notes

- Production secrets should only live in the hosting provider environment.
- Database schema changes should be documented in `docs/database-schema.md`.
- Admin impersonation should remain admin-only and auditable by code review.
- Reminder dispatch should always be protected by a bearer token.
