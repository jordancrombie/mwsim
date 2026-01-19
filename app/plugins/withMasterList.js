/**
 * Expo config plugin to add masterList.pem to iOS bundle
 *
 * The react-native-nfc-passport-info library requires a masterList.pem file
 * in the app bundle for passport certificate verification.
 */
const { withXcodeProject } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Check if masterList.pem is already in the project by scanning all file references
 */
function hasMasterListPem(project) {
  const fileRefs = project.pbxFileReferenceSection();
  for (const key of Object.keys(fileRefs)) {
    const ref = fileRefs[key];
    if (ref && typeof ref === 'object' && ref.path === 'masterList.pem') {
      return key; // Return the UUID if found
    }
  }
  return null;
}

const withMasterList = (config) => {
  return withXcodeProject(config, async (config) => {
    const project = config.modResults;
    const platformProjectRoot = config.modRequest.platformProjectRoot;

    // Create placeholder masterList.pem file if it doesn't exist
    const sourcePath = path.join(platformProjectRoot, 'masterList.pem');
    if (!fs.existsSync(sourcePath)) {
      fs.writeFileSync(sourcePath, '# Placeholder for passport certificate master list\n');
      console.log('[withMasterList] Created placeholder masterList.pem');
    }

    // Check if masterList.pem is already in the project
    const existingUuid = hasMasterListPem(project);
    if (existingUuid) {
      console.log('[withMasterList] masterList.pem already exists in project with UUID:', existingUuid);
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
      lastKnownFileType: 'text',
      path: 'masterList.pem',
      sourceTree: '"<group>"',
    };
    pbxFileRefSection[fileRefUuid + '_comment'] = 'masterList.pem';
    console.log('[withMasterList] Added file reference with UUID:', fileRefUuid);

    // 2. Add to main PBXGroup
    const pbxGroupSection = project.pbxGroupByName(projectObj.projectName) ||
                            project.getPBXGroupByKey(mainGroupUuid);
    if (pbxGroupSection && pbxGroupSection.children) {
      pbxGroupSection.children.push({
        value: fileRefUuid,
        comment: 'masterList.pem',
      });
      console.log('[withMasterList] Added to main group');
    }

    // 3. Add to PBXBuildFile section
    const pbxBuildFileSection = project.pbxBuildFileSection();
    pbxBuildFileSection[buildFileUuid] = {
      isa: 'PBXBuildFile',
      fileRef: fileRefUuid,
      fileRef_comment: 'masterList.pem',
    };
    pbxBuildFileSection[buildFileUuid + '_comment'] = 'masterList.pem in Resources';
    console.log('[withMasterList] Added build file with UUID:', buildFileUuid);

    // 4. Add to Resources build phase
    const resourcesBuildPhase = project.pbxResourcesBuildPhaseObj(targetUuid);
    if (resourcesBuildPhase && resourcesBuildPhase.files) {
      resourcesBuildPhase.files.push({
        value: buildFileUuid,
        comment: 'masterList.pem in Resources',
      });
      console.log('[withMasterList] Added masterList.pem to Resources build phase');
    } else {
      console.log('[withMasterList] Warning: Could not find Resources build phase');
    }

    console.log('[withMasterList] Successfully added masterList.pem to project');

    return config;
  });
};

module.exports = withMasterList;
