# DayStack database schema

DayStack now uses an app-owned PostgreSQL schema with server-side authorization. Authentication is handled by Auth.js credentials auth, and application data lives in the same Postgres database.

## Core tables

### `users`

Application-owned user accounts.

- `id`: UUID primary key
- `email`: unique login identity
- `full_name`: nullable display name
- `password_hash`: bcrypt password hash
- `status`: `active` or `disabled`
- `last_sign_in_at`, `created_at`, `updated_at`

Notes:

- email/password auth is local to the app
- disabled users are blocked in auth and protected app routes
- database constraints reject blank emails

### `tasks`

Planner time blocks owned by one user.

- `id`: UUID primary key
- `user_id`: owner, references `users.id`
- `title`
- `task_date`
- `start_time`
- `end_time`
- `task_type`: `generic`, `meeting`, or `blocked`
- `meeting_link`: nullable URL for meeting tasks
- `source_task_id`: nullable source task for accepted mention clones
- `status`: `pending` or `completed`
- `created_at`, `updated_at`

Rules:

- blank titles are rejected by a database check
- `end_time` must be later than `start_time`
- blocked tasks remain visible but are excluded from score and streak math

### `task_participants`

Participant links for meeting tasks.

- `id`: UUID primary key
- `task_id`: references `tasks.id`
- `participant_id`: references `users.id`
- `created_at`

Purpose:

- stores meeting mentions
- powers participant chips and mention notifications
- uses a unique `(task_id, participant_id)` index to prevent duplicates

### `task_notifications`

In-app mention notifications.

- `id`: UUID primary key
- `user_id`: recipient
- `actor_user_id`: who mentioned the recipient
- `task_id`: source task
- `notification_type`: currently `task_mention`
- `status`: `pending`, `accepted`, `dismissed`, or `expired`
- `read_at`
- `accepted_task_id`: nullable cloned task created after acceptance
- task snapshot fields:
  `task_title`, `task_date`, `start_time`, `end_time`, `task_type`, `meeting_link`
- `created_at`, `updated_at`

Purpose:

- backs the notification center UI
- preserves task context even if the source task changes later
- keeps mention acceptance idempotent

### `daily_summaries`

Persisted per-day rollups.

- `id`: UUID primary key
- `user_id`
- `summary_date`
- `total_tasks`
- `completed_tasks`
- `execution_score`
- `successful_day`
- `created_at`, `updated_at`

Purpose:

- supports streak calculations
- avoids rebuilding historical summaries on every request

### `user_notification_preferences`

Per-user reminder toggles.

- `user_id`: primary key, references `users.id`
- `push_enabled`
- `remind_at_start`
- `remind_5_min_before`
- `remind_overdue`
- `created_at`, `updated_at`

Notes:

- signup creates a default row
- changing preferences re-syncs reminder rows for future pending tasks

### `task_reminders`

Explicit reminder queue rows.

- `id`: UUID primary key
- `task_id`
- `user_id`
- `reminder_type`: `5_minutes_before`, `at_start`, or `overdue`
- `remind_at`: UTC timestamp
- `status`: `pending`, `processing`, `sent`, `skipped`, or `failed`
- `sent_at`
- `created_at`, `updated_at`

Purpose:

- makes reminder scheduling deterministic
- supports Vercel Cron dispatch
- keeps sent reminders as history while replacing mutable unsent rows

## Relationships

- `users` -> `tasks` is one-to-many
- `users` -> `daily_summaries` is one-to-many
- `users` -> `user_notification_preferences` is one-to-one
- `users` -> `task_notifications.user_id` is one-to-many
- `users` -> `task_notifications.actor_user_id` is one-to-many
- `users` -> `task_participants.participant_id` is one-to-many
- `tasks` -> `task_participants` is one-to-many
- `tasks` -> `task_reminders` is one-to-many

## Authorization model

DayStack no longer uses Supabase RLS. Authorization is enforced in the application layer:

- protected pages resolve the Auth.js session server-side
- route handlers load the signed-in user from the session
- every task, reminder, notification, and admin operation filters by the authenticated user id
- admin operations use a separate admin cookie flow and still operate on the same Postgres tables

## Execution score and streak logic

Execution score:

```text
execution_score = (completed_tasks / total_tasks) * 100
```

Rules:

- blocked tasks are excluded from the denominator
- if no actionable tasks exist, score is `0`
- `successful_day` is `true` when score is at least `70`

## Reminder flow

- task create, update, reschedule, and completion re-sync reminder rows
- reminder rows are generated from task times plus per-user preferences
- `/api/reminders/dispatch` reads due reminders from Postgres and sends through OneSignal
- Vercel Cron can call the dispatch route with `CRON_SECRET`

## Mention flow

- meeting participants are stored in `task_participants`
- mention sync creates or refreshes `task_notifications`
- accepting a mention clones the source task into the recipient's planner
- the accept flow is idempotent and guarded by unique indexes plus transactional checks

## Indexes

Important indexes:

- `tasks_user_date_start_idx`
- `tasks_user_date_status_idx`
- `tasks_user_date_type_idx`
- `tasks_user_source_task_uidx`
- `task_participants_task_participant_uidx`
- `daily_summaries_user_date_idx`
- `task_reminders_task_type_time_uidx`
- `task_reminders_due_idx`
- `task_reminders_user_due_idx`
- `task_notifications_task_user_type_uidx`
- `task_notifications_user_created_idx`
- `task_notifications_actor_created_idx`

These cover the main planner, reminder, and notification query paths.
