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
 * Check if Settings.bundle is already in the project by scanning all file references
 */
function hasSettingsBundle(project) {
  const fileRefs = project.pbxFileReferenceSection();
  for (const key of Object.keys(fileRefs)) {
    const ref = fileRefs[key];
    if (ref && typeof ref === 'object' && ref.path === 'Settings.bundle') {
      return key; // Return the UUID if found
    }
  }
  return null;
}

/**
 * Generate a simple UUID-like string
 */
function generateUuid() {
  return 'SETTINGS' + Math.random().toString(36).substr(2, 16).toUpperCase();
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

    // Check if Settings.bundle already exists in the project
    const existingUuid = hasSettingsBundle(project);
    if (existingUuid) {
      console.log('[withSettingsBundle] Settings.bundle already exists in project with UUID:', existingUuid);
      return config;
    }

    // Generate UUIDs for the file reference and build file
    const fileRefUuid = project.generateUuid();
    const buildFileUuid = project.generateUuid();

    // Get the main group UUID and first target UUID
    const projectObj = project.getFirstProject().firstProject;
    const mainGroupUuid = projectObj.mainGroup;
    const targetUuid = project.getFirstTarget().uuid;

    // 1. Add to PBXFileReference section
    const pbxFileRefSection = project.pbxFileReferenceSection();
    pbxFileRefSection[fileRefUuid] = {
      isa: 'PBXFileReference',
      lastKnownFileType: 'wrapper.plug-in',
      path: 'Settings.bundle',
      sourceTree: '"<group>"',
    };
    pbxFileRefSection[fileRefUuid + '_comment'] = 'Settings.bundle';
    console.log('[withSettingsBundle] Added file reference with UUID:', fileRefUuid);

    // 2. Add to main PBXGroup
    const pbxGroupSection = project.pbxGroupByName(projectObj.projectName) ||
                            project.getPBXGroupByKey(mainGroupUuid);
    if (pbxGroupSection && pbxGroupSection.children) {
      pbxGroupSection.children.push({
        value: fileRefUuid,
        comment: 'Settings.bundle',
      });
      console.log('[withSettingsBundle] Added to main group');
    }

    // 3. Add to PBXBuildFile section
    const pbxBuildFileSection = project.pbxBuildFileSection();
    pbxBuildFileSection[buildFileUuid] = {
      isa: 'PBXBuildFile',
      fileRef: fileRefUuid,
      fileRef_comment: 'Settings.bundle',
    };
    pbxBuildFileSection[buildFileUuid + '_comment'] = 'Settings.bundle in Resources';
    console.log('[withSettingsBundle] Added build file with UUID:', buildFileUuid);

    // 4. Add to Resources build phase
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
