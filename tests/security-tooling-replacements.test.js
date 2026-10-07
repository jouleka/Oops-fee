const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Module = require('node:module');
const { test, mock } = require('node:test');
const { spawnSync } = require('node:child_process');
const micromatch = require('micromatch');
const glob = require('@oopsfee/glob-compat');
const certificates = require('@oopsfee/expo-code-signing');
const x509 = require('@peculiar/x509');
const cliRoot = path.dirname(require.resolve('@expo/cli/package.json', { paths: [require.resolve('expo/package.json')] }));

test('maintained glob libraries preserve nested, escaped, range and negative matches', () => {
  assert.deepEqual(micromatch.braces('src/{app,components}/*.{ts,tsx}'), ['src/(app|components)/*.(ts|tsx)']);
  assert.deepEqual(micromatch.braceExpand('src/{app,{components,hooks}}/*.{ts,tsx}'), [
    'src/app/*.ts', 'src/app/*.tsx', 'src/components/*.ts', 'src/components/*.tsx', 'src/hooks/*.ts', 'src/hooks/*.tsx',
  ]);
  assert.deepEqual(micromatch.braceExpand('file-{01..05..2}.ts'), ['file-01.ts', 'file-03.ts', 'file-05.ts']);
  assert.deepEqual(micromatch.braceExpand('file-{3..-1..2}.ts'), ['file-3.ts', 'file-1.ts', 'file--1.ts']);
  assert.deepEqual(micromatch.braceExpand('{c..a}.ts'), ['c.ts', 'b.ts', 'a.ts']);
  assert.deepEqual(micromatch.braces(String.raw`src/\{literal\}/{a,b}/file\*.ts`, { expand: true, keepEscaping: true }), [
    String.raw`src/\{literal\}/a/file\*.ts`, String.raw`src/\{literal\}/b/file\*.ts`,
  ]);
  assert.deepEqual(micromatch.braceExpand('"{quoted,literal}"/{a,b}'), ['{quoted,literal}/a', '{quoted,literal}/b']);
  assert.deepEqual(micromatch.braceExpand('[{a,b}]/{x,y}'), ['[{a,b}]/x', '[{a,b}]/y']);
  assert.deepEqual(micromatch(['src/a.ts', 'src/b.tsx', 'src/c.js', 'src/test/a.ts'], ['src/**/*.{ts,tsx}', '!src/test/**']), ['src/a.ts', 'src/b.tsx']);
  assert.equal(micromatch.some('src/a.ts', ['**/*.tsx', '**/*.ts']), true);
  assert.equal(micromatch.matcher('**/*.{ts,tsx}')('src/file.tsx'), true);
  assert.deepEqual(micromatch.braceExpand('{a,a,b}', { nodupes: true }), ['a', 'b']);
});

test('Micromatch parse keeps its array-of-parser-states contract and regex matching semantics', () => {
  const states = micromatch.parse(['src/{app,hooks}/**/*.{ts,tsx}', 'file-{1..3}.ts']);
  assert.equal(states.length, 2);
  for (const state of states) assert.equal(typeof state.output, 'string');
  assert.equal(glob.picomatch.compileRe(states[0]).test('src/app/index.tsx'), true);
  assert.equal(glob.picomatch.compileRe(states[0]).test('src/other/index.tsx'), false);
  assert.equal(glob.picomatch.compileRe(states[1]).test('file-2.ts'), true);
  assert.equal(glob.picomatch.compileRe(states[1]).test('file-4.ts'), false);
  const expanded = micromatch.parse('src/{app,hooks}/*.ts', { expand: true });
  assert.equal(expanded.length, 2);
  assert.equal(glob.picomatch.compileRe(expanded[0]).test('src/app/file.ts'), true);
});

