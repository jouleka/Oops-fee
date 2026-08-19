const { getDefaultConfig } = require('expo/metro-config');
const { disableTypes } = require('image-size');
const { withNativeWind } = require('nativewind/metro');

// image-size <= 2.0.2 can loop forever on malformed ISO BMFF/JXL/ICNS
// assets. Metro only needs the common web/mobile formats used by this app, so
// fail closed for the affected parsers until Expo ships a patched dependency.
disableTypes(['heif', 'icns', 'j2c', 'jp2', 'jxl', 'jxl-stream']);

const config = getDefaultConfig(__dirname);

module.exports = withNativeWind(config, { input: './global.css' });
