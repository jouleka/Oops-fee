# Supabase backend

This directory contains the local Supabase configuration, ordered database migrations, and Deno Edge Functions used by OopsFee.

## Local setup

Install the Supabase CLI, then start or reset the local stack:

```bash
supabase start
supabase db reset
```

For a hosted project:

```bash
supabase login
supabase link --project-ref your-project-ref
supabase db push
```

Migrations are applied by filename order. Treat deployed migration files as immutable; add a new migration for schema or policy changes.

## Client configuration

Copy the repository's `.env.example` to `.env.local` and set the public Supabase URL and anon key. The anon key is designed for client use; authorization still depends on Row Level Security.

## Edge Function secrets

Set backend credentials with `supabase secrets set`. Required names vary by deployed feature and include:

```text
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
STRIPE_PUBLISHABLE_KEY
PAYPAL_CLIENT_ID
PAYPAL_CLIENT_SECRET
PAYPAL_WEBHOOK_ID
PAYPAL_ENVIRONMENT
RESEND_API_KEY
TWILIO_ACCOUNT_SID
TWILIO_AUTH_TOKEN
SETTLEMENT_CRON_SECRET
REENGAGEMENT_CRON_SECRET
LEADERBOARD_CRON_SECRET
SOCIAL_PROOF_CRON_SECRET
INSIGHTS_CRON_SECRET
IP_SALT
APP_URL
```

Use independent, randomly generated values for cron secrets and `IP_SALT`. Do not place these server values in the Expo root environment or prefix them with `EXPO_PUBLIC_`.

Deploy a function after its secrets are available:

```bash
supabase functions deploy function-name
```

Public share, claim, webhook, and scheduled endpoints require `verify_jwt = false` at deployment and then perform their own token, provider-signature, or cron-secret verification. Authenticated endpoints should keep Supabase JWT verification enabled and also verify the user in the handler.

## Data access

- User-owned tables and private storage buckets have Row Level Security policies.
- Public link operations run through Edge Functions using high-entropy tokens.
- Service-role access is confined to server-side Edge Functions.
- Stripe and PayPal webhooks verify provider signatures before database changes.

Review every new table, view, RPC, bucket, and `SECURITY DEFINER` function for explicit grants, a fixed `search_path`, and least-privilege policies.
