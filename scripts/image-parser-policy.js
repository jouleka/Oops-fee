const { disableTypes } = require('image-size');

function disableUnsafeImageTypes() {
  // Keep the conservative Metro asset policy even after upgrading the parser.
  disableTypes(['heif', 'icns', 'j2c', 'jp2', 'jxl', 'jxl-stream']);
}

module.exports = { disableUnsafeImageTypes };
