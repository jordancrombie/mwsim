# Claude Code Project Instructions

This file contains important instructions and procedures for Claude Code when working on the mwsim project.

## Project Overview

- **mwsim**: React Native mobile wallet app using Expo SDK 54
- **Bundle ID**: `com.banksim.wsim`
- **Team ID**: `ZJHD6JAC94`

## iOS Build & TestFlight Upload

### TestFlight Upload Procedure

Claude CAN automatically upload builds to TestFlight. **IMPORTANT: Only upload when explicitly requested by user/team.**

**CRITICAL: TestFlight builds MUST default to production environment.** Before building, verify both files are set to `production`:
1. `app/plugins/withSettingsBundle.js` - Settings.bundle `DefaultValue`
2. `app/src/services/environment.ts` - Code fallback in `getEnvironment()`

See "Environment Switching" section below for details on these settings.

#### Step 1: Bump Build Number
Edit `app/app.json` and increment `ios.buildNumber`.

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

## Documentation

- Push Notification docs: `LOCAL_DEPLOYMENT_PLANS/PUSH_NOTIFICATION_*.md`
