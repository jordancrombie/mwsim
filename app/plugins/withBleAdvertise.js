/**
 * Expo config plugin for react-native-ble-advertise
 *
 * Adds required iOS UIBackgroundModes and Android permissions for BLE advertising.
 */
const { withInfoPlist, withAndroidManifest } = require('@expo/config-plugins');

const withBleAdvertiseIOS = (config) => {
  return withInfoPlist(config, (config) => {
    // Add bluetooth-peripheral to UIBackgroundModes for background advertising
    const existingModes = config.modResults.UIBackgroundModes || [];

    if (!existingModes.includes('bluetooth-peripheral')) {
      existingModes.push('bluetooth-peripheral');
    }
    if (!existingModes.includes('bluetooth-central')) {
      existingModes.push('bluetooth-central');
    }

    config.modResults.UIBackgroundModes = existingModes;

    console.log('[withBleAdvertise] Added UIBackgroundModes:', existingModes);

    return config;
  });
};

const withBleAdvertiseAndroid = (config) => {
  return withAndroidManifest(config, (config) => {
    const mainApplication = config.modResults.manifest.application?.[0];
    const manifest = config.modResults.manifest;

    // Ensure uses-permission array exists
    if (!manifest['uses-permission']) {
      manifest['uses-permission'] = [];
    }

    const permissions = manifest['uses-permission'];

    // Required permissions for BLE advertising
    const requiredPermissions = [
      'android.permission.BLUETOOTH',
      'android.permission.BLUETOOTH_ADMIN',
      'android.permission.BLUETOOTH_ADVERTISE',
      'android.permission.BLUETOOTH_SCAN',
      'android.permission.BLUETOOTH_CONNECT',
      'android.permission.ACCESS_FINE_LOCATION',
      'android.permission.ACCESS_COARSE_LOCATION',
    ];

    for (const permission of requiredPermissions) {
      const exists = permissions.some(
        (p) => p.$?.['android:name'] === permission
      );

      if (!exists) {
        permissions.push({
          $: { 'android:name': permission },
        });
        console.log('[withBleAdvertise] Added permission:', permission);
      }
    }

    // Add uses-feature for BLE
    if (!manifest['uses-feature']) {
      manifest['uses-feature'] = [];
    }

    const features = manifest['uses-feature'];
    const bleFeature = 'android.hardware.bluetooth_le';
    const bleFeatureExists = features.some(
      (f) => f.$?.['android:name'] === bleFeature
    );

    if (!bleFeatureExists) {
      features.push({
        $: {
          'android:name': bleFeature,
          'android:required': 'false',
        },
      });
      console.log('[withBleAdvertise] Added BLE feature');
    }

    return config;
  });
};

const withBleAdvertise = (config) => {
  config = withBleAdvertiseIOS(config);
  config = withBleAdvertiseAndroid(config);
  return config;
};

module.exports = withBleAdvertise;
