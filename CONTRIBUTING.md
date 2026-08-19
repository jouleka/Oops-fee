# Contributing

Thanks for helping improve OopsFee.

## Before opening a pull request

1. Create a focused branch from `main`.
2. Install the locked dependencies with `npm ci`.
3. Keep all credentials out of source, fixtures, screenshots, logs, and commit messages.
4. Run `npm run check`.
5. Describe user-visible behavior, database changes, and security implications in the pull request.

Database changes must be additive Supabase migrations. Do not edit an already-deployed migration to change production behavior.

For changes to authentication, payments, payouts, public share links, Row Level Security, or service-role Edge Functions, include a clear abuse-case review and manual verification notes.

## Reporting security issues

Do not open a public issue for a suspected vulnerability. Follow [SECURITY.md](SECURITY.md).
