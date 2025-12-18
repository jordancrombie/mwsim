# Changelog

All notable changes to the mwsim (Mobile Wallet Simulator) project will be documented in this file.

## [1.1.0] - 2025-12-18

### Added
- QR Code payment scanner for merchant checkout
  - New "Scan QR Code to Pay" button on home screen
  - Camera-based QR scanner with scanning frame overlay and corner markers
  - Torch toggle button for low-light scanning
  - Support for Universal Link format (`https://wsim.banksim.ca/pay/{requestId}`)
  - Support for Deep Link format (`mwsim://payment/{requestId}`)
  - Camera permission handling with Settings redirect
  - Invalid QR code detection with user-friendly error messages
  - Navigation to existing payment approval flow on successful scan
- Environment badge always visible on home screen (green=Production, orange=Development)
- Debug logging for payment API calls showing full URL and error details

### Fixed
- Camera permission not appearing in iOS Settings (added expo-camera plugin for native code generation)
- Camera permission not triggering (switched to `useCameraPermissions()` hook)
- QR scanner now supports development environment URLs (`wsim-dev.banksim.ca`)
- **iOS Settings environment selector not working** (Build 8)
  - Settings.bundle values were not being read by the app
  - Added `withSettingsDefaults` Expo config plugin to register Settings.bundle defaults in AppDelegate at startup
  - Environment changes in iOS Settings now correctly switch between Development and Production servers

### Technical
- Added `expo-camera` dependency and plugin for QR scanning (replaces deprecated expo-barcode-scanner)
- Added `NSCameraUsageDescription` to Info.plist for camera permission
- QR URL regex updated to match both production and development URLs
- Added `withSettingsDefaults` Expo config plugin (`plugins/withSettingsDefaults.js`)
  - Modifies AppDelegate.swift to call `UserDefaults.standard.register(defaults:)` at startup
  - Reads Settings.bundle/Root.plist and extracts default values for each preference
  - Ensures iOS Settings values are available to React Native's `Settings.get()` API

### Developer Experience
- Added Jest testing framework with full Expo/React Native support
  - Jest v29.7.0 with jest-expo v54.0.16 preset
  - @testing-library/react-native v13.3.3 for component testing
  - @testing-library/jest-native v5.4.3 for enhanced matchers
- Test scripts: `npm test`, `npm run test:watch`, `npm run test:coverage`
- Initial test coverage for core services:
  - `secureStorage.ts` - 100% coverage (27 tests)
  - `environment.ts` - 58% coverage (17 tests)
  - `withSettingsDefaults.js` plugin - 100% coverage (3 tests)
- Jest configuration with Expo-specific mocks for expo-secure-store, expo-local-authentication, expo-device, expo-web-browser, and expo-camera

## [1.0.1] - 2025-12-16

### Added
- Custom splash screen with Joey kangaroo logo, "Mobile Wallet Simulator" branding, and SimToolBox link
- Automatic code signing team configuration via Expo config plugin (`withSigningTeam`)
- Environment switching via iOS Settings bundle (Development/Production toggle)
- Settings.bundle integration for native iOS Settings app
- TestFlight build configuration with proper versioning

### Changed
- Default environment changed from Development to Production
- Native splash screen now uses solid blue background (#E3F2FD) to avoid animation scaling artifacts
- Replaced unmaintained `expo-settings` with React Native's built-in `NativeModules.SettingsManager`

### Fixed
- Network connectivity on physical devices (dev API URL doesn't exist)
- Splash screen animation no longer shows oversized Joey during iOS launch
- Settings.bundle now correctly appears in iOS Settings app via post-prebuild script
- Code signing team persists across `expo prebuild --clean` operations

## [1.0.0] - 2025-12-15

### Added
- Complete customer onboarding flow
  - Account creation with email and name
  - Email verification login flow
  - Biometric setup (Face ID / Touch ID) with graceful fallback
  - Device registration with unique device IDs
  - JWT token storage and automatic refresh

- Bank enrollment via OAuth
  - Bank selection screen with available banks from wsim API
  - OAuth enrollment via expo-web-browser (system browser)
  - Deep link handling for callbacks (mwsim:// scheme)
  - Automatic wallet refresh after successful enrollment

- Wallet management
  - Home screen with user greeting and card list
  - Card display with type, last four digits, and bank info
  - Set card as default
  - Remove card from wallet
  - Card details view
  - Add more banks functionality

- Payment authorization
  - Deep link handler for payment requests (`mwsim://payment/:requestId`)
  - Payment approval screen with merchant info and card selection
  - Biometric authorization for payments
  - Cold-start auth flow (preserve requestId across login)
  - SecureStore persistence for interrupted payments
  - Return URL with mwsim_return context parameter
  - Browser-aware return flow (Safari and Chrome verified on iOS)

- Developer tools
  - Reset Device button for testing (generates new device ID)
  - Debug console logging for enrollment flow

### Technical
- Expo SDK 54 with TypeScript
- React Native New Architecture enabled
- Axios API client with JWT interceptors
- expo-secure-store for credential storage
- expo-local-authentication for biometrics
- State-based navigation (iOS 26.1 compatible)
