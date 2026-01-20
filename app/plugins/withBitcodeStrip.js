/**
 * Expo config plugin to strip bitcode from embedded frameworks.
 *
 * The OpenSSL.framework from react-native-nfc-passport-info contains bitcode
 * which Apple rejects during App Store submission (bitcode is deprecated since Xcode 14).
 *
 * This plugin:
 * 1. Adds a Run Script build phase that strips bitcode using xcrun bitcode_strip
 * 2. Modifies the Podfile to reorder build phases after CocoaPods runs
 *
 * The reordering ensures the script runs AFTER "[CP] Embed Pods Frameworks"
 * which is when OpenSSL.framework gets copied to the app bundle.
 */
const { withXcodeProject, withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

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

// Ruby code to add to post_install that reorders build phases
// Note: installer.pods_project refers to Pods.xcodeproj, not the main project
// We need to open the main project directly using Xcodeproj
const PODFILE_REORDER_CODE = `
    # [withBitcodeStrip] Reorder build phases to run bitcode strip AFTER embed frameworks
    require 'xcodeproj'
    project_path = File.join(__dir__, 'mwsim.xcodeproj')
    project = Xcodeproj::Project.open(project_path)

    project.targets.each do |target|
      if target.name == 'mwsim'
        phases = target.build_phases
        strip_phase = phases.find { |p| p.display_name.include?('[Expo] Strip Bitcode from Frameworks') }
        embed_phase = phases.find { |p| p.display_name.include?('[CP] Embed Pods Frameworks') }

        if strip_phase && embed_phase
          strip_idx = phases.index(strip_phase)
          embed_idx = phases.index(embed_phase)

          if strip_idx < embed_idx
            phases.move(strip_phase, embed_idx)
            puts "[withBitcodeStrip] Moved strip phase after embed frameworks phase"
          else
            puts "[withBitcodeStrip] Strip phase already after embed frameworks (strip: #{strip_idx}, embed: #{embed_idx})"
          end
        else
          puts "[withBitcodeStrip] Could not find phases (strip: #{strip_phase.nil? ? 'nil' : 'found'}, embed: #{embed_phase.nil? ? 'nil' : 'found'})"
        end
      end
    end

    project.save
`;

const withBitcodeStrip = (config) => {
  // Step 1: Add the build phase via withXcodeProject
  config = withXcodeProject(config, async (config) => {
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
    }

    return config;
  });

  // Step 2: Modify Podfile to reorder phases after CocoaPods runs
  config = withDangerousMod(config, [
    'ios',
    async (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, 'Podfile');

      if (!fs.existsSync(podfilePath)) {
        console.warn('[withBitcodeStrip] Podfile not found, skipping phase reorder');
        return config;
      }

      let podfileContent = fs.readFileSync(podfilePath, 'utf8');

      // Check if we already added our reorder code
      if (podfileContent.includes('[withBitcodeStrip] Reorder build phases')) {
        console.log('[withBitcodeStrip] Podfile already has phase reorder code');
        return config;
      }

      // Find the post_install block and add our reorder code inside it
      // Look for the closing of react_native_post_install and add before the 'end' of post_install
      const postInstallEndPattern = /(\s*react_native_post_install\([^)]+\)[\s\S]*?)\n(\s*end\s*\nend)/;

      if (postInstallEndPattern.test(podfileContent)) {
        podfileContent = podfileContent.replace(
          postInstallEndPattern,
          `$1\n${PODFILE_REORDER_CODE}\n$2`
        );
        fs.writeFileSync(podfilePath, podfileContent);
        console.log('[withBitcodeStrip] Added phase reorder code to Podfile post_install');
      } else {
        console.warn('[withBitcodeStrip] Could not find post_install block in Podfile');
      }

      return config;
    },
  ]);

  return config;
};

module.exports = withBitcodeStrip;
