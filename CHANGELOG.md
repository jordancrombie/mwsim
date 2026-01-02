# Changelog

All notable changes to the mwsim (Mobile Wallet Simulator) project will be documented in this file.

## [1.4.0] - 2026-01-01 - P2P Transfer Integration & Micro Merchants

### Fixed (Build 29)
- **P2P Transfer User ID Mismatch**
  - Fixed: P2P transfers now use BSIM's internal user ID (`fiUserRef`) instead of WSIM userId
  - This resolves "account not owned by user" errors when sending P2P transfers
  - TransferSim auth header now sends `fiUserRef:bsimId` for proper BSIM account ownership validation
  - Updated `P2PUserContext` to include `fiUserRef` from bank enrollment
  - WSIM now exposes `fiUserRef` in enrollment list endpoint

### Fixed (Build 28)
- **P2P Accounts Not Loading**
  - Fixed: Bank accounts now refresh when switching to P2P tab (previously only loaded once after enrollment)
  - P2P data (accounts, aliases, transfers) now reloads each time user navigates to P2P tab
  - Enables proper "From Account" selection in Send Money flow

- **Stale User Data After Logout**
  - Fixed: All user-specific state is now cleared on logout
  - Previously, P2P data (aliases, accounts, transfers) persisted between user sessions
  - This caused user7 to see user6's aliases after logout/login
  - Comprehensive state reset now includes:
    - User & auth data
    - Cards & banks
    - P2P core (enrollment, aliases, accounts, transfers)
    - P2P send/receive state
    - Micro Merchant profile and settings
    - Payment request data
  - SecureStorage is also cleared on logout

### Added (Build 20-27)
- **Micro Merchant UI (Phase 1)**
  - "Become a Merchant" enrollment flow with business name, category, and account selection
  - P2P Tab Toggle: Personal/Business segmented control (purple/green accent colors)
  - Merchant Dashboard with QR code display, today's revenue summary, and recent payments
  - Merchant QR Code with green border, business name, and "Micro Merchant" badge
  - Visual differentiation for sender: merchant recipients show green border and storefront icon
  - Fee preview when sending to Micro Merchant (tiered: $0.25 < $200, $0.50 >= $200)
  - Mode-aware transaction history (Personal vs Business)
  - Merchant profile management UI (edit name, category, receiving account, deactivate)

- **TransferSim Merchant API Integration**
  - `enrollMerchant()`, `getMerchantProfile()`, `updateMerchantProfile()`
  - `generateMerchantToken()`, `getMerchantTransfers()`
  - `resolveTokenWithMerchantInfo()`, `calculateMerchantFee()`

- **Build Improvements**
  - New `withXcodeOptimizations` Expo config plugin for automatic Xcode project settings
  - Removes deprecated ENABLE_BITCODE setting
  - Updates LastUpgradeCheck to Xcode 16.2 (1620)
  - Enables whole-module optimization for Release builds
  - Updated TODO.md with custom archive location documentation

### Technical (Build 20-24)
- New types: `MerchantProfile`, `RecipientType`, `p2pMode`
- New state: `isMicroMerchant`, `merchantProfile`, `p2pMode`
- ExportOptions.plist configured for command-line TestFlight uploads

### Fixed (Build 19)
- **Production TransferSim URL**
  - Updated from `transfersim.banksim.ca` to `transfer.banksim.ca`
  - Matches BSIM team production deployment

### Fixed (Build 18)
- **Critical: App Crash on P2P Screens**
  - Moved useState hooks from inside conditional screen blocks to top level
  - React hooks must be called in the same order on every render
  - Affected screens: aliasManagement, receiveMoney, sendMoney, transferHistory, p2pQrScan

- **Critical: App Hanging on Startup**
  - Changed TransferSim client from eager to lazy initialization
  - Client now created on first API call instead of module load time
  - Prevents blocking when native modules aren't ready

- **UI Improvements**
  - Capitalized "Generate a QR Code" text on Receive screen
  - Centered description text under QR code generation
  - Fixed cramped "@username" button - now displays as "Username"

