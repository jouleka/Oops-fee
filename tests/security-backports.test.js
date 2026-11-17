const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');
test('Metro reads both in-memory and file assets with the maintained image-size API', async () => {
  const assets = require('../node_modules/metro/src/Assets.js');
  const png = fs.readFileSync(path.join(__dirname, '../assets/images/icon.png'));
  const size = assets.getAssetSize('png', png, 'icon.png');
  assert.ok(size.width > 0 && size.height > 0);
  const data = await assets.getAssetData(
    path.join(__dirname, '../assets/images/icon.png'), 'assets/images/icon.png', [], 'web', '/assets',
  );
  assert.equal(data.width, size.width);
  assert.equal(data.height, size.height);
});

test('the patched ICNS parser terminates on a zero-size element', () => {
  const result = spawnSync(process.execPath, ['-e', `
    const { imageSize } = require('image-size');
    const payload = new Uint8Array([0x69,0x63,0x6e,0x73,0,0,0,16,0x69,0x73,0x33,0x32,0,0,0,0]);
    try { imageSize(payload); process.exit(1); } catch { process.exit(0); }
  `], { cwd: path.join(__dirname, '..'), timeout: 2_000 });
  assert.ifError(result.error);
  assert.equal(result.status, 0);
});

test('patched URI decoding preserves route values and bounds malformed decoding', () => {
  const queryString = require('query-string');
  assert.equal(queryString.parse('token=%E2%98%83&name=Ada%20Lovelace').token, '☃');
  assert.equal(queryString.parse('name=Ada%20Lovelace').name, 'Ada Lovelace');
  const result = spawnSync(process.execPath, ['-e', `
    const decode = require('decode-uri-component').default;
    decode('%FF'.repeat(10_000));
  `], { cwd: path.join(__dirname, '..'), timeout: 2_000 });
  assert.ifError(result.error);
  assert.equal(result.status, 0);
});

const projectRoot = path.join(__dirname, '..');
const cliRoot = path.dirname(require.resolve('@expo/cli/package.json', { paths: [require.resolve('expo/package.json')] }));
const fromCaller = (name, caller) => require.resolve(name, {
  paths: [path.dirname(require.resolve(`${caller}/package.json`, { paths: [projectRoot, cliRoot] }))],
});
const packageVersion = (name, caller) => {
  let directory = path.dirname(fromCaller(name, caller));
  while (!fs.existsSync(path.join(directory, 'package.json')) || JSON.parse(fs.readFileSync(path.join(directory, 'package.json'))).name !== name) {
    directory = path.dirname(directory);
  }
  return JSON.parse(fs.readFileSync(path.join(directory, 'package.json'))).version;
};
// Lint tooling is absent from the production-only CI install.
const installed = name => { try { require.resolve(`${name}/package.json`, { paths: [projectRoot] }); return true; } catch { return false; } };
const atLeast = (version, minimum) => {
  const [a, b] = [version, minimum].map(value => value.split('-')[0].split('.').map(Number));
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i];
  return true;
};
const runIsolated = (source, timeout = 5_000) => spawnSync(process.execPath, ['--max-old-space-size=256', '-e', source], {
  cwd: projectRoot, timeout, encoding: 'utf8',
});

test('Expo callers resolve the patched undici, glob, minimatch and decode-uri-component releases', () => {
  assert.ok(atLeast(packageVersion('undici', '@expo/cli'), '6.29.1'), 'GHSA-2m5v-pch6-74hx and related undici fixes');
  for (const caller of ['@expo/cli', '@expo/config', '@expo/config-plugins', '@expo/fingerprint', '@expo/metro-config', '@bacons/apple-targets']) {
    assert.ok(atLeast(packageVersion('glob', caller), '14.0.2'), `${caller} glob (GHSA-3g3m-2fjr-6pw4)`);
  }
  for (const caller of ['@expo/fingerprint', '@typescript-eslint/typescript-estree'].filter(installed)) {
    assert.ok(atLeast(packageVersion('minimatch', caller), '11.0.1'), `${caller} minimatch (GHSA-g3hv-75wg-m249)`);
  }
  assert.ok(atLeast(packageVersion('decode-uri-component', 'query-string'), '0.5.1'), 'GHSA-qr28-fpjm-wq7f');
});

