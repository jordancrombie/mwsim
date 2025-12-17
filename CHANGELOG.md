# Changelog

All notable changes to the mwsim (Mobile Wallet Simulator) project will be documented in this file.

## [1.1.0] - 2025-12-17

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

### Fixed
- Camera permission not appearing in iOS Settings (added expo-camera plugin for native code generation)

### Technical
- Added `expo-camera` dependency and plugin for QR scanning (replaces deprecated expo-barcode-scanner)
- Added `NSCameraUsageDescription` to Info.plist for camera permission

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
