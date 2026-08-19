# Security best-practices review

## Executive summary

The current tree and complete Git history were reviewed for credentials and private keys. No live credential was found. Two scanner matches are narrowly ignored because they are documented placeholders, not secrets. The app uses Supabase Row Level Security, verifies authenticated users before privileged user actions, and verifies Stripe and PayPal webhook signatures.

One IP-hashing configuration bug was remediated during this review. Two residual risks remain: an upstream `image-size` denial-of-service advisory with no patched release, and process-local throttling on public share endpoints. Neither is a reason to expose credentials or rewrite repository history, but both should remain visible to maintainers.

## High severity

### SEC-001 — Upstream image parser denial of service has no patched release

`image-size` is present transitively in the Expo development/build toolchain (`package-lock.json:9102`). GitHub reports two high-severity infinite-loop advisories affecting versions through 2.0.2 and currently lists no patched version. `npm audit` expands the same transitive issue across Expo/Metro packages and suggests incompatible framework downgrades rather than a safe patch.

Impact is limited primarily to developer or CI processing of attacker-controlled image files; it is not an application runtime image parser imported by OopsFee code. Do not process untrusted repository assets in privileged build environments. Keep Dependabot enabled and upgrade when Expo ships a compatible patched dependency. Do not force an Expo downgrade or incompatible major upgrade solely to silence the alert.

## Medium severity

### SEC-002 — Public endpoint throttling is process-local

The share and submission functions store counters in in-memory `Map` instances (`supabase/functions/get-share-context/index.ts:17-35`, `supabase/functions/submit-roast/index.ts:19-37`, and `supabase/functions/submit-sponsor/index.ts:18-36`). Counters reset when an Edge Function instance restarts and are not shared across instances.

The unguessable share token, revocation checks, input limits, and one-submission database checks reduce impact, but this is not a durable denial-of-service or brute-force control. Before high-volume production use, move throttling to a shared atomic store or an edge/WAF rate limit keyed by endpoint and salted client address.

## Low severity

### SEC-003 — Web sessions use browser local storage

The web adapter persists Supabase sessions in `localStorage` (`lib/supabase/client.ts:34-56`). This is a normal Supabase single-page-app pattern but makes tokens available to any successful same-origin script injection.

No unsafe HTML or dynamic-code execution sink was found in the reviewed client. Keep the Content Security Policy strict at the hosting layer, avoid third-party scripts, and reassess storage if the web threat model changes.

### SEC-004 — Native dependency compatibility needs device validation

Expo Doctor reports that `@stripe/stripe-react-native` 0.57.2 is newer than the Expo 54 recommended 0.50.3 (`package.json:22`) and that `react-native-shared-group-preferences` is unmaintained and untested on React Native's New Architecture (`package.json:58`). The latter supports the native widget integration, so removing it or switching off the New Architecture without an end-to-end device check would be riskier than leaving it visible.

Validate payment setup, payouts, and both widget targets on physical iOS and Android builds before release. Plan a maintained widget bridge and align Stripe during the next tested SDK upgrade.

## Remediated during this review

### SEC-005 — IP hashes used a predictable or ineffective fallback salt

The public endpoints previously fell back to a repository-known salt; one expression also applied nullish coalescing after string concatenation, so a missing secret produced `IP + "undefined"`. The shared helper now requires `IP_SALT`, hashes a delimited value, and fails closed (`supabase/functions/_shared/request-security.ts:15-27`). Public functions also return a generic server error instead of exposing configuration details.

### SEC-006 — Scheduled functions allowed requests when cron secrets were absent

Several scheduled handlers previously made cron authentication optional and treated missing configuration as authorization to continue. Cron authentication is now shared, uses a timing-safe comparison, returns 503 when no approved secret is configured, and returns 401 on mismatch (`supabase/functions/_shared/request-security.ts:28-70`). Every scheduled service-role handler calls it before database work; for example, settlement does so at `supabase/functions/settle-promises/index.ts:500-512`. The deployment configuration explicitly disables platform JWT verification only because these handlers enforce their separate cron Bearer credential (`supabase/config.toml:95-116`).

### SEC-007 — Username suggestions used insecure randomness

CodeQL flagged the numeric username-suggestion suffix because it used `Math.random()` in an identity-related flow. Suggestions now derive the suffix from Expo Crypto's UUID generator (`app/(mobile)/setup-username.tsx:123-128`). Database uniqueness checks remain authoritative; this change removes predictable client-side suggestion generation as well.

## Informational observations

- Native Supabase sessions use Expo SecureStore when possible (`lib/supabase/client.ts:41-68`).
- Public share tokens are generated with cryptographically secure random bytes and stored as SHA-256 hashes (`supabase/functions/create-share-link/index.ts:18-31`).
- Stripe and PayPal webhook handlers verify provider signatures before processing events (`supabase/functions/stripe-webhook/index.ts:25-46`, `supabase/functions/paypal-webhook/index.ts:68-83`).
- Apple Team ID, EAS project ID, package identifiers, Supabase URL, Supabase anon key, and Stripe publishable key are identifiers/public client configuration, not server credentials.