test('URI decoding of many distinct malformed percent runs stays linear', () => {
  const result = runIsolated(`
    const decode = require('decode-uri-component').default;
    let payload = '';
    for (let i = 0; i < 32000; i++) {
      payload += '%' + Math.floor(i / 256).toString(16).padStart(2, '0') + '%' + (i % 256).toString(16).padStart(2, '0') + 'x';
    }
    decode(payload + '%zz');
  `, 3_000);
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
});

test('an aborted Expo glob walk stops reading directories', async () => {
  const { glob } = require(fromCaller('glob', '@expo/config-plugins'));
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'oopsfee-abort-'));
  try {
    for (let i = 0; i < 40; i++) {
      fs.mkdirSync(path.join(directory, `d${i}`, 'x', 'y'), { recursive: true });
      fs.writeFileSync(path.join(directory, `d${i}`, 'x', 'y', 'file.txt'), '');
    }
    let reads = 0;
    const count = fn => (...args) => { reads++; return fn(...args); };
    const countingFs = {
      ...fs, readdir: count(fs.readdir), readdirSync: count(fs.readdirSync),
      promises: { ...fs.promises, readdir: count(fs.promises.readdir) },
    };
    const controller = new AbortController();
    const walk = glob('**/*.txt', { cwd: directory, signal: controller.signal, fs: countingFs });
    setImmediate(() => controller.abort());
    await assert.rejects(walk, { name: 'AbortError' });
    const readsAtAbort = reads;
    await new Promise(resolve => setTimeout(resolve, 300));
    assert.equal(reads, readsAtAbort, 'directory traversal continued after cancellation');
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('Expo glob and minimatch call sites keep their contracts on the patched majors', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'oopsfee-glob14-'));
  try {
    for (const file of ['app/index.tsx', 'app/api/hello+api.ts', 'app/+middleware.ts', 'ios/App/Info.plist', 'node_modules/x/package.json', 'pkg/package.json']) {
      fs.mkdirSync(path.join(directory, path.dirname(file)), { recursive: true });
      fs.writeFileSync(path.join(directory, file), '{}');
    }
    for (const caller of ['@expo/cli', '@expo/config', '@expo/config-plugins', '@expo/metro-config', '@bacons/apple-targets']) {
      const glob = require(fromCaller('glob', caller));
      assert.deepEqual(glob.sync('**/*+api.@(ts|tsx|js|jsx)', { cwd: path.join(directory, 'app') }), ['api/hello+api.ts']);
      assert.deepEqual(glob.globSync('ios/*/Info.plist', { cwd: directory, absolute: true }), [path.join(directory, 'ios/App/Info.plist')]);
      assert.deepEqual(glob.globSync('*/package.json', { cwd: directory, ignore: ['**/@(Carthage|Pods|node_modules)/**'] }), ['pkg/package.json']);
      assert.deepEqual((await glob.glob('+middleware.@(ts|tsx|js|jsx)', { cwd: path.join(directory, 'app') })), ['+middleware.ts']);
    }
    const { anyMatchAsync, everyMatchAsync } = require(path.join(cliRoot, 'build/src/utils/glob.js'));
    assert.equal((await anyMatchAsync('**/*.tsx', { cwd: directory, ignore: 'node_modules/**' })).length, 1);
    assert.equal((await everyMatchAsync('**/package.json', { cwd: directory, ignore: 'node_modules/**' })).length, 1);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
  const { isIgnoredPath } = require(fromCaller('@expo/fingerprint/build/utils/Path.js', '@expo/fingerprint'));
  assert.equal(isIgnoredPath('android/build/output.apk', ['android/build/**/*']), true);
  assert.equal(isIgnoredPath('android/app/build.gradle', ['android/build/**/*']), false);
  assert.equal(isIgnoredPath('ios/Pods/A/file', ['ios/Pods/**', '!ios/Pods/A/file']), false);
  if (installed('@typescript-eslint/typescript-estree')) {
    const { minimatch } = require(fromCaller('minimatch', '@typescript-eslint/typescript-estree'));
    assert.equal(minimatch('scripts/.tool.js', '**/*.js', { dot: true }), true);
  }
});

test('minimatch globparts amplification fails fast instead of exhausting memory', () => {
  const result = runIsolated(`
    const { Minimatch } = require(${JSON.stringify(fromCaller('minimatch', '@expo/fingerprint'))});
    try { new Minimatch('a/**/../'.repeat(40) + 'b', { optimizationLevel: 2 }); }
    catch (error) { if (!(error instanceof RangeError)) throw error; }
  `);
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
});