test('hostile glob inputs stop before recursion or excessive numeric/cartesian expansion', () => {
  for (const [open, close] of [['{', '}'], ['(', ')']]) {
    const pattern = open.repeat(4_000) + 'x' + close.repeat(4_000);
    for (const method of ['parse', 'braces', 'braceExpand', 'makeRe', 'matcher']) {
      assert.throws(() => micromatch[method](pattern), /security limit/);
    }
  }
  assert.throws(() => micromatch.braceExpand('{1..1000000000}'), /security limit/);
  assert.throws(() => micromatch.braceExpand('{a,b}'.repeat(20)), /security limit/);
  assert.throws(() => micromatch.braceExpand('{1..1001}', { rangeLimit: false }), /security limit/);
  assert.throws(() => micromatch.braces('x'.repeat(10_001)), /security limit/);
  assert.throws(() => micromatch.braceExpand(`{a,b}${'x'.repeat(6_000)}`.replace('{a,b}', '{1..200}')), /security limit/);
  const result = spawnSync(process.execPath, ['-e', `
    const mm = require('micromatch');
    try { mm.braceExpand('{1..1000000000}'); process.exit(1); }
    catch (error) { if (!(error instanceof RangeError)) throw error; }
  `], { cwd: path.join(__dirname, '..'), timeout: 2_000 });
  assert.ifError(result.error);
  assert.equal(result.status, 0);
});

