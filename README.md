# DayStack

DayStack is a timeline-based daily execution planner built on:

- Next.js 16 App Router
- React 19
- TypeScript
- Vercel Postgres-compatible PostgreSQL
- Auth.js credentials auth
- OneSignal web push

## Core features

- Landing page at `/`
- Email/password auth at `/login` and `/signup`
- Protected planner at `/app`
- Daily timeline planning with create/edit/delete/complete flows
- Execution score and streak tracking
- Meeting blocks with participant mentions
- In-app notification center
- Reminder preferences plus OneSignal test push
- Reminder dispatch route for Vercel Cron
- Internal admin console at `/admin`

## Environment

Create `.env.local` from `.env.example`.

Required:

```bash
POSTGRES_URL=
AUTH_SECRET=
NEXT_PUBLIC_ONESIGNAL_APP_ID=
ONESIGNAL_REST_API_KEY=
ADMIN_USERNAME=
ADMIN_PASSWORD=
```

Optional:

```bash
POSTGRES_URL_NON_POOLING=
NEXTAUTH_URL=http://localhost:3000
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

## Notes

- Notification delivery still uses OneSignal.
- The app no longer depends on Supabase for auth, data access, admin operations, or realtime updates.
- Notification refresh is polling-based rather than realtime subscription based.
