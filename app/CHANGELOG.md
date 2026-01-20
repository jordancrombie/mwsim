# Changelog

All notable changes to mwsim are documented in this file.

## [2.0.5] - 2026-01-20

### Added
- **Welcome Tutorial**: Multi-page swipeable onboarding tutorial for new users
  - 5 pages covering: Cards, P2P Transfers, Business Payments, Contracts, Settings
  - Shows on first login after install (priority 200, above other pitch pages)
  - Swipe navigation with page indicator dots
  - "Next" and "Skip to End" buttons on intermediate pages
- **Profile Navigation**: Tap avatars to view profiles
  - Home screen avatar → Edit Profile (self)
  - Transfer detail counterparty → View User Profile
  - Contract detail party → View User Profile
- **User Profile Screen**: Read-only profile view for other users
  - Shows avatar, display name, and alias
  - Trust status with verification level and badge
  - "What This Means" explanation card
- **Trust Status in Edit Profile**: Shows user's own verification status
  - Displays verification level (Unverified/Silver/Gold)
  - Link to verify identity if not verified

## [2.0.4] - 2026-01-20

### Fixed
- **Pitch Page Display**: Fixed pitch page not showing on subsequent logins
  - Added pitch page check to login flow (previously only ran on app startup)
  - Fixed app hanging on loading screen when pitch page was found
  - Added "Reset Pitch Pages" debug option in Settings

## [2.0.3] - 2026-01-20

### Added
- **Pitch Page System**: Promotional screens shown to users on login based on eligibility
  - First pitch page: "Become a Trusted User" for unverified users
  - Explains benefits: Higher transfer limits, more QR codes, business payments
  - Instructions on how to verify identity
  - "Don't show again" checkbox for permanent dismissal
  - Client-side MVP with local dismissal tracking

### Fixed
- **Settings Version Display**: App version and build number now dynamically read from app config
  - Previously showed hardcoded "1.5.12" instead of actual version
  - Uses expo-constants to read version from app.json at runtime

## [2.0.2] - 2026-01-20

### Fixed
- **Transfer Notification Sender Display**: Fixed "Unknown" showing for sender when opening transfer from push notification
  - Notification data now passes sender name through to deep link handler
  - Uses notification sender name as fallback when TransferSim API doesn't return profile data

## [2.0.1] - 2026-01-19

### Added
- **Liveness Selfie Verification**: Completes the identity verification chain
  - Captures forward-facing selfie during liveness check (blink/smile challenges)
  - Compares selfie to both passport photo and profile photo
  - All three faces must match for enhanced verification (passport↔profile↔selfie)
- **Bitcode Strip Plugin**: Expo config plugin to strip bitcode from OpenSSL.framework
  - Automatically strips bitcode during build (deprecated since Xcode 14)
  - Re-signs framework after modification
  - Fixes App Store rejection for bitcode in react-native-nfc-passport-info

### Fixed
- **Verification Badge Display**: Verification badges now show on other users' avatars
  - Transfers show sender/recipient verification status
  - Contracts show counterparty verification status
  - Contract detail shows party verification status

## [2.0.0] - 2026-01-19

### Added
- **Identity Verification (IDV)**: Complete passport-based identity verification
  - MRZ scanning via camera with ML Kit text recognition
  - Manual MRZ entry fallback option
  - NFC passport chip reading using react-native-nfc-passport-info
  - Extracts biographic data and photo from passport chip
- **Face Detection & Comparison**: ML Kit-powered facial recognition
  - Compares passport photo to profile photo for identity verification
  - Face quality validation (size, rotation, blur detection)
  - Configurable similarity threshold (70%)
- **Liveness Detection**: Anti-spoofing challenges during verification
  - Random challenge sequence: blink, smile, turn left, turn right
  - Real-time face tracking with front camera
  - Skip option for users who prefer basic verification
- **Verification Levels**: Tiered identity verification
  - Basic: Name match only (silver badge)
  - Enhanced: Name match + face match + liveness (gold badge)
- **MRZ Scanner Service**: OCR text processing for Machine Readable Zone
  - Automatic OCR error correction (O→0, K→<, W→M in sex field)
  - Support for TD3 (passport) and TD1 (ID card) formats
  - Tolerant parsing with autocorrect for check digit errors
- **NFC Passport Service**: Passport chip reading via NFC
  - BAC (Basic Access Control) authentication
  - Extracts DG1 (biographic data) and DG2 (photo)
- **Trusted User System**: Full verification workflow
  - Verification service with name matching (Levenshtein fuzzy matching, 85% threshold)
  - Signed verification payloads for server-side validation (HMAC-SHA256)
  - Verification badge on ProfileAvatar (silver for basic, gold for enhanced)
  - Remove verification option in Settings
- **Transfer Type Indicators**: Visual badges for transfer sources
  - Wager transfers show purple "🎲 Wager" badge
  - Contract transfers show blue "📜 Contract" badge
  - Applied to both Recent Transfers and Transfer History screens
- **Account Deletion**: Users can permanently delete their account from Settings

### Fixed
- **BAC Authentication**: Document number now correctly right-padded to 9 characters
  - Fixes InvalidMRZKey error caused by library bug (left-padding instead of right-padding)
- **Profile Resolution**: Fixed UUID display in transfers and contracts
  - Transfers use bsimUserId + bsimId lookup
  - Contracts use walletId lookup
  - Consistent alias vs display name handling in UI
- **Liveness Detection**: Fixed stale closure issues with challenge completion
  - Uses refs to track completed challenges reliably
  - Prevents duplicate completion triggers

### Changed
- **NFC Plugin**: Expo config plugin for NFC entitlements
  - iOS: CoreNFC entitlements and ISO7816 AID for eMRTD
  - Android: NFC permission and feature declarations
- **MasterList Plugin**: Adds masterList.pem to iOS bundle for passport certificate verification
- **Deployment Target Plugin**: Ensures iOS 15.5 minimum for ML Kit

### Dependencies
- Added react-native-nfc-passport-info for NFC passport reading
- Added @react-native-ml-kit/text-recognition for MRZ OCR
- Added @react-native-ml-kit/face-detection for face detection
- Added mrz library for MRZ parsing and validation
- Added expo-image-manipulator for image orientation normalization

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
