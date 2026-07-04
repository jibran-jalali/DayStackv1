# DayStack

DayStack is a timeline-based daily execution planner built for people who want a clear plan, visible momentum, and fewer decisions during the day. It combines structured time blocking, task execution tracking, reminders, friend-based meeting mentions, Google Calendar import, and DayStack AI scheduling.

## What DayStack Does

- Turns a day into a visual timeline of focused blocks.
- Tracks completion, execution score, streaks, and daily progress.
- Supports one-time and recurring blocks.
- Handles meeting blocks, participant mentions, friend requests, and in-app approvals.
- Sends reminder emails and push notifications when configured.
- Imports Google Calendar events into the planner when connected.
- Provides a DayStack AI assistant tab inside the planner shell.
- Adds an AI Plan button that schedules multiple tasks at productive times, then creates them after confirmation.
- Exposes a first-party automation API for external integrations.
- Includes an internal admin console for operational user management.

## Tech Stack

- Next.js 16 App Router
- React 19
- TypeScript
- Drizzle ORM
- PostgreSQL, including Vercel Postgres-compatible databases
- Auth.js credentials authentication
- Tailwind CSS 4
- Nodemailer for email reminders
- Web Push for browser and installed-PWA reminders
- Groq or OpenAI for DayStack AI planning

## App Surfaces

- `/` - marketing landing page
- `/login`, `/signin`, `/signup` - authentication
- `/app` - protected planner workspace
- `/app?tab=assistant` - DayStack AI planner assistant inside the standard app shell
- `/app/notifications` and `?tab=notifications` - notification inbox
- `/app/friends` and `?tab=friends` - friend requests and accepted connections
- `/app/settings` and `?tab=settings` - reminders, push settings, Google Calendar, automation keys, and preferences
- `/admin/login` and `/admin` - internal admin console
- `/privacy` and `/terms` - policy pages

## Core Planner Features

- Timeline grid and list views for the selected day.
- Drag/reschedule-oriented task timing APIs.
- Add, edit, complete, delete, and batch-delete task blocks.
- Recurring block management with occurrence-only or this-and-future scope.
- Execution scoring and active streak calculation.
- Blocked-time support that stays visible without counting against score.
- Meeting block mentions restricted to accepted friends.
- Mention notifications that users can accept into their own timeline.
- Google Calendar sync that imports external events into DayStack blocks.

## DayStack AI

DayStack currently has two AI entry points.

### Assistant Tab

The Assistant tab is inside the normal planner shell. It lets users describe a day in natural language, generate a proposed schedule, review the timeline, and confirm creation.

Example prompt:

```text
Plan my day from 9 AM to 6 PM: calculus 1h, gym 1h, lunch 1h, dinner 1h, review notes 45m
```

### AI Plan Modal

The planner header includes an `AI Plan` button before `Add Block`. It opens a modal where users can add multiple tasks with durations, click the DayStack AI scheduling button, preview the generated timeline, and confirm creation.

The server-side planner uses AI output plus deterministic productivity heuristics. It anchors task categories into sensible day windows, including:

- Deep work and study during peak focus time.
- Writing and creative work in the late morning.
- Meetings near late morning or early afternoon.
- Admin and email during the post-lunch slump.
- Review work in the late afternoon.
- Gym and exercise toward late afternoon when possible.
- Lunch and dinner at human-rhythm-friendly times instead of first available slots.

### AI Provider Selection

The planner checks providers in this order:

1. `OPENAI_API_KEY` with `OPENAI_MODEL`, defaulting to `gpt-5`
2. `GROQ_API_KEY` with `GROQ_MODEL`, defaulting to `openai/gpt-oss-120b`

If neither key is configured, AI planning returns a setup error instead of creating tasks.

## Environment Variables

Create `.env.local` from `.env.example` and fill in the values needed for the features you want enabled.

### Required For Core App

```bash
POSTGRES_URL=
AUTH_SECRET=
ADMIN_USERNAME=
ADMIN_PASSWORD=
```

### Recommended / Optional

```bash
POSTGRES_URL_NON_POOLING=
NEXTAUTH_URL=http://localhost:3000
DAYSTACK_TIME_ZONE=Asia/Karachi
ADMIN_SESSION_SECRET=
```

