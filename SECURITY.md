# Security Policy

DayStack is proprietary software. Report vulnerabilities privately to Jibran Jalali or the repository owner. Do not open public issues for security-sensitive findings.

## Supported Branch

Security fixes are applied to `main`.

## Reporting

Include the following when reporting a vulnerability:

- Affected route, API endpoint, or feature
- Steps to reproduce
- Expected and actual behavior
- Impact assessment
- Suggested mitigation, if known

## Secrets

Never commit secrets or production credentials.

Sensitive values include:

- `POSTGRES_URL`
- `AUTH_SECRET` / `NEXTAUTH_SECRET`
- `ADMIN_PASSWORD` / `ADMIN_SESSION_SECRET`
- AI provider keys
- Google OAuth credentials
- Gmail SMTP credentials
- VAPID private keys
- Cron secrets

Use `.env.local` for local development and hosting-provider environment variables for production.

## Admin And Impersonation

The `/admin` area is an internal operational console. Keep admin routes server-authorized and avoid exposing admin credentials, service-role logic, or raw secrets to the browser.

Account impersonation is for support and debugging only. Use it deliberately and avoid making user-visible changes unless explicitly required.
