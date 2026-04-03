# DayStack

DayStack is a timeline-based daily execution planner built on:

- Next.js 16 App Router
- React 19
- TypeScript
- Vercel Postgres-compatible PostgreSQL
- Auth.js credentials auth
- Gmail SMTP reminder emails

## Core features

- Landing page at `/`
- Email/password auth at `/login` and `/signup`
- Protected planner at `/app`
- AI chat assistant tab inside `/app`
- Daily timeline planning with create/edit/delete/complete flows
- Execution score and streak tracking
- Meeting blocks with participant mentions
- In-app notification center
- Reminder preferences plus test email delivery
- Reminder dispatch route for Vercel Cron
- Internal admin console at `/admin`

## Environment

Create `.env.local` from `.env.example`.

Required:

```bash
POSTGRES_URL=
AUTH_SECRET=
ADMIN_USERNAME=
ADMIN_PASSWORD=
```

Optional:

```bash
POSTGRES_URL_NON_POOLING=
NEXTAUTH_URL=http://localhost:3000
GROQ_API_KEY=
GROQ_MODEL=llama-3.1-8b-instant
GMAIL_SMTP_USER=
GMAIL_SMTP_APP_PASSWORD=
EMAIL_FROM_NAME=DayStack
CRON_SECRET=
ADMIN_SESSION_SECRET=
```

## Local setup

1. Install dependencies:

```bash
npm install
```

2. Generate and apply the database migration:

```bash
npm run db:generate
npm run db:migrate
```

3. Add your environment variables to `.env.local`.

4. Start the app:

```bash
npm run dev
```

## Database

The Drizzle schema lives in [src/db/schema.ts](/D:/DayStack/src/db/schema.ts) and generated SQL migrations live in [drizzle](/D:/DayStack/drizzle).

Main tables:

- `users`
- `api_keys`
- `tasks`
- `task_participants`
- `daily_summaries`
- `user_notification_preferences`
- `task_reminders`
- `task_notifications`

## Deployment

Recommended setup:

1. Create a Vercel project.
2. Attach Vercel Postgres.
3. Add the environment variables from `.env.example`.
4. Run the generated Drizzle migration against the production database.
5. Deploy.

For scheduled reminders, configure Vercel Cron to `POST /api/reminders/dispatch` with `Authorization: Bearer <CRON_SECRET>`.

## DayStack Assistant

DayStack now includes an AI assistant tab inside `/app`.

What it can do:

- Answer questions about how DayStack works
- Draft planner changes from chat prompts
- Create, edit, reschedule, complete, and delete visible blocks
- Work with recurring blocks using confirmation before applying changes

Setup:

1. Add `GROQ_API_KEY` to `.env.local`.
2. Optionally set `GROQ_MODEL` if you want a different Groq model than the default.
3. Open the `Assistant` tab inside the app and start chatting.

Notes:

- The assistant is grounded to the currently selected day plus the visible tasks and recurring blocks in that context.
- It always asks for confirmation before changing data.
- If a request is ambiguous or the target is not visible in the current context, it will ask a follow-up question instead of guessing.

## Automation API

DayStack now includes a first-party automation API for Zapier-style integrations.

How it works:

1. Open `Settings` inside the app.
2. Create an API key in the `Automation API` section.
3. Use that key as `Authorization: Bearer <YOUR_DAYSTACK_API_KEY>` when calling `/api/v1/...`.

Available endpoints:

- `GET /api/v1/me`
- `GET /api/v1/dashboard?date=YYYY-MM-DD`
- `GET /api/v1/tasks?date=YYYY-MM-DD`
- `POST /api/v1/tasks`
- `PATCH /api/v1/tasks/:taskId`
- `DELETE /api/v1/tasks/:taskId`
- `PATCH /api/v1/tasks/:taskId/status`
- `PATCH /api/v1/tasks/:taskId/reschedule`
- `GET /api/v1/participants/search?q=name`

Example:

```bash
curl -X POST "https://your-app.vercel.app/api/v1/tasks" \
  -H "Authorization: Bearer YOUR_DAYSTACK_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "blockMode": "one_time",
    "title": "Follow up with client",
    "taskDate": "2026-04-02",
    "startTime": "14:00",
    "endTime": "14:30",
    "taskType": "generic",
    "meetingLink": "",
    "participants": [],
    "weekdays": []
  }'
```

Vercel note:

- No extra Vercel environment variables are required for automation keys.
- API keys are stored in the database, not in Vercel env vars.
- You do need to apply the latest Drizzle migration in production so the new `api_keys` table exists.

## Notes

- Notification delivery is email-based.
- The app no longer depends on Supabase for auth, data access, admin operations, or realtime updates.
- Notification refresh is polling-based rather than realtime subscription based.
