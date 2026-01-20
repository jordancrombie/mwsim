/**
 * Expo config plugin to strip bitcode from embedded frameworks.
 *
 * The OpenSSL.framework from react-native-nfc-passport-info contains bitcode
 * which Apple rejects during App Store submission (bitcode is deprecated since Xcode 14).
 *
 * This plugin adds a Run Script build phase that:
 * 1. Strips bitcode from OpenSSL.framework using xcrun bitcode_strip
 * 2. Re-signs the framework to maintain code signing integrity
 *
 * The script runs after "Embed Frameworks" phase to ensure the framework is
 * already in the app bundle before modification.
 */
const { withXcodeProject } = require('@expo/config-plugins');

const SCRIPT_NAME = '[Expo] Strip Bitcode from Frameworks';

const STRIP_BITCODE_SCRIPT = `
# Strip bitcode from OpenSSL.framework (from react-native-nfc-passport-info)
# Bitcode is deprecated since Xcode 14 and Apple rejects apps containing it

FRAMEWORK_PATH="\${BUILT_PRODUCTS_DIR}/\${FRAMEWORKS_FOLDER_PATH}/OpenSSL.framework/OpenSSL"

if [ -f "$FRAMEWORK_PATH" ]; then
  echo "Stripping bitcode from OpenSSL.framework..."
  xcrun bitcode_strip -r "$FRAMEWORK_PATH" -o "$FRAMEWORK_PATH"

  # Re-sign the framework after modification
  if [ -n "\${EXPANDED_CODE_SIGN_IDENTITY}" ]; then
    echo "Re-signing OpenSSL.framework..."
    codesign --force --sign "\${EXPANDED_CODE_SIGN_IDENTITY}" --preserve-metadata=identifier,entitlements "$FRAMEWORK_PATH"
  fi

  echo "Bitcode stripped successfully from OpenSSL.framework"
else
  echo "OpenSSL.framework not found at $FRAMEWORK_PATH (may not be needed for this build)"
fi
`;

const withBitcodeStrip = (config) => {
  return withXcodeProject(config, async (config) => {
    const project = config.modResults;

    // Get the main app target
    const targetName = 'mwsim';
    const nativeTargets = project.pbxNativeTargetSection();

    let mainTargetKey = null;
    for (const key in nativeTargets) {
      const target = nativeTargets[key];
      if (typeof target === 'object' && target.name === targetName) {
        mainTargetKey = key;
        break;
      }
    }

    if (!mainTargetKey) {
      console.warn('[withBitcodeStrip] Could not find main target, skipping');
      return config;
    }

    // Add the shell script build phase
    const buildPhase = project.addBuildPhase(
      [],
      'PBXShellScriptBuildPhase',
      SCRIPT_NAME,
      mainTargetKey,
      {
        shellPath: '/bin/sh',
        shellScript: STRIP_BITCODE_SCRIPT,
      }
    );

    if (buildPhase) {
      console.log('[withBitcodeStrip] Added bitcode stripping build phase');

      // Move the build phase to run after "Embed Frameworks"
      // This ensures the framework is already copied before we modify it
      const target = nativeTargets[mainTargetKey];
      if (target && target.buildPhases) {
        const phases = target.buildPhases;
        const embedIndex = phases.findIndex(
          (p) => p.comment && p.comment.includes('Embed Frameworks')
        );
        const scriptIndex = phases.findIndex(
          (p) => p.comment && p.comment.includes(SCRIPT_NAME)
        );

        if (embedIndex >= 0 && scriptIndex >= 0 && scriptIndex < embedIndex) {
          // Move script phase to after embed frameworks
          const [scriptPhase] = phases.splice(scriptIndex, 1);
          phases.splice(embedIndex, 0, scriptPhase);
          console.log('[withBitcodeStrip] Moved build phase to run after Embed Frameworks');
        }
      }
    }

    return config;
  });
};

module.exports = withBitcodeStrip;
