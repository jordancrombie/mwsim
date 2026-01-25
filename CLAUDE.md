# Claude Code Project Instructions

This file contains important instructions and procedures for Claude Code when working on the mwsim project.

## Project Overview

- **mwsim**: React Native mobile wallet app using Expo SDK 54
- **Bundle ID**: `com.banksim.wsim`
- **Team ID**: `ZJHD6JAC94`

## Version & Build Number Tracking

**CRITICAL: Always verify the correct version and build number before any TestFlight upload.**

### Current Version
- **Version**: `2.2.0` (OAuth + Device Authorization for AI platforms)
- **Build**: `2`

### Version vs Build Number Rules
- **Version** (`expo.version`): Marketing version visible to users. Bump when adding features or making significant changes.
  - Major: Breaking changes or major rewrites
  - Minor: New features (e.g., 2.0.5 → 2.1.0 for Agent Commerce)
  - Patch: Bug fixes only
- **Build Number** (`expo.ios.buildNumber`): Internal build identifier for App Store Connect.
  - **RESETS to "1"** when version changes
  - Increments for each TestFlight upload within the same version
  - Example: Version 2.1.0 builds: 1, 2, 3... then version 2.1.1 resets to build 1

### Before Each TestFlight Upload
1. Check `app/app.json` for current version and buildNumber
2. Determine if version needs bumping (new features = bump version, reset build to 1)
3. If same version, increment buildNumber
4. Update this CLAUDE.md file with the new version/build after successful upload

### Version History
| Version | Build | Date | Notes |
|---------|-------|------|-------|
| 2.2.0   | 1     | 2026-01-25 | OAuth Authorization Code Flow |
| 2.1.0   | 1     | 2026-01-23 | SACP Agent Commerce support |
| 2.0.5   | -     | Previous | Trusted User verification foundation |

## iOS Build & TestFlight Upload

### TestFlight Upload Procedure

Claude CAN automatically upload builds to TestFlight. **IMPORTANT: Only upload when explicitly requested by user/team.**

**CRITICAL: TestFlight builds MUST default to production environment.** Before building, verify both files are set to `production`:
1. `app/plugins/withSettingsBundle.js` - Settings.bundle `DefaultValue`
2. `app/src/services/environment.ts` - Code fallback in `getEnvironment()`

See "Environment Switching" section below for details on these settings.

#### Step 1: Verify Version & Build Number
1. Read `app/app.json` and check current `version` and `ios.buildNumber`
2. Compare against "Version & Build Number Tracking" section above
3. If adding features: bump version, reset buildNumber to "1"
4. If same version: increment buildNumber

#### Step 2: Prebuild
```bash
cd /Users/jcrombie/ai/mwsim/app
npx expo prebuild --clean
```

#### Step 3: Create Archive
```bash
cd /Users/jcrombie/ai/mwsim/app/ios
LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 xcodebuild \
  -workspace mwsim.xcworkspace \
  -scheme mwsim \
  -configuration Release \
  -archivePath /Users/jcrombie/ai/AppBuilds/IOS/Archives/mwsim-VERSION-BUILD.xcarchive \
  archive \
  CODE_SIGN_STYLE=Automatic \
  DEVELOPMENT_TEAM=ZJHD6JAC94
```

**Note:** Replace `VERSION-BUILD` with actual version (e.g., `mwsim-1.5.2-58.xcarchive`).
Archives are stored in `/Users/jcrombie/ai/AppBuilds/IOS/Archives/` (custom location).

#### Step 4: Export IPA
```bash
xcodebuild -exportArchive \
  -archivePath /Users/jcrombie/ai/AppBuilds/IOS/Archives/mwsim-VERSION-BUILD.xcarchive \
  -exportPath /Users/jcrombie/ai/AppBuilds/IOS/Export \
  -exportOptionsPlist /Users/jcrombie/ai/mwsim/app/ExportOptions.plist
```

