const assert = require('node:assert/strict');
const fs = require('node:fs');
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
