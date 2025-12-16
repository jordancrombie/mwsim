/**
 * Expo config plugin to set the iOS code signing team.
 * This ensures the DEVELOPMENT_TEAM is set correctly after each prebuild.
 */
const { withXcodeProject } = require('@expo/config-plugins');

const DEVELOPMENT_TEAM = 'ZJHD6JAC94';

const withSigningTeam = (config) => {
  return withXcodeProject(config, async (config) => {
    const project = config.modResults;
    const buildConfigurations = project.pbxXCBuildConfigurationSection();

    // Set DEVELOPMENT_TEAM for all build configurations
    for (const key in buildConfigurations) {
      const buildConfig = buildConfigurations[key];

      // Skip the comment entries (they have string values, not objects)
      if (typeof buildConfig !== 'object' || !buildConfig.buildSettings) {
        continue;
      }

      // Only modify app target configurations (not Pods)
      const productName = buildConfig.buildSettings.PRODUCT_NAME;
      // Check for various formats: "mwsim", mwsim, "$(TARGET_NAME)"
      if (productName && (
        productName === '"mwsim"' ||
        productName === 'mwsim' ||
        productName === '"$(TARGET_NAME)"' ||
        productName.includes('mwsim')
      )) {
        buildConfig.buildSettings.DEVELOPMENT_TEAM = DEVELOPMENT_TEAM;
        console.log(`[withSigningTeam] Set DEVELOPMENT_TEAM=${DEVELOPMENT_TEAM} for ${buildConfig.name || key}`);
      }
    }

    return config;
  });
};

module.exports = withSigningTeam;