### Added
- **Bottom Tab Navigation**
  - New tab bar with Cards and P2P tabs
  - Seamless switching between wallet and P2P features
  - Active tab indicator with blue highlight

- **P2P Tab with Enrollment**
  - P2P enrollment check on tab access
  - "Enable P2P Transfers" prompt for unenrolled users
  - One-tap enrollment using first connected bank
  - P2P home screen with quick actions (Send, Receive, Aliases, Scan QR)

- **Alias Management**
  - Add new aliases (username, email, or phone)
  - Type selector with @username, Email, Phone options
  - View list of registered aliases
  - Set alias as primary for receiving
  - Delete existing aliases with confirmation

- **Send Money**
  - Send by alias with recipient lookup and preview
  - Multi-step flow: input → confirm → success
  - Amount entry with currency formatting
  - Source account selection
  - Optional note/description
  - Biometric authentication (Face ID/Touch ID) before sending

- **Send by QR Scan**
  - Camera-based QR code scanner
  - Token resolution to get recipient info
  - Pre-filled amount and note when set by recipient
  - Same confirmation and biometric flow as alias send

- **Receive Money Screen**
  - QR code generation via TransferSim token API
  - Share alias via device share sheet
  - Display primary alias prominently
  - Token expiration display

- **Transfer History**
  - Full transfer list with sent/received filtering
  - Direction icons and status colors
  - Relative date formatting
  - Pull-to-refresh functionality

- **Transfer Detail View**
  - Large amount display with direction indicator
  - Status badge with human-readable text
  - Counterparty info (name, alias, bank)
  - Note/description with callout styling
  - Transaction details (date, completion time, reference ID)

- **TransferSim Service Integration**
  - New `transferSim.ts` API client
  - X-API-Key authentication for orchestrator
  - Authorization header with userId:bsimId format
  - Enrollment, alias, transfer, and token endpoints
  - Environment-aware URLs (dev/prod via iOS Settings)

### Technical
- **New Types** (`src/types/index.ts`)
  - `Alias`, `AliasType` - Alias management
  - `Transfer`, `TransferStatus`, `TransferDirection` - P2P transfers
  - `BankAccount` - Bank accounts for P2P (different from cards)
  - `P2PEnrollment`, `P2PState` - Enrollment tracking
  - `ReceiveToken`, `ResolvedToken` - QR token handling
  - `AliasLookupResult` - Alias search results

- **Secure Storage** (`src/services/secureStorage.ts`)
  - `P2P_USER_CONTEXT` - userId and bsimId for TransferSim auth
  - `P2P_LAST_ACCOUNT` - Remember last used account
  - `P2P_ENROLLMENT` - Cached enrollment status
  - All P2P data cleared on logout

- **Biometric Service** (`src/services/biometric.ts`)
  - `authenticateForTransfer()` - Transfer-specific auth prompt

- **Environment Service** (`src/services/environment.ts`)
  - Added `transferSimUrl` to environment config
  - Added `getTransferSimUrl()` for P2P API calls
  - Development: `https://transfersim-dev.banksim.ca`
  - Production: `https://transfersim.banksim.ca`

## [1.3.0] - 2025-12-24 - Multi-Bank & P2P Support

### Added
- **Bank Logo Display**
  - Card component now displays bank logo (24x24) next to bank name
  - Fallback to bank initials when logo unavailable or fails to load
  - BankListItem component updated to use logoUrl

- **P2P Transfers Planning**
  - Added comprehensive P2P section to TODO.md
  - Planned features: alias management, send/receive money, QR codes, transfer history

### Changed
- **Type Updates for Multi-Bank API**
  - `Card.bankLogoUrl` - Bank logo URL (optional)
  - `Bank.logoUrl` - Renamed from `logo` for API consistency
  - `EnrolledBank.logoUrl` - Bank logo URL
  - `EnrolledBank.credentialExpiry` - Credential expiration date
  - `PaymentCard.bankLogoUrl` - Bank logo URL for payment selection

