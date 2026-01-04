/**
 * Expo config plugin to apply Xcode project optimizations.
 *
 * This plugin applies recommended Xcode settings that would otherwise
 * trigger warnings in Xcode's "Validate Settings" dialog:
 *
 * - Updates LastUpgradeCheck to current Xcode version (suppresses upgrade warnings)
 * - Removes deprecated ENABLE_BITCODE setting
 * - Enables whole-module optimization for Release builds
 *
 * Note: We intentionally skip ENABLE_USER_SCRIPT_SANDBOXING because it
 * can break React Native build scripts that need filesystem access.
 */
const { withXcodeProject } = require('@expo/config-plugins');

// Current Xcode version (update when upgrading Xcode)
const XCODE_VERSION = 1620; // Xcode 16.2

const withXcodeOptimizations = (config) => {
  return withXcodeProject(config, async (config) => {
    const project = config.modResults;

    // Update LastUpgradeCheck in project attributes
    const projectObject = project.getFirstProject();
    if (projectObject && projectObject.firstProject && projectObject.firstProject.attributes) {
      const oldVersion = projectObject.firstProject.attributes.LastUpgradeCheck;
      projectObject.firstProject.attributes.LastUpgradeCheck = XCODE_VERSION;
      console.log(`[withXcodeOptimizations] Updated LastUpgradeCheck: ${oldVersion} -> ${XCODE_VERSION}`);
    }

    // Get all build configurations
    const buildConfigurations = project.pbxXCBuildConfigurationSection();

    for (const key in buildConfigurations) {
      const buildConfig = buildConfigurations[key];

      // Skip comment entries
      if (typeof buildConfig !== 'object' || !buildConfig.buildSettings) {
        continue;
      }

      const productName = buildConfig.buildSettings.PRODUCT_NAME;
      const configName = buildConfig.name;

      // Only modify app target configurations (not Pods)
      const isAppTarget = productName && (
        productName === '"mwsim"' ||
        productName === 'mwsim' ||
        productName === '"$(TARGET_NAME)"' ||
        (typeof productName === 'string' && productName.includes('mwsim'))
      );

      if (isAppTarget) {
        // Remove deprecated ENABLE_BITCODE (deprecated since Xcode 14)
        if (buildConfig.buildSettings.ENABLE_BITCODE !== undefined) {
          delete buildConfig.buildSettings.ENABLE_BITCODE;
          console.log(`[withXcodeOptimizations] Removed ENABLE_BITCODE from ${configName}`);
        }

        // Enable whole-module optimization for Release builds
        if (configName === 'Release') {
          buildConfig.buildSettings.SWIFT_COMPILATION_MODE = 'wholemodule';
          console.log(`[withXcodeOptimizations] Set SWIFT_COMPILATION_MODE=wholemodule for ${configName}`);
        }
      }
    }

    return config;
  });
};

module.exports = withXcodeOptimizations;