test('Chokidar watches brace-expanded files and ignores nonmatching files', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'oopsfee-glob-'));
  const watcher = require('chokidar').watch(`${directory.replaceAll('\\', '/')}/{one,two}/*.{ts,tsx}`, { ignoreInitial: false });
  try {
    fs.mkdirSync(path.join(directory, 'one'));
    fs.mkdirSync(path.join(directory, 'two'));
    fs.writeFileSync(path.join(directory, 'one', 'entry.ts'), 'export {};');
    fs.writeFileSync(path.join(directory, 'two', 'entry.tsx'), 'export {};');
    fs.writeFileSync(path.join(directory, 'two', 'ignored.js'), '');
    const files = [];
    watcher.on('add', value => files.push(value.replaceAll('\\', '/')));
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('watcher did not become ready')), 5_000);
      watcher.once('ready', () => { clearTimeout(timeout); resolve(); });
      watcher.once('error', reject);
    });
    assert.equal(files.length, 2);
    assert.ok(files.some(value => value.endsWith('/one/entry.ts')));
    assert.ok(files.some(value => value.endsWith('/two/entry.tsx')));
    const fastGlob = require('fast-glob');
    assert.deepEqual(fastGlob.sync('{one,two}/*.{ts,tsx}', { cwd: directory }).sort(), ['one/entry.ts', 'two/entry.tsx']);
  } finally {
    await watcher.close();
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

const keyPair = certificates.generateKeyPair();
const commonName = 'Local certificate regression, "quoted" ü';
const validCertificate = certificates.generateSelfSignedCodeSigningCertificate({
  keyPair, commonName, validityNotBefore: new Date(Date.now() - 60_000), validityNotAfter: new Date(Date.now() + 86_400_000),
});

test('Expo manifest signing interoperates with Node/OpenSSL and WebCrypto without Forge', async () => {
  const certificate = await validCertificate;
  certificates.validateSelfSignedCertificate(certificate, keyPair);
  const pem = certificates.convertCertificateToCertificatePEM(certificate);
  const parsed = certificates.convertCertificatePEMToCertificate(pem);
  certificates.validateSelfSignedCertificate(parsed, certificates.convertKeyPairPEMToKeyPair(certificates.convertKeyPairToPEM(keyPair)));
  assert.equal(parsed.x509.subjectName.getField('CN')[0], commonName);
  const body = Buffer.from('{"manifest":"local regression"}');
  const signature = Buffer.from(certificates.signBufferRSASHA256AndVerify(keyPair.privateKey, parsed, body), 'base64');
  assert.equal(crypto.verify('sha256', body, new crypto.X509Certificate(pem).publicKey, signature), true);
  assert.equal(crypto.verify('sha256', Buffer.from('changed manifest'), parsed.publicKey, signature), false);
  const publicKey = await crypto.webcrypto.subtle.importKey('spki', parsed.publicKey.export({ type: 'spki', format: 'der' }), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  assert.equal(await crypto.webcrypto.subtle.verify('RSASSA-PKCS1-v1_5', publicKey, signature, body), true);
  const cryptoSignature = crypto.sign('sha256', body, keyPair.privateKey);
  assert.equal(await crypto.webcrypto.subtle.verify('RSASSA-PKCS1-v1_5', publicKey, cryptoSignature, body), true);
  const cli = require(path.join(cliRoot, 'build/src/utils/codesigning.js'));
  assert.equal(cli.signManifestString(body.toString(), { privateKey: certificates.convertKeyPairToPEM(keyPair).privateKeyPEM, certificateForPrivateKey: pem }), signature.toString('base64'));
});

test('native RSA verification rejects both reported malformed DigestAlgorithm encodings', async () => {
  const { publicKey, privateKey } = keyPair;
  const payload = Buffer.from('security regression');
  const hash = crypto.createHash('sha256').update(payload).digest();
  const der = (tag, bytes) => Buffer.concat([Buffer.from([tag, bytes.length]), bytes]);
  const oid = Buffer.from('0609608648016503040201', 'hex');
  for (const mode of ['extra-child', 'nonempty-null']) {
    const algorithm = der(0x30, Buffer.concat([oid, der(0x05, mode === 'nonempty-null' ? Buffer.from('garbage') : Buffer.alloc(0)), ...(mode === 'extra-child' ? [der(0x04, Buffer.from('garbage'))] : [])]));
    const digestInfo = der(0x30, Buffer.concat([algorithm, der(0x04, hash)]));
    const encoded = Buffer.concat([Buffer.from([0, 1]), Buffer.alloc(256 - digestInfo.length - 3, 0xff), Buffer.from([0]), digestInfo]);
    const malformed = crypto.privateEncrypt({ key: privateKey, padding: crypto.constants.RSA_NO_PADDING }, encoded);
    assert.equal(crypto.verify('sha256', payload, publicKey, malformed), false);
  }
});

test('CSR generation and development certificates preserve RSA signatures, scope extension and validity', async () => {
  const issuer = await validCertificate;
  const csr = await certificates.generateCSR(keyPair, commonName);
  const parsed = certificates.convertCSRPEMToCSR(certificates.convertCSRToCSRPEM(csr));
  assert.equal(await parsed.verify(crypto.webcrypto), true);
  assert.equal(parsed.subjectName.getField('CN')[0], commonName);
  const certificate = await certificates.generateDevelopmentCertificateFromCSR(keyPair.privateKey, issuer, parsed, 'test-app-id', '@local/test-scope');
  assert.equal(certificate.native.verify(issuer.publicKey), true);
  assert.equal(certificate.x509.subjectName.getField('CN')[0], commonName);
  assert.equal(Buffer.from(certificate.x509.getExtension(certificates.expoProjectInformationOID).value).toString('utf8'), 'test-app-id,@local/test-scope');
  assert.equal(certificate.validity.notAfter - certificate.validity.notBefore, 30 * 86_400_000);
  assert.equal(certificate.x509.getExtension(x509.KeyUsagesExtension).usages, x509.KeyUsageFlags.digitalSignature);
  assert.deepEqual(Array.from(certificate.x509.getExtension(x509.ExtendedKeyUsageExtension).usages), [x509.ExtendedKeyUsage.codeSigning]);
  const tampered = Buffer.from(csr.rawData);
  tampered[tampered.length - 1] ^= 1;
  await assert.rejects(certificates.generateDevelopmentCertificateFromCSR(keyPair.privateKey, issuer, new x509.Pkcs10CertificateRequest(tampered), 'app', 'scope'), /CSR not self-signed/);
  const wrongKey = certificates.generateKeyPair();
  await assert.rejects(certificates.generateDevelopmentCertificateFromCSR(wrongKey.privateKey, issuer, parsed, 'app', 'scope'), /does not match/);
});

test('certificate validation rejects expired/future dates, missing usages, mismatched keys and non-RSA CSRs', async () => {
  for (const [before, after] of [[-172_800_000, -86_400_000], [86_400_000, 172_800_000]]) {
    const certificate = await certificates.generateSelfSignedCodeSigningCertificate({ keyPair, commonName: 'time regression', validityNotBefore: new Date(Date.now() + before), validityNotAfter: new Date(Date.now() + after) });
    assert.throws(() => certificates.validateSelfSignedCertificate(certificate, keyPair), /validity expired/);
  }
  const pair = await crypto.webcrypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]) }, true, ['sign', 'verify']);
  for (const extensions of [[], [new x509.KeyUsagesExtension(x509.KeyUsageFlags.digitalSignature, true)]]) {
    const bad = await x509.X509CertificateGenerator.createSelfSigned({ name: 'CN=missing usage', keys: pair, extensions }, crypto.webcrypto);
    assert.throws(() => certificates.validateSelfSignedCertificate(certificates.convertCertificatePEMToCertificate(bad.toString('pem')), { privateKey: crypto.KeyObject.from(pair.privateKey), publicKey: crypto.KeyObject.from(pair.publicKey) }), /not present/);
  }
  const cachedCertificate = await validCertificate;
  assert.throws(() => certificates.validateSelfSignedCertificate(cachedCertificate, certificates.generateKeyPair()), /does not match/);
  assert.throws(() => certificates.signBufferRSASHA256AndVerify(certificates.generateKeyPair().privateKey, cachedCertificate, Buffer.from('manifest')), /not valid for certificate/);
  const tamperedCertificate = Buffer.from(cachedCertificate.native.raw);
  tamperedCertificate[tamperedCertificate.length - 1] ^= 1;
  assert.throws(() => certificates.validateSelfSignedCertificate(certificates.convertCertificatePEMToCertificate(tamperedCertificate), keyPair), /signature not valid/);
  const ec = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  assert.throws(() => certificates.convertPublicKeyPEMToPublicKey(ec.publicKey.export({ type: 'spki', format: 'pem' })), /RSA/);
  await assert.rejects(certificates.generateCSR(ec, 'non-RSA regression'), /RSA/);
  const ecKeys = await crypto.webcrypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const ecCSR = await x509.Pkcs10CertificateRequestGenerator.create({ name: 'CN=EC request', keys: ecKeys, signingAlgorithm: { name: 'ECDSA', hash: 'SHA-256' } }, crypto.webcrypto);
  assert.throws(() => certificates.convertCSRPEMToCSR(ecCSR.toString('pem')), /RSA/);
  await assert.rejects(certificates.generateDevelopmentCertificateFromCSR(keyPair.privateKey, cachedCertificate, ecCSR, 'app', 'scope'), /RSA/);
  assert.throws(() => certificates.convertCSRPEMToCSR('x'.repeat(100_001)), /security limit/);
});