### Documentation
- Updated MWSIM_MULTI_BANK_PROPOSAL.md with implementation status
- Updated MULTI_BANK_PROJECT_TRACKER.md with completed tasks

## [1.2.3] - 2025-12-19

### Fixed
- **Payment Approval Screen Layout**
  - Fixed Order Items and Price Breakdown sections not displaying
  - Implemented proper nested card structure as intended:
    - Blue Total Amount card standalone at top
    - Outer container card (light gray background) containing:
      - Merchant name header
      - Order Summary cards (Order Items + Price Breakdown) with full styling
      - Payment Method card nested inside
  - Removed broken `embedded` mode from OrderSummary component usage

### Technical
- New styles: `outerCard`, `outerCardContent`, `nestedCard`
- OrderSummary now renders with default `embedded={false}` for proper card display

## [1.2.2] - 2025-12-18

### Changed
- **Improved Payment Approval Screen Layout**
  - Moved Total Amount card to top of screen for immediate visibility
  - Combined merchant name with order details in single card container
  - Order Items and Price Breakdown sections now embedded within order card
  - Reduced vertical space usage to fit all content on one screen
  - Removed large merchant logo placeholder that was taking up space

### Technical
- Added `embedded` prop to OrderSummary component for seamless card integration
- New styles: `orderCard`, `orderCardMerchantHeader`, `containerEmbedded`, `sectionEmbedded`

## [1.2.1] - 2025-12-18

### Added
- **Animated Success Screen for Payment Approval**
  - Green circle with animated checkmark appears after successful payment
  - Circle scales in with spring bounce effect (~300ms)
  - Checkmark fades in and scales with smooth easing (~800ms)
  - "Payment Approved" message fades in below animation
  - 2-second hold before showing stay/redirect options
  - Configurable animation duration and delay timing

### Technical
- New `SuccessAnimation` component (`src/components/SuccessAnimation.tsx`)
  - Uses React Native's built-in Animated API (no additional dependencies)
  - Configurable `animationDuration` and `delayAfterAnimation` props
  - `onComplete` callback for integration with payment flow
- Added 6 unit tests for SuccessAnimation component (169 total tests)

## [1.2.0] - 2025-12-18

### Added
- **Enhanced Purchase Information on Payment Approval Screen**
  - Itemized line items showing product name, quantity, unit price, and line total
  - Collapsible item list: shows first 5 items, "View all X items" expands inline
  - Cost breakdown section: subtotal, shipping (with method), tax (with rate/label)
  - Discount display with promo codes in green negative values
  - Additional fees display
  - Accessibility labels for all order details elements (VoiceOver support)
  - Fallback to simple amount display when orderDetails is not provided

### Technical
- Added `OrderDetails` types to `src/types/index.ts`:
  - `OrderLineItem`, `OrderShipping`, `OrderTax`, `OrderDiscount`, `OrderFee`, `OrderDetails`
  - Extended `PaymentRequest` interface with optional `orderDetails` field
- New `OrderSummary` component (`src/components/OrderSummary.tsx`)
  - Handles currency formatting with `Intl.NumberFormat`
  - Text truncation for long product names (35 chars max)
  - Decimal quantity support for weight-based items

### Developer Experience
- Added 25 unit tests for OrderSummary component (163 total tests)
- Tests cover: line items, collapsible behavior, cost breakdown, edge cases

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
- Test coverage for core services (138 tests total):
  - `biometric.ts` - 100% coverage (32 tests) - capabilities, authentication, error handling
  - `browserReturn.ts` - 95% coverage (21 tests) - browser URL construction, iOS/Android routing
  - `api.ts` - 94% coverage (38 tests) - auth, wallet, enrollment, payment endpoints
  - `secureStorage.ts` - 100% coverage (27 tests)
  - `environment.ts` - 58% coverage (17 tests)
  - `withSettingsDefaults.js` plugin - 100% coverage (3 tests)
- Jest configuration with Expo-specific mocks for axios, expo-secure-store, expo-local-authentication, expo-device, expo-web-browser, and expo-camera

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
