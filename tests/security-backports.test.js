const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');
const braces = require('braces');
const forge = require('node-forge');

test('deep brace and parentheses patterns fail with a controlled error', () => {
  for (const [open, close] of [['{', '}'], ['(', ')']]) {
    // Stay below the upstream 10,000-character cap: length alone did not
    // prevent the reported stack-exhaustion attack.
    const pattern = open.repeat(4_000) + 'x' + close.repeat(4_000);
    for (const method of ['parse', 'compile', 'expand', 'stringify']) {
      assert.throws(() => braces[method](pattern), { name: 'SyntaxError', message: /security limit/ });
    }
  }
  assert.deepEqual(braces.expand('src/{app,components}/*.{ts,tsx}'), [
    'src/app/*.ts', 'src/app/*.tsx', 'src/components/*.ts', 'src/components/*.tsx',
  ]);
});

test('direct AST input cannot bypass the nesting bound', () => {
  const ast = { type: 'root', nodes: [] };
  let node = ast;
  for (let i = 0; i < 1_000; i++) {
    const child = { type: 'paren', nodes: [], parent: node };
    node.nodes.push(child);
    node = child;
  }
  for (const method of ['compile', 'expand', 'stringify']) {
    assert.throws(() => braces[method](ast), { name: 'SyntaxError', message: /security limit/ });
  }
});

test('RSA verification rejects nested DigestAlgorithm garbage and nonempty NULL parameters', () => {
  const keys = forge.pki.rsa.generateKeyPair({ bits: 1024, e: 0x10001 });
  const digest = forge.md.sha256.create().update('security regression');
  const signature = keys.privateKey.sign(digest);
  const hash = digest.digest().getBytes();
  assert.equal(keys.publicKey.verify(hash, signature), true);

  for (const malformedParameter of ['extra-child', 'nonempty-null']) {
    const asn1 = forge.asn1;
    const algorithm = asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
      asn1.create(asn1.Class.UNIVERSAL, asn1.Type.OID, false, asn1.oidToDer(forge.oids.sha256).getBytes()),
      asn1.create(asn1.Class.UNIVERSAL, asn1.Type.NULL, false, malformedParameter === 'nonempty-null' ? 'garbage' : ''),
    ]);
    if (malformedParameter === 'extra-child') {
      algorithm.value.push(asn1.create(asn1.Class.UNIVERSAL, asn1.Type.OCTETSTRING, false, 'garbage'));
    }
    const info = asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
      algorithm, asn1.create(asn1.Class.UNIVERSAL, asn1.Type.OCTETSTRING, false, hash),
    ]);
    const malformedSignature = keys.privateKey.sign(asn1.toDer(info).getBytes(), 'NONE');
    assert.throws(() => keys.publicKey.verify(hash, malformedSignature), /DigestInfo/);
  }
});

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
