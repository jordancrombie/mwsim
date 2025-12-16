/**
 * Expo config plugin to add iOS Settings Bundle for environment switching.
 *
 * This creates a Settings.bundle that appears in iOS Settings app,
 * allowing users to switch between Development and Production environments.
 */
const { withXcodeProject, withInfoPlist } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Settings.bundle plist content for environment picker
 */
const ROOT_PLIST = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>StringsTable</key>
    <string>Root</string>
    <key>PreferenceSpecifiers</key>
    <array>
        <dict>
            <key>Type</key>
            <string>PSGroupSpecifier</string>
            <key>Title</key>
            <string>Environment</string>
            <key>FooterText</key>
            <string>Select which server environment to connect to. Changes take effect on next app launch.</string>
        </dict>
        <dict>
            <key>Type</key>
            <string>PSMultiValueSpecifier</string>
            <key>Title</key>
            <string>Server</string>
            <key>Key</key>
            <string>environment</string>
            <key>DefaultValue</key>
            <string>development</string>
            <key>Titles</key>
            <array>
                <string>Development</string>
                <string>Production</string>
            </array>
            <key>Values</key>
            <array>
                <string>development</string>
                <string>production</string>
            </array>
        </dict>
        <dict>
            <key>Type</key>
            <string>PSGroupSpecifier</string>
            <key>Title</key>
            <string>App Info</string>
        </dict>
        <dict>
            <key>Type</key>
            <string>PSTitleValueSpecifier</string>
            <key>Title</key>
            <string>Version</string>
            <key>Key</key>
            <string>version_preference</string>
            <key>DefaultValue</key>
            <string></string>
        </dict>
        <dict>
            <key>Type</key>
            <string>PSTitleValueSpecifier</string>
            <key>Title</key>
            <string>Build</string>
            <key>Key</key>
            <string>build_preference</string>
            <key>DefaultValue</key>
            <string></string>
        </dict>
    </array>
</dict>
</plist>`;

/**
 * Strings file for localization
 */
const ROOT_STRINGS = `/* Root.strings - English localization */
"Environment" = "Environment";
"Server" = "Server";
"Development" = "Development";
"Production" = "Production";
"App Info" = "App Info";
"Version" = "Version";
"Build" = "Build";
`;

/**
 * Create the Settings.bundle directory structure and files
 */
function createSettingsBundle(iosPath) {
  const settingsBundlePath = path.join(iosPath, 'Settings.bundle');
  const enLprojPath = path.join(settingsBundlePath, 'en.lproj');

  // Create directories
  if (!fs.existsSync(settingsBundlePath)) {
    fs.mkdirSync(settingsBundlePath, { recursive: true });
  }
  if (!fs.existsSync(enLprojPath)) {
    fs.mkdirSync(enLprojPath, { recursive: true });
  }

  // Write Root.plist
  fs.writeFileSync(path.join(settingsBundlePath, 'Root.plist'), ROOT_PLIST);

  // Write Root.strings for localization
  fs.writeFileSync(path.join(enLprojPath, 'Root.strings'), ROOT_STRINGS);

  console.log('[withSettingsBundle] Created Settings.bundle at:', settingsBundlePath);

  return settingsBundlePath;
}

/**
 * Add Settings.bundle to Xcode project
 */
function addSettingsBundleToProject(project, settingsBundlePath) {
  const projectName = project.getFirstProject().firstProject.mainGroup;

  // Find or create the Resources group
  let resourcesGroup = project.pbxGroupByName('Resources');
  if (!resourcesGroup) {
    // Create Resources group if it doesn't exist
    resourcesGroup = project.addPbxGroup([], 'Resources', 'Resources');
    const mainGroup = project.getPBXGroupByKey(projectName);
    if (mainGroup && mainGroup.children) {
      mainGroup.children.push({
        value: resourcesGroup.uuid,
        comment: 'Resources'
      });
    }
  }

  // Add Settings.bundle as a folder reference
  const settingsBundle = project.addFile(
    'Settings.bundle',
    resourcesGroup.uuid,
    {
      lastKnownFileType: 'wrapper.plug-in',
      sourceTree: '"<group>"',
    }
  );

  if (settingsBundle) {
    // Add to Resources build phase
    const buildPhases = project.pbxResourcesBuildPhaseObj();
    if (buildPhases) {
      project.addToPbxResourcesBuildPhase(settingsBundle);
    }
    console.log('[withSettingsBundle] Added Settings.bundle to Xcode project');
  }

  return project;
}

/**
 * Main plugin function
 */
const withSettingsBundle = (config) => {
  // Add Settings.bundle to Xcode project
  config = withXcodeProject(config, async (config) => {
    const iosPath = path.join(config.modRequest.platformProjectRoot);

    // Create Settings.bundle
    createSettingsBundle(iosPath);

    // Add to Xcode project
    const project = config.modResults;

    // Check if Settings.bundle is already added
    const existingFile = project.getFirstProject().firstProject.mainGroup;
    const pbxGroup = project.getPBXGroupByKey(existingFile);

    let alreadyAdded = false;
    if (pbxGroup && pbxGroup.children) {
      alreadyAdded = pbxGroup.children.some(
        (child) => child.comment === 'Settings.bundle'
      );
    }

    if (!alreadyAdded) {
      // Add Settings.bundle reference
      const file = project.addFile(
        'Settings.bundle',
        existingFile,
        {
          lastKnownFileType: 'wrapper.plug-in',
          sourceTree: '"<group>"',
        }
      );

      if (file) {
        project.addToPbxResourcesBuildPhase(file);
        console.log('[withSettingsBundle] Settings.bundle added to project');
      }
    } else {
      console.log('[withSettingsBundle] Settings.bundle already in project');
    }

    return config;
  });

  return config;
};

module.exports = withSettingsBundle;
