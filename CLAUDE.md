# Claude Code Project Instructions

This file contains important instructions and procedures for Claude Code when working on the mwsim project.

## Project Overview

- **mwsim**: React Native mobile wallet app using Expo SDK 54
- **Bundle ID**: `com.banksim.wsim`
- **Team ID**: `ZJHD6JAC94`

## iOS Build & TestFlight Upload

### Automatic TestFlight Upload (IMPORTANT - DO NOT FORGET)

Claude CAN automatically upload builds to TestFlight using `xcodebuild`. Here's the complete procedure:

#### 1. Bump Build Number
Edit `app/app.json` and increment `ios.buildNumber`.

#### 2. Prebuild
```bash
cd /Users/jcrombie/ai/mwsim/app
npx expo prebuild --clean --platform ios
```

#### 3. Create Archive (in custom Organizer location)
```bash
cd /Users/jcrombie/ai/mwsim/app
LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 xcodebuild \
  -workspace ios/mwsim.xcworkspace \
  -scheme mwsim \
  -configuration Release \
  -sdk iphoneos \
  -archivePath /Users/jcrombie/ai/AppBuilds/IOS/Archives/$(date +%Y-%m-%d)/mwsim.xcarchive \
  archive \
  CODE_SIGN_STYLE=Automatic \
  DEVELOPMENT_TEAM=ZJHD6JAC94
```

**Note:** Archives are stored in `/Users/jcrombie/ai/AppBuilds/IOS/Archives/` (custom location), NOT the default `~/Library/Developer/Xcode/Archives/`.

#### 4. Export and Upload to TestFlight
```bash
xcodebuild -allowProvisioningUpdates \
  -exportArchive \
  -archivePath /Users/jcrombie/ai/AppBuilds/IOS/Archives/$(date +%Y-%m-%d)/mwsim.xcarchive \
  -exportPath /Users/jcrombie/ai/AppBuilds/IOS/Exports \
  -exportOptionsPlist /Users/jcrombie/ai/mwsim/app/ExportOptions.plist
```

**Key flags:**
- `-allowProvisioningUpdates`: Lets Xcode automatically fetch/regenerate provisioning profiles with required capabilities (like Push Notifications)
- The ExportOptions.plist specifies `method: app-store-connect` and `destination: upload`

#### ExportOptions.plist Content
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
    <false/>
    <key>destination</key>
    <string>upload</string>
</dict>
</plist>
```

### Expected Output
Successful upload shows:
```
Progress 46%: Upload succeeded.
Uploaded mwsim
** EXPORT SUCCEEDED **
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

## Related Projects

- **WSIM**: `/Users/jcrombie/ai/wsim` - Backend wallet service
- **TransferSim**: Transfer processing service
- **BSIM**: Bank simulator

## Documentation

- Push Notification docs: `LOCAL_DEPLOYMENT_PLANS/PUSH_NOTIFICATION_*.md`
