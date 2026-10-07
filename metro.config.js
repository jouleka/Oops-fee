const { getDefaultConfig } = require('expo/metro-config');
const { disableUnsafeImageTypes } = require('./scripts/image-parser-policy');
const { withNativeWind } = require('nativewind/metro');

// image-size <= 2.0.2 can loop forever on malformed ISO BMFF/JXL/ICNS
// assets. Keep the conservative asset policy alongside the patched parser.
disableUnsafeImageTypes();

const config = getDefaultConfig(__dirname);

module.exports = withNativeWind(config, { input: './global.css' });
