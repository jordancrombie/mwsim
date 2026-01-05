# CI/CD Build Guide for mwsim

This document covers both automated CI/CD builds and manual build procedures for the mwsim iOS app.

## Table of Contents
- [Automated Builds (Buildkite)](#automated-builds-buildkite)
- [Automated Builds (GitHub Actions)](#automated-builds-github-actions)
- [Manual Build Steps](#manual-build-steps)
- [Required Secrets](#required-secrets)
- [Troubleshooting](#troubleshooting)

---

## Automated Builds (Buildkite)

### Pipeline Location
`.buildkite/pipeline.yml`

### Agent Requirements
- **Queue**: `macos` (configure your macOS agent with this queue tag)
- **Xcode**: 16.2+ with command line tools
- **Node.js**: 20+ (via nvm, nodenv, or system install)
- **CocoaPods**: Latest version

### Pipeline Steps

| Step | Description | Duration |
|------|-------------|----------|
| Setup | Xcode & Node.js selection | ~30s |
| Dependencies | `npm ci` | ~60s |
| Version Bump | Auto-increment build number | ~5s |
| Expo Prebuild | Generate native iOS project | ~120s |
| Code Signing | Setup API key | ~10s |
| Archive | `xcodebuild archive` | ~300s |
| Export | Create IPA from archive | ~60s |
| Upload | Send to TestFlight | ~30s |
| Artifacts | Upload IPA to Buildkite | ~10s |
| Cleanup | Remove secrets | ~5s |

**Total: ~10-15 minutes**

### Setting Up Buildkite

#### 1. Install Buildkite Agent on macOS
```bash
brew install buildkite/buildkite/buildkite-agent
```

#### 2. Configure Agent Tags
Edit `~/.buildkite-agent/buildkite-agent.cfg`:
```ini
tags="queue=macos,os=darwin"
```

#### 3. Set Environment Variables
Add to your agent's environment hook (`~/.buildkite-agent/hooks/environment`):
```bash
#!/bin/bash
export APPLE_API_KEY_ID="649V537DQX"
export APPLE_API_ISSUER_ID="69a6de71-3b4e-47e3-e053-5b8c7c11a4d1"
export APPLE_TEAM_ID="ZJHD6JAC94"
```

#### 4. Store API Key as Secret
Using Buildkite Secrets:
```bash
# Encode and store the API key
base64 -i ~/.private_keys/AuthKey_649V537DQX.p8 | buildkite-agent secret set APPLE_API_KEY_BASE64
```

Or via environment hook:
```bash
export APPLE_API_KEY_BASE64="$(cat /secure/path/to/api_key_base64.txt)"
```

### Triggering Builds

#### Via Git Push
Configure a webhook in Buildkite to trigger on push to your repository.

#### Manual Trigger with Custom Build Number
```bash
# Via Buildkite CLI
buildkite-agent pipeline upload .buildkite/pipeline.yml

# Or via API with custom build number
curl -X POST "https://api.buildkite.com/v2/organizations/{org}/pipelines/{pipeline}/builds" \
  -H "Authorization: Bearer $BUILDKITE_TOKEN" \
  -d '{
    "commit": "HEAD",
    "branch": "main",
    "env": {
      "OVERRIDE_BUILD_NUMBER": "60"
    }
  }'
```

### Buildkite Secrets

| Variable | Description | Where to Set |
|----------|-------------|--------------|
| `APPLE_API_KEY_ID` | API Key ID | Environment hook or pipeline env |
| `APPLE_API_ISSUER_ID` | API Issuer ID | Environment hook or pipeline env |
| `APPLE_TEAM_ID` | Apple Team ID | Environment hook or pipeline env |
| `APPLE_API_KEY_BASE64` | Base64 .p8 key | Buildkite Secrets (recommended) |

### Artifacts
- IPA files uploaded to Buildkite artifacts
- Archives also uploaded for debugging
- Build summary annotation displayed in Buildkite UI

---

## Automated Builds (GitHub Actions)

### Pipeline Location
`.github/workflows/ios-build.yml`

### Triggers
- **Automatic**: Push to `main` branch (when `app/` files change)
- **Manual**: Workflow dispatch from GitHub Actions UI

### Pipeline Steps

| Step | Description | Duration |
|------|-------------|----------|
| 1. Checkout | Clone repository | ~10s |
| 2. Setup | Node.js, Xcode selection | ~30s |
| 3. Dependencies | `npm ci` | ~60s |
| 4. Version Bump | Auto-increment build number | ~5s |
| 5. Expo Prebuild | Generate native iOS project | ~120s |
| 6. Code Signing | Setup API key & keychain | ~15s |
| 7. Archive | `xcodebuild archive` | ~300s |
| 8. Export | Create IPA from archive | ~60s |
| 9. Upload | Send to TestFlight | ~30s |
| 10. Cleanup | Remove secrets | ~5s |

**Total: ~10-15 minutes**

### Manual Trigger with Custom Build Number

1. Go to Actions tab in GitHub
2. Select "iOS Build & TestFlight" workflow
3. Click "Run workflow"
4. Optionally enter a specific build number
5. Click "Run workflow" button

---

## Manual Build Steps

### Prerequisites
- macOS with Xcode 16.2+
- Node.js 20+
- Apple Developer account
- App Store Connect API key

### Step-by-Step Commands

#### 1. Bump Version (if needed)
Edit `app/app.json`:
```json
{
  "expo": {
    "version": "1.5.3",
    "ios": {
      "buildNumber": "59"
    }
  }
}
```

#### 2. Install Dependencies
```bash
cd /path/to/mwsim/app
npm ci
```

#### 3. Expo Prebuild
```bash
npx expo prebuild --clean
```

#### 4. Create Archive
```bash
cd ios
xcodebuild \
  -workspace mwsim.xcworkspace \
  -scheme mwsim \
  -configuration Release \
  -archivePath ~/Archives/mwsim-VERSION-BUILD.xcarchive \
  archive \
  CODE_SIGN_STYLE=Automatic \
  DEVELOPMENT_TEAM=ZJHD6JAC94
```

Replace `VERSION-BUILD` with actual version (e.g., `1.5.3-59`).

#### 5. Export IPA
```bash
xcodebuild -exportArchive \
  -archivePath ~/Archives/mwsim-VERSION-BUILD.xcarchive \
  -exportPath ~/Export \
  -exportOptionsPlist /path/to/mwsim/app/ExportOptions.plist
```

#### 6. Upload to TestFlight
```bash
xcrun altool --upload-app --type ios \
  --file ~/Export/mwsim.ipa \
  --apiKey YOUR_API_KEY_ID \
  --apiIssuer YOUR_ISSUER_ID
```

### ExportOptions.plist
Located at `app/ExportOptions.plist`:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>method</key>
    <string>app-store-connect</string>
    <key>teamID</key>
    <string>ZJHD6JAC94</string>
    <key>uploadSymbols</key>
    <true/>
    <key>signingStyle</key>
    <string>automatic</string>
</dict>
</plist>
```

---

## Required Secrets

### GitHub Actions Secrets
Set these in Repository Settings → Secrets and variables → Actions:

| Secret Name | Description | Example |
|-------------|-------------|---------|
| `APPLE_API_KEY_ID` | App Store Connect API Key ID | `649V537DQX` |
| `APPLE_API_ISSUER_ID` | API Issuer ID | `69a6de71-3b4e-47e3-e053-5b8c7c11a4d1` |
| `APPLE_API_KEY_BASE64` | Base64-encoded .p8 key | `base64 -i AuthKey_XXX.p8` |
| `APPLE_TEAM_ID` | Apple Developer Team ID | `ZJHD6JAC94` |
| `KEYCHAIN_PASSWORD` | Temp keychain password | Any secure string |

### Creating Base64 API Key
```bash
# Encode the .p8 file
base64 -i ~/.private_keys/AuthKey_649V537DQX.p8 | pbcopy
# Paste into GitHub Secrets
```

---

## Troubleshooting

### Common Issues

#### "No signing certificate found"
- Ensure `APPLE_TEAM_ID` is correct
- Check that API key has "App Manager" or "Admin" role
- Verify `-allowProvisioningUpdates` flag is present

#### "Profile doesn't include device"
- New test devices need to be registered in Apple Developer Console
- Add `-allowProvisioningUpdates` to regenerate profiles

#### "Bundle identifier mismatch"
- Check `app.json` has correct `bundleIdentifier: "com.banksim.wsim"`
- Verify ExportOptions.plist has matching `teamID`

#### Archive succeeds but export fails
- Check ExportOptions.plist exists and has correct values
- Verify API key has proper permissions

#### Upload fails with "Authentication failed"
- Verify API key file path and ID match
- Check issuer ID is correct
- Ensure API key hasn't expired

### Logs Location
- GitHub Actions: Check workflow run logs
- Local: `/var/folders/.../xcodebuild.log`
- Distribution logs: `~/Library/Logs/DiagnosticReports/`

---

## Build Artifacts

### Local Archives
Custom location: `/Users/jcrombie/ai/AppBuilds/IOS/Archives/`

### GitHub Actions Artifacts
- Retained for 30 days
- Named: `mwsim-{version}-{build}`
- Contains: IPA file

### TestFlight Processing
After upload, builds take 5-15 minutes to process before appearing in TestFlight.

---

## Quick Reference

### One-liner for local build + upload
```bash
cd /path/to/mwsim/app && \
npx expo prebuild --clean && \
cd ios && \
xcodebuild -workspace mwsim.xcworkspace -scheme mwsim -configuration Release \
  -archivePath /tmp/mwsim.xcarchive archive \
  CODE_SIGN_STYLE=Automatic DEVELOPMENT_TEAM=ZJHD6JAC94 && \
xcodebuild -exportArchive -archivePath /tmp/mwsim.xcarchive \
  -exportPath /tmp/export -exportOptionsPlist ../ExportOptions.plist && \
xcrun altool --upload-app --type ios --file /tmp/export/mwsim.ipa \
  --apiKey 649V537DQX --apiIssuer 69a6de71-3b4e-47e3-e053-5b8c7c11a4d1
```
