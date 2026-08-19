# OopsFee

OopsFee is a cross-platform accountability app: make a promise, put money at stake, choose how completion is verified, and let the app handle reminders and the outcome.

The client is built with Expo and React Native. Supabase provides authentication, PostgreSQL, storage, realtime updates, and Edge Functions. Stripe and PayPal integrations support payment-method setup and payout flows.

> [!IMPORTANT]
> This repository is under active development. Money movement, identity, tax, legal, and regional payout requirements must be reviewed before operating the app with real funds.

## What is included

- Email, Apple, and Google sign-in flows
- Promise creation, deadlines, reminders, and evidence capture
- Self, friend, and partner verification flows
- Share links, sponsor pledges, and roast messages
- Wallet, Stripe payment-method, and PayPal/card payout flows
- Friend activity and leaderboards
- iOS and Android widgets
- Supabase schema, Row Level Security policies, and Edge Functions

## Stack

- Expo 54, React Native 0.81, React 19, and TypeScript
- Expo Router and NativeWind
- Supabase Auth, PostgreSQL, Storage, Realtime, and Edge Functions
- Stripe and PayPal

## Local development

### Prerequisites

- Node.js 20 or newer
- npm
- Expo tooling through `npx`
- A Supabase project for authenticated and backend flows

### Setup

```bash
git clone https://github.com/jouleka/Oops-fee.git
cd Oops-fee
npm ci
cp .env.example .env.local
npm start
```

Fill in the three `EXPO_PUBLIC_*` values in `.env.local`. These values are compiled into the client and must only contain public client configuration.

Backend credentials such as the Supabase service-role key, Stripe secret key, webhook secrets, PayPal credentials, email/SMS credentials, cron secrets, and `IP_SALT` must be configured as Supabase Edge Function secrets. Never place them in an `EXPO_PUBLIC_*` variable or commit them to Git.

See [supabase/README.md](supabase/README.md) for database and Edge Function setup.

## Commands

| Command | Purpose |
| --- | --- |
| `npm start` | Start the Expo development server |
| `npm run ios` | Build and run the native iOS project |
| `npm run android` | Build and run the native Android project |
| `npm run web` | Start the web app |
| `npm run typecheck` | Run TypeScript checks |
| `npm run lint` | Run Expo ESLint |
| `npm run check` | Run typechecking and linting |

## Project layout

```text
app/                  Expo Router screens and routes
components/           Shared UI and feature components
context/              Application providers and auth state
hooks/                Reusable React hooks
lib/                  Supabase, Stripe, promises, wallet, and sharing clients
supabase/migrations/  Database schema and RLS migrations
supabase/functions/   Deno Edge Functions and shared server helpers
targets/              Native widget targets
```

## Security

The mobile client contains only public Supabase and Stripe identifiers. Server credentials belong in Supabase secrets. The repository runs CI, CodeQL, dependency review, and full-history secret scanning.

Please report vulnerabilities privately as described in [SECURITY.md](SECURITY.md). The current review and known residual risks are documented in [security_best_practices_report.md](security_best_practices_report.md).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). By contributing, you agree that your work is licensed under this repository's Apache License 2.0.

## License

Licensed under the [Apache License 2.0](LICENSE).
