/** @type {import('@bacons/apple-targets').Config} */
module.exports = {
  type: 'widget',
  name: 'OopsFeeWidget',
  bundleIdentifier: '.widget',
  entitlements: {
    'com.apple.security.application-groups': ['group.com.oopsfee.app'],
  },
  deploymentTarget: '17.0',
  frameworks: ['SwiftUI', 'WidgetKit'],
};