test('Peculiar CSR parsing enforces the configured ASN.1 depth limit', () => {
  let nested = Buffer.from([0x05, 0]);
  for (let level = 0; level < 100; level++) {
    const length = nested.length < 128 ? Buffer.from([nested.length]) : Buffer.from([0x82, nested.length >> 8, nested.length & 0xff]);
    nested = Buffer.concat([Buffer.from([0x30]), length, nested]);
  }
  assert.throws(() => certificates.convertCSRPEMToCSR(nested), /depth|maxDepth|nesting/i);
});

test('iOS identity parsing reads maintained X.509 subject attributes without contacting a provider', async () => {
  const certificate = await validCertificate;
  const pem = certificates.convertCertificateToCertificatePEM(certificate);
  const originalLoad = Module._load;
  const load = mock.method(Module, '_load', function (request, ...args) {
    if (request === '@expo/spawn-async') return async () => ({ stdout: pem });
    return originalLoad.call(this, request, ...args);
  });
  try {
    const cli = require(path.join(cliRoot, 'build/src/run/ios/codeSigning/Security.js'));
    const info = await cli.resolveCertificateSigningInfoAsync('LOCAL-TEST-ID');
    assert.equal(info.codeSigningInfo, commonName);
    assert.equal(info.appleTeamName, undefined);
    assert.equal(info.appleTeamId, undefined);
  } finally { load.mock.restore(); }
});

