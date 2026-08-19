# Security policy

## Supported versions

Security fixes are applied to the current `main` branch. No released version line is currently guaranteed long-term support.

## Reporting a vulnerability

Use GitHub's **Report a vulnerability** button in the repository Security tab. Please include:

- The affected route, function, or file
- Reproduction steps or a minimal proof of concept
- The impact you observed
- Any suggested mitigation

Do not include real user data, payment details, access tokens, API keys, or private keys in the report. Please do not open a public issue before a fix is available.

## Credential handling

Only public client configuration may use `EXPO_PUBLIC_*` variables. Supabase service-role keys, payment-provider secrets, webhook signing secrets, cron secrets, email/SMS credentials, and `IP_SALT` must be stored as Supabase Edge Function secrets and rotated if exposure is suspected.
