#!/usr/bin/env node
/**
 * Script to add Settings.bundle to Xcode project
 * Run after `npx expo prebuild` and `pod install`
 */
const fs = require('fs');
const path = require('path');

const PROJECT_PATH = path.join(__dirname, '../ios/mwsim.xcodeproj/project.pbxproj');

function generateUuid() {
  return Array.from({ length: 24 }, () =>
    Math.floor(Math.random() * 16).toString(16).toUpperCase()
  ).join('');
}

function addSettingsBundle() {
  let content = fs.readFileSync(PROJECT_PATH, 'utf8');

  // Check if Settings.bundle already exists
  if (content.includes('Settings.bundle')) {
    console.log('[add-settings-bundle] Settings.bundle already in project');
    return;
  }

  const fileRefUuid = generateUuid();
  const buildFileUuid = generateUuid();

  // Find the main target's Resources build phase UUID
  const resourcesPhaseMatch = content.match(/([A-F0-9]{24}) \/\* Resources \*\/ = \{\s*isa = PBXResourcesBuildPhase;/);
  if (!resourcesPhaseMatch) {
    console.error('[add-settings-bundle] Could not find Resources build phase');
    return;
  }
  const resourcesPhaseUuid = resourcesPhaseMatch[1];

  // Find the main group (mwsim group)
  const mainGroupMatch = content.match(/([A-F0-9]{24}) \/\* mwsim \*\/ = \{\s*isa = PBXGroup;[^}]*children = \(/);
  if (!mainGroupMatch) {
    console.error('[add-settings-bundle] Could not find main group');
    return;
  }
  const mainGroupUuid = mainGroupMatch[1];

  // 1. Add to PBXBuildFile section
  const buildFileSection = '/* Begin PBXBuildFile section */';
  const buildFileEntry = `\t\t${buildFileUuid} /* Settings.bundle in Resources */ = {isa = PBXBuildFile; fileRef = ${fileRefUuid} /* Settings.bundle */; };`;
  content = content.replace(
    buildFileSection,
    `${buildFileSection}\n${buildFileEntry}`
  );

  // 2. Add to PBXFileReference section
  const fileRefSection = '/* Begin PBXFileReference section */';
  const fileRefEntry = `\t\t${fileRefUuid} /* Settings.bundle */ = {isa = PBXFileReference; lastKnownFileType = "wrapper.plug-in"; path = Settings.bundle; sourceTree = "<group>"; };`;
  content = content.replace(
    fileRefSection,
    `${fileRefSection}\n${fileRefEntry}`
  );

  // 3. Add to main group's children
  const mainGroupPattern = new RegExp(
    `(${mainGroupUuid} \\/\\* mwsim \\*\\/ = \\{\\s*isa = PBXGroup;[^}]*children = \\()`,
    's'
  );
  content = content.replace(
    mainGroupPattern,
    `$1\n\t\t\t\t${fileRefUuid} /* Settings.bundle */,`
  );

  // 4. Add to Resources build phase files
  const resourcesPhasePattern = new RegExp(
    `(${resourcesPhaseUuid} \\/\\* Resources \\*\\/ = \\{\\s*isa = PBXResourcesBuildPhase;[^}]*files = \\()`,
    's'
  );
  content = content.replace(
    resourcesPhasePattern,
    `$1\n\t\t\t\t${buildFileUuid} /* Settings.bundle in Resources */,`
  );

  fs.writeFileSync(PROJECT_PATH, content);
  console.log('[add-settings-bundle] Successfully added Settings.bundle to project');
  console.log(`  File Ref UUID: ${fileRefUuid}`);
  console.log(`  Build File UUID: ${buildFileUuid}`);
}

addSettingsBundle();