### AI Planning

```bash
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5
GROQ_API_KEY=
GROQ_MODEL=openai/gpt-oss-120b
```

### Email Reminders

```bash
GMAIL_SMTP_USER=
GMAIL_SMTP_APP_PASSWORD=
EMAIL_FROM_NAME=DayStack
```

### Push Notifications

```bash
NEXT_PUBLIC_VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:admin@daystack.local
```

Generate VAPID keys with:

```bash
npx web-push generate-vapid-keys
```

### Google Calendar

```bash
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

### Reminder Dispatch

```bash
CRON_SECRET=
```

Never commit `.env.local` or real secrets. The file is intentionally ignored by Git.

## Local Development

Install dependencies:

```bash
npm install
```

Create the database schema:

```bash
npm run db:generate
npm run db:migrate
```

Start the development server:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

## Scripts

```bash
npm run dev          # Start Next.js in development mode
npm run build        # Create a production build
npm run start        # Start the production server after build
npm run lint         # Run ESLint
npm run db:generate  # Generate Drizzle migrations
npm run db:migrate   # Apply Drizzle migrations
```

TypeScript verification:

```bash
npx tsc --noEmit
```

On Windows PowerShell, if `npx` script execution is blocked, run:

```powershell
& "node_modules\.bin\tsc.cmd" --noEmit
```

## Database

The Drizzle schema is in `src/db/schema.ts`. Generated migrations live in `drizzle/`.

Main data areas:

- `users` for app-owned accounts
- `tasks` for planner blocks
- `task_participants` for meeting mentions
- `friend_connections` for social graph and mention permissions
- `daily_summaries` for execution history
- `user_notification_preferences` for reminder settings
- `task_reminders` for reminder dispatch tracking
- `task_notifications` for mention notifications
- `api_keys` for automation API credentials
- Google Calendar connection and imported event tables

See `docs/database-schema.md` for a table-by-table schema reference.

## Automation API

DayStack includes a first-party automation API for Zapier-style integrations.

Create an API key in the app under `Settings -> Automation API`, then call endpoints with:

```http
Authorization: Bearer YOUR_DAYSTACK_API_KEY
```

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

## Reminder Delivery

Reminder delivery supports email and push, depending on environment setup and user preferences.

- Email reminders require Gmail SMTP credentials.
- Push reminders require VAPID keys and browser permission.
- iPhone push requires installing DayStack to the Home Screen and enabling push reminders in Settings.
- Each pending task can generate its own notification before start time.
- `/api/reminders/dispatch` is designed for cron invocation and should be protected with `CRON_SECRET`.

For Vercel Pro, configure a cron job that calls `/api/reminders/dispatch` regularly with:

```http
Authorization: Bearer <CRON_SECRET>
```

For Vercel Hobby, use an external scheduler such as cron-job.org, GitHub Actions, Upstash QStash, or another reliable cron provider.

## Deployment

Recommended production flow:

1. Create a Vercel project.
2. Attach a Postgres database or provide compatible Postgres connection strings.
3. Add the required environment variables.
4. Run Drizzle migrations against production.
5. Deploy the app.
6. Configure optional integrations: AI provider, Google Calendar, email, push, and reminder cron.

## Quality Checks

Before shipping changes, run:

```bash
npm run lint
npx tsc --noEmit
npm run build
```

## Security Notes

- Authentication uses app-owned credentials through Auth.js.
- Passwords are stored as bcrypt hashes.
- Application authorization is enforced server-side.
- API keys are stored in the database, not environment variables.
- Production secrets should only live in the hosting provider environment.
- `.env.local` must remain untracked.

## License

DayStack is proprietary software owned by Jibran Jalali.

Copyright (c) 2026 Jibran Jalali. All rights reserved.

No permission is granted to copy, modify, distribute, sublicense, sell, publish, host, deploy, reverse engineer, or otherwise use this software without prior written permission. See `LICENSE` for details.

## Project Status

DayStack is an active production-oriented planner application. The current build focuses on a polished planner workspace, AI-assisted scheduling, reliable reminders, social meeting workflows, and API-driven automation.
