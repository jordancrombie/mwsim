/**
 * Expo config plugin for NFC passport reading
 *
 * Adds required iOS entitlements and Android permissions for NFC passport reading.
 * Uses CoreNFC on iOS (requires physical device) and NFC API on Android.
 *
 * NOTE: NFC Tag Reading capability must be enabled in Apple Developer Portal for the App ID
 * before the entitlements can be used. Set ENABLE_NFC_ENTITLEMENT=true after configuring.
 */
const { withInfoPlist, withEntitlementsPlist, withAndroidManifest } = require('@expo/config-plugins');

// Set to true once NFC capability is enabled in Apple Developer Portal
const ENABLE_NFC_ENTITLEMENT = true;

const withNFCPassportIOS = (config) => {
  // Add NFC reader usage description to Info.plist
  config = withInfoPlist(config, (config) => {
    config.modResults.NFCReaderUsageDescription =
      'mwsim reads your passport chip to verify your identity';

    if (ENABLE_NFC_ENTITLEMENT) {
      // Add the ISO7816 application identifiers for passport reading
      // These are the AIDs used by ICAO 9303 compliant travel documents
      config.modResults['com.apple.developer.nfc.readersession.iso7816.select-identifiers'] = [
        'A0000002471001', // eMRTD (electronic Machine Readable Travel Document)
      ];
    }

    console.log('[withNFCPassport] Added NFC reader usage description');

    return config;
  });

  // Add NFC entitlement (only if enabled in Developer Portal)
  if (ENABLE_NFC_ENTITLEMENT) {
    config = withEntitlementsPlist(config, (config) => {
      // Enable NFC Tag Reading
      config.modResults['com.apple.developer.nfc.readersession.formats'] = ['TAG'];

      console.log('[withNFCPassport] Added NFC entitlement');

      return config;
    });
  } else {
    console.log('[withNFCPassport] NFC entitlement skipped - enable in Apple Developer Portal first');
  }

  return config;
};

const withNFCPassportAndroid = (config) => {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;

    // Ensure uses-permission array exists
    if (!manifest['uses-permission']) {
      manifest['uses-permission'] = [];
    }

    const permissions = manifest['uses-permission'];

    // Add NFC permission
    const nfcPermission = 'android.permission.NFC';
    const exists = permissions.some(
      (p) => p.$?.['android:name'] === nfcPermission
    );

    if (!exists) {
      permissions.push({
        $: { 'android:name': nfcPermission },
      });
      console.log('[withNFCPassport] Added NFC permission');
    }

    // Add uses-feature for NFC (not required, so app works on devices without NFC)
    if (!manifest['uses-feature']) {
      manifest['uses-feature'] = [];
    }

    const features = manifest['uses-feature'];
    const nfcFeature = 'android.hardware.nfc';
    const nfcFeatureExists = features.some(
      (f) => f.$?.['android:name'] === nfcFeature
    );

    if (!nfcFeatureExists) {
      features.push({
        $: {
          'android:name': nfcFeature,
          'android:required': 'false',
        },
      });
      console.log('[withNFCPassport] Added NFC feature (optional)');
    }

    return config;
  });
};

const withNFCPassport = (config) => {
  config = withNFCPassportIOS(config);
  config = withNFCPassportAndroid(config);
  return config;
};

module.exports = withNFCPassport;
