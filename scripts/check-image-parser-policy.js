const { spawnSync } = require('node:child_process');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const verification = String.raw`
  require('./metro.config');
  const fs = require('node:fs');
  const { imageSize } = require('image-size');

  const payloads = {
    heif: new Uint8Array([
      0, 0, 0, 16, 0x66, 0x74, 0x79, 0x70, 0x61, 0x76, 0x69, 0x66, 0, 0, 0, 0,
      0, 0, 0, 36, 0x6d, 0x65, 0x74, 0x61, 0, 0, 0, 0,
      0, 0, 0, 8, 0x69, 0x70, 0x72, 0x70,
      0, 0, 0, 20, 0x69, 0x70, 0x63, 0x6f,
      0, 0, 0, 0, 0x69, 0x73, 0x70, 0x65,
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    ]),
    icns: new Uint8Array([
      0x69, 0x63, 0x6e, 0x73, 0, 0, 0, 16,
      0x69, 0x73, 0x33, 0x32, 0, 0, 0, 0,
    ]),
  };

  for (const [name, payload] of Object.entries(payloads)) {
    try {
      imageSize(payload);
      throw new Error(name + ' malicious payload was accepted');
    } catch (error) {
      if (!String(error.message).startsWith('disabled file type:')) throw error;
    }
  }

  const png = fs.readFileSync('assets/images/icon.png');
  const dimensions = imageSize(png);
  if (dimensions.type !== 'png' || !dimensions.width || !dimensions.height) {
    throw new Error('Normal PNG parsing regressed');
  }
`;

const result = spawnSync(process.execPath, ['-e', verification], {
  cwd: projectRoot,
  encoding: 'utf8',
  timeout: 2_000,
});

if (result.error) {
  throw result.error;
}

if (result.status !== 0) {
  process.stderr.write(result.stderr);
  process.exit(result.status ?? 1);
}

console.log('Unsafe image parsers are blocked; PNG parsing still works.');
