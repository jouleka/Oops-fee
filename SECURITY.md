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

## Dependency backports (October 2026)

The lockfile uses current compatible patched releases, including image-size
2.0.4, xmldom 0.9.12, sharp 0.35.5, decode-uri-component 0.5.0, and the
matching patched brace-expansion major versions. Reanimated is pinned to
4.1.6 because 4.1.7 has an upstream high-severity advisory.

Two dependencies have no patched upstream release:

- `braces` 3.0.3: GHSA-vfj7-8cjw-p6xm. A committed patch bounds parser and
  AST walker nesting to 128, including callers that pass AST objects directly.
- `node-forge` 1.4.0: GHSA-86w9-cpqp-85rv. A committed patch rejects extra
  DigestAlgorithm children and nonempty NULL parameters during RSA verification.

The Metro patch adapts its byte and file image-size calls to the maintained
version 2 API. The query-string patch adapts its import to the patched
decode-uri-component ESM default export.
`npm ci` applies all four patches with `patch-package --error-on-fail`; a
patch application failure is an installation failure, not a silent skip. Run
`npm run check` after installation. Exploit regression tests cover the
backports, normal signatures and glob patterns, and Metro image parsing.
Do not install this application with `--ignore-scripts`, which skips backports.

**npm audit and Dependabot will continue to flag braces and node-forge and
propagate their findings to Expo/Metro/React Native/Tailwind.** These local
mitigations do not change upstream package versions or dismiss alerts. Replace
the patches with upstream releases when available and keep their regression
tests. This project stays on Expo SDK 54 for native-module compatibility;
Android/iOS native builds still need validation on their respective platforms.
