# Changelog

All notable changes to mwsim are documented in this file.

## [1.9.0] - 2026-01-19 (WIP)

### Added
- **Identity Verification (IDV)**: NFC-based passport verification flow
  - MRZ scanning via camera with ML Kit text recognition
  - Manual MRZ entry fallback option
  - NFC passport chip reading using react-native-nfc-passport-info
  - Extracts biographic data and photo from passport chip
- **MRZ Scanner Service**: OCR text processing for Machine Readable Zone
  - Automatic OCR error correction (O→0, K→<, W→M in sex field)
  - Support for TD3 (passport) and TD1 (ID card) formats
  - Tolerant parsing with autocorrect for check digit errors
- **NFC Passport Service**: Passport chip reading via NFC
  - BAC (Basic Access Control) authentication
  - Extracts DG1 (biographic data) and DG2 (photo)
- **NFC Plugin**: Expo config plugin for NFC entitlements
  - iOS: CoreNFC entitlements and ISO7816 AID for eMRTD
  - Android: NFC permission and feature declarations
- **MasterList Plugin**: Adds masterList.pem to iOS bundle for passport certificate verification
- **Deployment Target Plugin**: Ensures iOS 15.5 minimum for ML Kit text recognition
- **Trusted User Verification (Phase 1 - Foundation)**:
  - Verification service with name matching (Levenshtein fuzzy matching, 85% threshold)
  - Signed verification payloads for server-side validation (HMAC-SHA256)
  - Verification badge on ProfileAvatar (silver for basic, gold for enhanced)
  - User type extended with isVerified, verifiedAt, verificationLevel fields

### Fixed
- **BAC Authentication**: Document number now correctly right-padded to 9 characters
  - Fixes InvalidMRZKey error caused by library bug (left-padding instead of right-padding)

### Dependencies
- Added react-native-nfc-passport-info for NFC passport reading
- Added @react-native-ml-kit/text-recognition for MRZ OCR
- Added mrz library for MRZ parsing and validation

## [1.8.3] - 2026-01-18

### Fixed
- **Failed Transfer Display**: Failed/self-transfers now show clearly with visual treatment
  - Human-readable status text ("Failed", "Recipient not found", etc.) instead of raw codes
  - Strikethrough amounts in gray for failed transfers
  - Warning icon on transfer detail screen for failed transfers
  - Reduced opacity for failed transfers in recent transfers list
- **Contract Auto-Refresh**: Contract detail screen now auto-refreshes when push notifications arrive for contract events (accepted, funded, outcome, etc.)
- **Notification Deprecation Warning**: Fixed `shouldShowAlert` deprecation warning in expo-notifications

### Added
- **Contract Notification Handling**: Foreground listener detects contract notifications and triggers screen refresh
- **Fallback Contract Detection**: Title-pattern-based fallback for contract notifications when data payload is null

## [1.8.2] - 2026-01-17

### Changed
- **Oracle Teams Format**: Updated to support new teams object format from WSIM/ContractSim
  - Teams now received as `[{id: "team_a", name: "Team A"}, ...]` instead of `["Team A", ...]`
  - Displays team name in UI, sends team ID for predictions

## [1.8.1] - 2026-01-16

### Added
- **Push Notification Deep Linking**: Tap notifications to navigate directly to relevant screens
  - Contract notifications → Contract Detail screen
  - Payment received notifications → Transfer Detail screen
  - Payment request notifications → P2P Home tab
- **Auto-Refresh on Notification**: Screens automatically refresh when opened via notification tap
- **Contract Notification Types**: Support for all ContractSim webhook events (proposed, accepted, funded, cancelled, expired, outcome, settled, disputed)

### Fixed
- **APNs Payload Parsing**: Handle both direct and nested `body` formats from WSIM notifications

## [1.8.0] - 2026-01-15

### Added
- **ContractSim Integration**: Support for conditional payments via ContractSim service
- **Wager Contracts**: Create peer-to-peer wagers linked to oracle events
- **Contract Management**: View, accept, fund, and track contracts
- **Oracle Events**: Browse available events for contract conditions
- **Auto-Fund on Accept**: Wagers automatically fund when counterparty accepts

### Fixed
- **Contract Status Display**: Normalize status/type to lowercase for API compatibility
- **Counterparty Names**: Add fallback for undefined counterparty names in contract list
- **Contract Review Layout**: Fixed counterparty row spacing in review screen

## [1.7.3] - Build 1 - 2026-01-13

### Changed
- **Environment Default**: Set production as default environment for TestFlight builds

## [1.7.2] - Build 7 - 2026-01-12

### Fixed
- **P2P Enrollment Prompt**: Reset to cards tab on logout to prevent P2P enrollment prompt showing after re-login
- **Merchant Payment Animation**: Responsive sizing for QR payment success animation on mobile devices
- **P2P Profile Images**: Fixed alias lookup showing merchant logo instead of user profile image/initials
- **Transfer Detail Screen**: Show profile avatar instead of generic icon for sender/recipient
- **QR Scan Send Screen**: Display profile avatar for individuals and merchant logo/category icon for businesses
- **QR Scan Avatar Sizing**: Adjusted avatar size and spacing for better mobile appearance
- **QR Scan Flow**: Reset state properly when starting new scan; back button returns to P2P home

## [1.7.2] - Build 6 - 2026-01-11

### Added
- iOS BLE proximity discovery with native GATT advertising

## [1.7.1] - Build 5

### Fixed
- P2P enrollment prompt showing after re-login

## [1.7.0]

### Added
- Micro Merchant feature with QR code payments
- Business profile management
- Transaction history for merchants
