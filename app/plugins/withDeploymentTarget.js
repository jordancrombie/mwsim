/**
 * Expo config plugin to set iOS deployment target
 *
 * This is needed because @react-native-ml-kit/text-recognition requires iOS 15.5+
 */
const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const withDeploymentTarget = (config, { deploymentTarget = '15.5' } = {}) => {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const podfilePropertiesPath = path.join(
        config.modRequest.platformProjectRoot,
        'Podfile.properties.json'
      );

      let properties = {};

      // Read existing properties if file exists
      if (fs.existsSync(podfilePropertiesPath)) {
        try {
          properties = JSON.parse(fs.readFileSync(podfilePropertiesPath, 'utf8'));
        } catch (e) {
          console.log('[withDeploymentTarget] Could not read Podfile.properties.json, creating new');
        }
      }

      // Set the deployment target
      properties['ios.deploymentTarget'] = deploymentTarget;

      // Write back
      fs.writeFileSync(podfilePropertiesPath, JSON.stringify(properties, null, 2));
      console.log(`[withDeploymentTarget] Set iOS deployment target to ${deploymentTarget}`);

      return config;
    },
  ]);
};

module.exports = withDeploymentTarget;
