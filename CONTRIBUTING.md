# Contributing

DayStack is proprietary software owned by Jibran Jalali. Contributions, reviews, and development access are by explicit permission only.

## Development Workflow

1. Create a focused branch from `main`.
2. Keep changes small and scoped to one product or infrastructure concern.
3. Update documentation when behavior, environment variables, setup, or operations change.
4. Run checks before opening a pull request.

```bash
npm run check
npm run build
```

## Code Standards

- Prefer small, direct changes over broad rewrites.
- Keep server-only logic on the server, especially auth, admin, reminders, and Google Calendar tokens.
- Do not commit secrets, local database URLs, API keys, screenshots containing credentials, or `.env.local`.
- Preserve existing UI language and design system unless the task explicitly asks for a redesign.
- Add comments only when the code would otherwise be difficult to understand.

## Pull Requests

Every pull request should include:

- What changed
- Why it changed
- How it was verified
- Screenshots or recordings for visible UI changes
- Notes about migrations, cron jobs, integrations, or environment variables

## Database Changes

Update `src/db/schema.ts`, generate a Drizzle migration, and document meaningful schema changes in `docs/database-schema.md`.

```bash
npm run db:generate
npm run db:migrate
```

## Security-Sensitive Areas

Extra care is required for changes touching:

- `src/lib/auth.ts`
- `src/lib/admin/*`
- `src/app/admin/api/*`
- API key creation and validation
- Google Calendar OAuth/token storage
- Reminder dispatch and cron authorization
- User impersonation/admin access
