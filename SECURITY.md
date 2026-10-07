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

## Dependency replacements (October 2026)

Use Node.js 24.21.0 or the latest patched Node 24 LTS. Patched Node 22 releases
starting at 22.23.3 are also supported. The old system Node 22.18.0 is outside
the supported range. Keep Node/OpenSSL updated as well as npm dependencies.

The lockfile uses compatible patched releases, including image-size 2.0.4,
xmldom 0.9.12, sharp 0.35.5, decode-uri-component 0.5.0, and patched
brace-expansion versions. Reanimated remains pinned to 4.1.6 because 4.1.7
has an upstream high-severity advisory.

The two packages with no patched upstream release have been replaced:

- `braces` (GHSA-vfj7-8cjw-p6xm): actual glob expansion uses maintained
  brace-expansion 5.0.12 and matching/parsing uses Picomatch 4.0.7. The private
  `@oopsfee/glob-compat` helper preserves the Micromatch and Chokidar interfaces
  used by Expo, Metro, Tailwind, fast-glob and workspace discovery. It bounds
  input length, nesting, expansion count, numeric/cartesian ranges and output.
- `node-forge` (GHSA-86w9-cpqp-85rv): Expo certificate operations use maintained
  Peculiar X.509 2.1.0 with bounded ASN.1 parsing. Private-key operations and
  RSA SHA-256 signing/verification use Node crypto/OpenSSL and WebCrypto. The
  private `@oopsfee/expo-code-signing` helper implements the focused Expo
  certificate API; the CLI awaits asynchronous CSR generation. iOS signing
  identity parsing reads X.509 subject attributes directly.

Upstream Expo, Micromatch and Chokidar dependency manifests still reference
legacy module names. npm aliases at `braces`, `node-forge` and
`@expo/code-signing-certificates` resolve to the real registry tarballs of
brace-expansion or Peculiar X.509, with their canonical names and integrity
hashes preserved in the lockfile. They contain those maintained alternatives,
not renamed or version-modified copies of the vulnerable implementations.
Every reachable caller of the removed interfaces is migrated by a parent
patch. Expo's resolve-workspace-root 2.0.1 also bundled historical braces and
YAML outside the dependency graph; its installed entry is replaced completely
with the readable four-function workspace helper, using guarded matching and
declared current YAML dependencies. Its old bundled parser payload is removed.

Both private helpers are runtime dependencies, so production-only installs
retain them. `npm ci` applies six committed patches with
`patch-package --error-on-fail`: Micromatch, Chokidar, Expo CLI, workspace-root,
Metro (image-size v2 API), and query-string (maintained decoder import).
Do not use `--ignore-scripts`; a patch application failure must fail installation.

Run `npm run check` and `npm audit --audit-level=low`. CI also runs a fresh
`npm ci --omit=dev` followed by all security regressions to verify runtime
dependency availability. Regression coverage includes glob contracts and
resource bounds, watcher behavior, every workspace API, malformed RSA encodings,
certificate/CSR validity and signatures, and the actual offline Expo CLI
development-signing flow with a distinct issuer certificate. Provider and
credential-cache operations are stubbed in that integration test.

These focused tooling replacements keep Expo SDK 54's native dependency set.
Review the parent patches, API usage and replacement tests on every SDK or
tooling update; the helpers intentionally support the interfaces used here,
not the full historical Forge or braces APIs. See [security/README.md](security/README.md)
for the caller inventory and maintenance scope. Web and native JavaScript
exports do not replace Android/iOS device builds or real platform signing
validation. No advisory is dismissed or ignored to obtain a clean audit.
