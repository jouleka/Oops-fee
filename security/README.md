# Tooling replacement maintenance

These private runtime packages replace focused interfaces inside the pinned
Expo SDK 54 tooling. They are application adapters to maintained libraries,
not forks of Forge or braces. Review this inventory and rerun both clean full
and production-only installations whenever a parent dependency changes.

## Glob callers

| Parent | Interface used | Replacement |
| --- | --- | --- |
| Micromatch 4.0.8 | callable matching, `matcher`, `some`, `isMatch`, `scan`, `makeRe`; `braces`, `braceExpand`; `parse` returns an array of parser states | Existing Micromatch wrapper uses guarded Picomatch 4.0.7 and bounded brace-expansion 5.0.12 adapter |
| Chokidar 3.6.0 | `braces.expand` before watching paths | Same bounded expander; watcher API unchanged |
| fast-glob | Micromatch `braces` with expansion/escaping options, `scan`, `makeRe` | Patched Micromatch |
| Metro and Jest file watching | Micromatch callable/`some` | Patched Micromatch |
| Tailwind content scanning/watching | Micromatch `matcher`/`some` | Patched Micromatch |
| Workspace discovery | `resolveWorkspaceRoot`, `resolveWorkspaceRootAsync`, `getWorkspaceGlobs`, `getWorkspaceGlobsAsync` | Readable `glob-compat/workspace.cjs`; no historical bundled parser remains in the installed entry |

The glob adapter caps input at 10,000 characters, combined brace/parenthesis
nesting at 128, expansion at 1,000 results, and combined expansion output at
1,000,000 characters. It computes expansion budgets before calling the
maintained library, including numeric ranges and cartesian products. Options
cannot disable these limits. Workspace APIs validate all returned patterns
before root shortcuts and cap a manifest's glob list at 1,000. JSON/YAML parse
error handling does not swallow security-limit exceptions.

The adapter supplies the interfaces above and `braces.compile`/`braces.expand`.
It does not implement the old braces AST parse/stringify/create APIs because
no installed reachable caller uses them. The lockfile's legacy `braces`
module addresses resolve canonical brace-expansion tarballs; actual callers
import the focused adapter instead of assuming the alias has a braces API.

## Certificate callers

| Parent | Interface used | Replacement |
| --- | --- | --- |
| Expo CLI `utils/codesigning.js` | Key/PEM conversions, certificate validation, RSA manifest signing, CSR generation | `@oopsfee/expo-code-signing`; CSR generation is awaited |
| Expo CLI iOS `codeSigning/Security.js` | Parse identity PEM and read common name, organization and team ID | Peculiar X.509 `subjectName.getField` |

Native Node KeyObjects, OpenSSL and WebCrypto perform key generation,
signing and verification. Peculiar provides certificate/CSR encoding and
decoding; parsing has explicit ASN.1 depth/node/content limits. Certificates
retain RSA public keys, validity, signing usages, code-signing usage, issuer
signatures and Expo scope extensions. Requests with non-RSA keys, invalid
CSR signatures or mismatched issuer keys are rejected.

`generateCSR`, `generateSelfSignedCodeSigningCertificate`, and
`generateDevelopmentCertificateFromCSR` are asynchronous. The current Expo
CLI's only reachable generator caller awaits `generateCSR`; all generator
and converter exports have direct tests. This package does not expose a
Forge-shaped cryptography API. Legacy `node-forge` and
`@expo/code-signing-certificates` module addresses resolve canonical Peculiar
X.509 tarballs; callers of the old certificate helper interface import the
private helper explicitly.

## Verification and update procedure

Use patched Node 24 LTS (24.21.0 or newer); patched Node 22.23.3 or newer in
the Node 22 line is also supported. Run `npm ci`, `npm run check`, and
`npm audit --audit-level=low`; repeat security tests after a clean
`npm ci --omit=dev`. Expo web/iOS/Android JavaScript exports should succeed.
Device builds and real iOS signing require their platform toolchains.

All six parent patches must apply successfully. Before accepting an Expo or
tooling update, search the installed graph for all Forge/braces imports and
bundled parsers, compare call sites with this inventory, inspect the lockfile's
canonical package names/tarballs, and rerun the offline distinct-issuer CLI
signing and workspace/watcher contract tests. Preserve the resource bounds
when adding any new interface; do not map unsupported legacy APIs silently.
