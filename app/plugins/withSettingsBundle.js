/**
 * Expo config plugin to add iOS Settings Bundle for environment switching.
 *
 * This creates a Settings.bundle that appears in iOS Settings app,
 * allowing users to switch between Development and Production environments.
 */
const { withXcodeProject } = require('@expo/config-plugins');
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
 * Main plugin function
 */
const withSettingsBundle = (config) => {
  config = withXcodeProject(config, async (config) => {
    const iosPath = config.modRequest.platformProjectRoot;
    const project = config.modResults;

    // Create Settings.bundle files
    createSettingsBundle(iosPath);

    // Get the main group and target
    const mainGroup = project.getFirstProject().firstProject.mainGroup;
    const targetUuid = project.getFirstTarget().uuid;

    // Generate a unique UUID for the file reference
    const fileRefUuid = project.generateUuid();
    const buildFileUuid = project.generateUuid();

    // Check if Settings.bundle already exists in the project
    const existingFile = project.pbxFileReferenceSection()['Settings.bundle'];
    if (existingFile) {
      console.log('[withSettingsBundle] Settings.bundle already exists in project');
      return config;
    }

    // Add file reference to PBXFileReference section
    project.addToPbxFileReferenceSection({
      uuid: fileRefUuid,
      basename: 'Settings.bundle',
      lastKnownFileType: 'wrapper.plug-in',
      path: 'Settings.bundle',
      sourceTree: '"<group>"',
      fileEncoding: undefined,
      explicitFileType: undefined,
      includeInIndex: 0,
    });

    // Add to main group
    project.addToPbxGroup(fileRefUuid, 'Settings.bundle', mainGroup);

    // Add to PBXBuildFile section
    project.addToPbxBuildFileSection({
      uuid: buildFileUuid,
      fileRef: fileRefUuid,
      basename: 'Settings.bundle',
      group: 'Resources',
    });

    // Add to Resources build phase
    const resourcesBuildPhase = project.pbxResourcesBuildPhaseObj(targetUuid);
    if (resourcesBuildPhase && resourcesBuildPhase.files) {
      resourcesBuildPhase.files.push({
        value: buildFileUuid,
        comment: 'Settings.bundle in Resources',
      });
      console.log('[withSettingsBundle] Added Settings.bundle to Resources build phase');
    } else {
      console.log('[withSettingsBundle] Warning: Could not find Resources build phase');
    }

    console.log('[withSettingsBundle] Successfully added Settings.bundle to project');

    return config;
  });

  return config;
};

module.exports = withSettingsBundle;