test('all four workspace APIs preserve package, Yarn and pnpm contracts with guarded patterns', async () => {
  const workspace = require('resolve-workspace-root');
  assert.deepEqual(Object.keys(workspace).sort(), ['getWorkspaceGlobs', 'getWorkspaceGlobsAsync', 'resolveWorkspaceRoot', 'resolveWorkspaceRootAsync']);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'oops-workspace-'));
  const included = path.join(root, 'packages', 'mobile');
  const excluded = path.join(root, 'packages', 'excluded');
  fs.mkdirSync(included, { recursive: true });
  fs.mkdirSync(excluded, { recursive: true });
  const jsonFile = path.join(root, 'package.json');
  const yamlFile = path.join(root, 'pnpm-workspace.yaml');
  const globs = ['packages/{mobile,web}', '!packages/excluded'];
  try {
    fs.writeFileSync(jsonFile, JSON.stringify({ workspaces: { packages: globs } }));
    assert.deepEqual(workspace.getWorkspaceGlobs(root), globs);
    assert.deepEqual(await workspace.getWorkspaceGlobsAsync(root), globs);
    assert.equal(workspace.resolveWorkspaceRoot(included), root);
    assert.equal(await workspace.resolveWorkspaceRootAsync(included), root);
    assert.equal(workspace.resolveWorkspaceRoot(excluded), null);
    assert.equal(await workspace.resolveWorkspaceRootAsync(excluded), null);
    assert.equal(workspace.resolveWorkspaceRoot(root), root);
    assert.equal(await workspace.resolveWorkspaceRootAsync(root), root);
    assert.equal(workspace.getWorkspaceGlobs(root, { packageWorkspaces: false, pnpmWorkspaces: false }), null);
    assert.equal(await workspace.resolveWorkspaceRootAsync(included, { packageWorkspaces: false, pnpmWorkspaces: false }), null);
    fs.writeFileSync(yamlFile, 'packages:\n  - apps/*\n  - "!apps/excluded"\n');
    assert.deepEqual(workspace.getWorkspaceGlobs(root), ['apps/*', '!apps/excluded']);
    assert.deepEqual(await workspace.getWorkspaceGlobsAsync(root), ['apps/*', '!apps/excluded']);
    // Nonmatching pnpm patterns still allow a matching package workspace.
    assert.equal(workspace.resolveWorkspaceRoot(included), root);
    assert.equal(await workspace.resolveWorkspaceRootAsync(included), root);
    fs.writeFileSync(yamlFile, 'packages: [invalid');
    assert.deepEqual(workspace.getWorkspaceGlobs(root), globs);
    fs.writeFileSync(jsonFile, '{ invalid JSON');
    assert.equal(await workspace.getWorkspaceGlobsAsync(root), null);
    // Exercise both manifest formats and root-empty-relative-path shortcuts.
    for (const payload of ['{'.repeat(4_000), 'x'.repeat(10_001), 'packages/{1..1000000000}', '{a,b}'.repeat(11), 'bad\0glob']) {
      for (const format of ['json', 'yaml']) {
        fs.writeFileSync(jsonFile, JSON.stringify({ workspaces: format === 'json' ? [payload] : globs }));
        fs.writeFileSync(yamlFile, format === 'yaml' ? `packages:\n  - ${JSON.stringify(payload)}\n` : '');
        assert.throws(() => workspace.getWorkspaceGlobs(root), /security limit/);
        await assert.rejects(workspace.getWorkspaceGlobsAsync(root), /security limit/);
        assert.throws(() => workspace.resolveWorkspaceRoot(root), /security limit/);
        await assert.rejects(workspace.resolveWorkspaceRootAsync(root), /security limit/);
        assert.throws(() => workspace.resolveWorkspaceRoot(included), /security limit/);
        await assert.rejects(workspace.resolveWorkspaceRootAsync(included), /security limit/);
      }
    }
    fs.writeFileSync(yamlFile, '');
    fs.writeFileSync(jsonFile, JSON.stringify({ workspaces: Array(1_001).fill('packages/*') }));
    assert.throws(() => workspace.getWorkspaceGlobs(root), /count exceeds security limit/);
    await assert.rejects(workspace.resolveWorkspaceRootAsync(root), /count exceeds security limit/);
    const installedEntry = fs.readFileSync(require.resolve('resolve-workspace-root'), 'utf8');
    assert.match(installedEntry, /@oopsfee\/glob-compat\/workspace\.cjs/);
    assert.doesNotMatch(installedEntry, /braces\.parse|__nccwpck_require__|MAX_LENGTH/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('actual Expo development signing awaits the CSR and preserves a distinct issuer chain offline', async () => {
  const issuerKeys = certificates.generateKeyPair();
  const issuer = await certificates.generateSelfSignedCodeSigningCertificate({
    keyPair: issuerKeys, commonName: 'Offline test issuer',
    validityNotBefore: new Date(Date.now() - 60_000), validityNotAfter: new Date(Date.now() + 86_400_000),
  });
  const cliFile = path.join(cliRoot, 'build/src/utils/codesigning.js');
  let csr, leaf, cached;
  const stubs = {
    './env': { env: { EXPO_OFFLINE: false } },
    '../api/user/actions': { tryGetUserAsync: async () => ({ __typename: 'User', primaryAccount: { id: 'local-account' }, accounts: [] }) },
    '../api/graphql/queries/AppQuery': { AppQuery: { byIdAsync: async () => ({ ownerAccount: { id: 'local-account' }, scopeKey: '@local/synthetic' }) } },
    '../api/getExpoGoIntermediateCertificate': { getExpoGoIntermediateCertificateAsync: async () => certificates.convertCertificateToCertificatePEM(issuer) },
    '../api/getProjectDevelopmentCertificate': { getProjectDevelopmentCertificateAsync: async (projectId, csrPEM) => {
      assert.equal(projectId, 'local-synthetic-project');
      assert.equal(typeof csrPEM, 'string');
      csr = certificates.convertCSRPEMToCSR(csrPEM);
      assert.equal(await csr.verify(crypto.webcrypto), true);
      leaf = await certificates.generateDevelopmentCertificateFromCSR(issuerKeys.privateKey, issuer, csr, projectId, '@local/synthetic');
      return certificates.convertCertificateToCertificatePEM(leaf);
    } },
  };
  const originalLoad = Module._load;
  const load = mock.method(Module, '_load', function (request, parent, ...args) {
    if (parent?.filename === cliFile && Object.hasOwn(stubs, request)) return stubs[request];
    return originalLoad.call(this, request, parent, ...args);
  });
  // Load a separate instance so earlier manifest-signing checks do not cache real provider imports.
  const previousModule = require.cache[cliFile];
  delete require.cache[cliFile];
  try {
    const cli = require(cliFile);
    mock.method(cli.DevelopmentCodeSigningInfoFile, 'readAsync', async () => ({ easProjectId: null, scopeKey: null, privateKey: null, certificateChain: null }));
    mock.method(cli.DevelopmentCodeSigningInfoFile, 'setAsync', async (projectId, info) => {
      assert.equal(projectId, 'local-synthetic-project');
      cached = info;
    });
    const info = await cli.getCodeSigningInfoAsync({ extra: { eas: { projectId: 'local-synthetic-project' } } }, 'keyid="expo-root", alg="rsa-v1_5-sha256"');
    assert.equal(info.keyId, 'expo-go');
    assert.equal(info.scopeKey, '@local/synthetic');
    assert.equal(info.certificateChainForResponse.length, 2);
    assert.equal(cached.certificateChain[0], info.certificateForPrivateKey);
    assert.equal(leaf.native.verify(issuer.publicKey), true);
    const leafDER = leaf.publicKey.export({ type: 'spki', format: 'der' });
    assert.equal(leafDER.equals(Buffer.from(csr.publicKey.rawData)), true);
    assert.equal(leafDER.equals(issuer.publicKey.export({ type: 'spki', format: 'der' })), false);
    const body = '{"manifest":"offline integration regression"}';
    assert.equal(crypto.verify('sha256', Buffer.from(body), leaf.publicKey, Buffer.from(cli.signManifestString(body, info), 'base64')), true);
  } finally {
    load.mock.restore();
    delete require.cache[cliFile];
    if (previousModule) require.cache[cliFile] = previousModule;
  }
});

test('lockfile aliases resolve canonical maintained tarballs instead of vulnerable packages', () => {
  const lock = require('../package-lock.json');
  for (const [location, entry] of Object.entries(lock.packages)) {
    if (/(?:^|\/)node_modules\/braces$/.test(location)) {
      assert.equal(entry.name, 'brace-expansion');
      assert.match(entry.resolved, /brace-expansion-5\.0\.12\.tgz$/);
    }
    if (/(?:^|\/)node_modules\/node-forge$/.test(location)) {
      assert.equal(entry.name, '@peculiar/x509');
      assert.match(entry.resolved, /x509-2\.1\.0\.tgz$/);
    }
  }
  for (const [name, parent, expected] of [
    ['braces', path.dirname(require.resolve('micromatch')), 'brace-expansion'],
    ['node-forge', cliRoot, '@peculiar/x509'],
    ['@expo/code-signing-certificates', cliRoot, '@peculiar/x509'],
  ]) {
    let directory = path.dirname(require.resolve(name, { paths: [parent] }));
    for (;;) {
      const packagePath = path.join(directory, 'package.json');
      if (fs.existsSync(packagePath) && JSON.parse(fs.readFileSync(packagePath)).name) {
        assert.equal(JSON.parse(fs.readFileSync(packagePath)).name, expected);
        break;
      }
      const parentDirectory = path.dirname(directory);
      assert.notEqual(directory, parentDirectory, 'canonical package metadata missing');
      directory = parentDirectory;
    }
  }
});