#### Step 5: Upload to TestFlight (API Key Method)
```bash
xcrun altool --upload-app --type ios \
  --file /Users/jcrombie/ai/AppBuilds/IOS/Export/mwsim.ipa \
  --apiKey 649V537DQX \
  --apiIssuer 69a6de71-3b4e-47e3-e053-5b8c7c11a4d1
```

**API Key Location:** `~/.private_keys/AuthKey_649V537DQX.p8`

#### ExportOptions.plist
Located at `/Users/jcrombie/ai/mwsim/app/ExportOptions.plist`:
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

### Expected Output
Successful upload shows:
```
No errors uploading 'path/to/mwsim.ipa'
```

Build will then process in App Store Connect (5-15 minutes) before appearing in TestFlight.

## Local Device Build & Install

### List Connected Devices
```bash
xcrun devicectl list devices
```

### Build for Device
```bash
cd /Users/jcrombie/ai/mwsim/app
LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 xcodebuild \
  -workspace ios/mwsim.xcworkspace \
  -scheme mwsim \
  -configuration Debug \
  -destination 'id=DEVICE_ID' \
  build
```

### Install to Device
```bash
xcrun devicectl device install app --device DEVICE_ID /path/to/mwsim.app
```

### Launch on Device
```bash
xcrun devicectl device process launch --device DEVICE_ID com.banksim.wsim
```

## Push Notifications

### Architecture
- Uses **Direct APNs** (not Expo Push Service) for fully self-hosted solution
- mwsim uses `getDevicePushTokenAsync()` for native APNs tokens
- WSIM backend uses `@parse/node-apn` to send notifications

### APNs Environment Variables (WSIM)
```bash
APNS_KEY_ID=ABC123DEFG
APNS_TEAM_ID=ZJHD6JAC94
APNS_KEY_PATH=/path/to/key.p8
APNS_BUNDLE_ID=com.banksim.wsim
APNS_PRODUCTION=false  # true for App Store builds
```

## Environment Switching (Development vs Production)

**Current default: `production`** (required for TestFlight builds)

To switch the default environment, modify these two files:

### 1. Settings.bundle Default
**File:** `app/plugins/withSettingsBundle.js`

Find the `DefaultValue` key under the environment setting:
```xml
<key>DefaultValue</key>
<string>production</string>  <!-- or 'development' for local testing -->
```

### 2. Code Fallback Default
**File:** `app/src/services/environment.ts`

Find the else block in `getEnvironment()`:
```typescript
} else {
  // Default to production for all builds (Debug and Release)
  cachedEnvironment = 'production';  // or 'development' for local testing
}
```

**After changing:** Run `npx expo prebuild --clean` and rebuild the app.

## Related Projects

- **WSIM**: `/Users/jcrombie/ai/wsim` - Backend wallet service
- **TransferSim**: Transfer processing service
- **BSIM**: Bank simulator
- **ContractSim**: `/Users/jcrombie/ai/contractSim` - Conditional payments and wager contracts

## ContractSim Integration

mwsim integrates with ContractSim for conditional payment contracts (wagers, escrow, etc.).

### Contract Flow (Wagers)
1. **Create** → Contract enters `PROPOSED` status (creator auto-accepts)
2. **Counterparty Accepts** → Contract enters `FUNDING` status
3. **Both Parties Fund** → Contract enters `ACTIVE` status
4. **Oracle Resolution** → Contract enters `RESOLVED`, funds distributed

**Important**: Funding is only allowed after both parties accept. Attempting to fund in `PROPOSED` status returns `409 Conflict`.

### API Endpoints (via WSIM proxy)
- `POST /mobile/contracts` - Create contract
- `GET /mobile/contracts` - List user's contracts
- `GET /mobile/contracts/:id` - Get contract details
- `POST /mobile/contracts/:id/accept` - Accept contract (requires `{ consent: true }`)
- `POST /mobile/contracts/:id/fund` - Fund contract stake
- `GET /mobile/oracle/events` - List available oracle events

## Documentation

- Push Notification docs: `LOCAL_DEPLOYMENT_PLANS/PUSH_NOTIFICATION_*.md`
