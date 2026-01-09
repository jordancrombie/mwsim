# Changelog

All notable changes to the mwsim (Mobile Wallet Simulator) project will be documented in this file.

## [1.5.12] - 2026-01-09 - Settings Screen & UI Improvements

### Added (Build 76)
- **Profile API Service (M-6)**
  - Added profile API endpoints to api.ts:
    - `getProfile()` - Fetch user profile data
    - `updateProfile()` - Update display name
    - `uploadProfileImage()` - Upload profile image (multipart/form-data)
    - `deleteProfileImage()` - Remove profile image
  - ProfileEditScreen now calls WSIM API for profile updates
  - Home screen ProfileAvatar displays profile image when available
  - Added `profileImageUrl` field to User type

### Added (Build 75)
- **Image Picker Integration (M-5)**
  - Added expo-image-picker for profile photo selection
  - Action sheet with "Take Photo" and "Choose from Library" options
  - Camera permission handling with user-friendly prompts
  - Photo library permission handling
  - Square crop (1:1 aspect ratio) with 80% quality compression
  - Updated camera usage description to include profile photos
  - Added NSPhotoLibraryUsageDescription for iOS

### Added (Build 74)
- **Profile Edit Screen (M-4)**
  - New screen accessible from Settings > Profile & Image
  - Large ProfileAvatar with "Edit" badge for photo changes
  - Editable display name field with validation (2-50 characters)
  - "Change Photo" and "Remove Photo" buttons (image picker pending M-5)
  - Read-only email display section
  - Unsaved changes warning dialog when navigating back
  - Keyboard-aware layout with proper iOS padding
  - Save updates local state (API integration pending M-6)

### Added (Build 73)
- **Profile Avatar in Home Screen Greeting**
  - Displays user avatar (initials) next to "Welcome back" greeting
  - Uses medium size (64px) ProfileAvatar component
  - Deterministic color based on user ID for consistent appearance
  - Ready for profile image display once image upload is connected

### Added (Build 72)
- **Settings Screen Infrastructure**
  - iOS-style settings screen accessible via gear icon in header
  - Grouped settings rows: Profile, Account, About, Account Actions
  - Sign Out button with confirmation dialog
  - Reset Device option (dev mode) for deep logout with push token deactivation

- **Profile Avatar Component**
  - Reusable `ProfileAvatar` component with image support and initials fallback
  - Three sizes: small (32px), medium (64px), large (128px)
  - Deterministic color generation from user ID for consistent avatar colors
  - Initials algorithm: single word → first 2 chars, multiple words → first + last initials

- **Environment Badge Relocation**
  - Moved environment badge (Development/Production) from top-right to under user name
  - Smaller, inline styling that fits neatly under the greeting
  - Long-press still shows environment debug info

---

## [1.5.12] - 2026-01-08 - Payment Received Animation

### Added (Build 71)
- **Payment Received Animation**
  - Replaces popup alert with smooth animated overlay when merchant receives payment
  - Large animated checkmark with "Payment Received" title and amount/sender details
  - Smooth 500ms fade in with scale effect, 3 second display, 500ms fade out
  - Returns seamlessly to QR code after animation completes
  - New `MerchantPaymentSuccess` component with customizable timing

---

## [1.5.11] - 2026-01-08 - Enhanced iPad Layout

### Added (Build 70)
- **Enhanced iPad Layout**
  - QR code increased to 380px on iPad (was 300px, iPhone remains 200px)
  - QR section now expands dynamically to fill available space
  - Stats text larger on iPad: 32px values / 16px labels (vs 24px / 13px on iPhone)
  - Removes gap between QR card and stats section

---

## [1.5.10] - 2026-01-08 - iPad Layout & QR Auto-Refresh

### Added (Build 69)
- **iPad Responsive Layout**
  - Merchant QR code is now larger on iPad (300px vs 200px on iPhone)
  - Countdown border is 50% thicker on iPad (6px vs 4px) with rounded corners
  - Stats and recent payments pushed to bottom of screen on iPad
  - Uses `useWindowDimensions` hook for responsive sizing

- **QR Code Auto-Refresh**
  - Merchant QR code now automatically regenerates when countdown timer expires
  - No manual refresh needed - seamless continuous QR availability
  - Uses `onExpired` callback in QRCountdownBorder component

---

## [1.5.9] - 2026-01-08 - QR Countdown Timer & Bug Fixes

### Added (Build 68)
- **QR Code Countdown Border**
  - Visual countdown timer around merchant and personal receive QR codes
  - Border depletes counter-clockwise as QR code approaches expiration
  - Color transitions: green → yellow → red as time runs out
  - Provides visual feedback on QR code validity without checking expiry text

### Fixed (Build 68)
- **P2P QR Scanner Camera Permission**
  - Fixed: P2P "Scan QR" button now properly requests camera permission on first use
  - Previously showed "Camera Access Required - go to Settings" instead of prompting
  - Now consistent with Cards tab QR scanner behavior

- **Rate Limit Handling (429 Errors)**
  - Fixed: App no longer shows P2P enrollment screen when rate limited
  - Now falls back to cached enrollment data on 429 or network errors
  - Prevents false "enroll in P2P" prompts during API rate limiting

- **Login Race Condition**
  - Fixed: "email, password, deviceId, deviceName and platform are required" error
  - Added fallback chain for deviceName: `deviceName || Device.deviceName || platform device`
  - Prevents race condition when logging in immediately after logout

- **"Sent to undefined" in QR Payments**
  - Fixed: Recipient name now shows proper fallback chain instead of "undefined"
  - Displays: merchantName → recipientDisplayName → recipientAlias → "recipient"
  - Applied to biometric prompt, success alert, and confirmation screen

### Changed (Build 68)
- **Default Environment**
  - Debug builds now default to Production environment (was Development)
  - Allows testing against production servers while maintaining console debugging
  - Users can still switch via iOS Settings if Settings.bundle is available

---

## [1.5.8] - 2026-01-07 - QR Send & Dashboard Fixes

### Fixed (Build 67)
- **Sender Side: "sent to undefined" Fix**
  - TransferSim token endpoint now returns `recipientDisplayName` and `recipientBankName`
  - Send confirmation now shows recipient's actual name instead of "undefined"

- **Receiver Side: Dashboard Auto-Refresh Now Works**
  - Dashboard now refreshes for ANY transfer notification when in business mode
  - No longer requires `recipientType: 'merchant'` in push payload
  - More robust handling when WSIM doesn't include all fields

- **Today Stats Timezone Fix**
  - "Today" revenue now calculated in user's local timezone (not UTC)
  - Dashboard API accepts `tzOffset` parameter from client
  - Eastern timezone users now see correct "Today" transaction counts

### Technical
- TransferSim `/api/v1/tokens/:tokenId` now calls BSIM to fetch display name and bank name
- Added `isTransferNotification()` helper for more robust notification detection
- Dashboard API calculates start-of-day using client's timezone offset
- mwsim passes `tzOffset` (from `getTimezoneOffset()`) to dashboard API

---

## [1.5.7] - 2026-01-07 - TransferSim Webhook Spec Alignment

### Fixed (Build 66)
- **Notification Parsing Aligned with TransferSim Webhook Spec**
  - Fixed: `amount` parsing now handles string format (`"25.00"`) per spec
  - Fixed: `senderDisplayName` field now recognized (in addition to `senderName`)
  - Fixed: `transfer.completed` event type now triggers merchant dashboard refresh
  - Added: `merchantName` field support for merchant payments

### Technical
- Aligned with TransferSim `transfer.completed` webhook specification
- `parseNotificationData()` now parses string amounts via `parseFloat()`
- `isMerchantPaymentNotification()` accepts `transfer.completed` type
- Added debug logging for notification payload troubleshooting

### Expected Push Payload (per TransferSim spec)
```json
{
  "data": {
    "type": "transfer.completed",
    "transferId": "p2p_xyz789abc012345678901234",
    "recipientType": "merchant",
    "merchantName": "Sarah's Bakery",
    "senderDisplayName": "Bob Smith",
    "amount": "25.00"
  }
}
```

---

## [1.5.6] - 2026-01-07 - Real-Time Merchant Dashboard Updates

### Added (Build 65)
- **Real-Time Merchant Dashboard Updates**
  - Merchant dashboard now auto-refreshes when a payment notification is received
  - Today's revenue, This Week, and Transactions counters update immediately
  - Toast notification: "💰 Payment Received - $X.XX from [sender]"
  - Works when app is in foreground and user is in Business mode

### Technical
- Extended `NotificationData` type with payment fields (`amount`, `senderName`, `recipientType`)
- Added `parseNotificationData()` helper to safely parse notification payloads
- Added `isMerchantPaymentNotification()` to detect merchant payment notifications
- Added refs (`p2pModeRef`, `isMicroMerchantRef`) to avoid stale closure in notification callbacks
- Foreground notification listener now triggers `loadMerchantDashboard()` for merchant payments

---

## [1.5.5] - 2026-01-07 - Merchant Dashboard Stats Fix

### Fixed (Build 64)
- **Merchant Dashboard Stats Not Updating**
  - Fixed: Dashboard stats (Today, This Week, Transactions) now properly parse TransferSim API response
  - Root cause: API schema mismatch - mwsim expected flat fields, TransferSim returns nested time periods
  - TransferSim API structure: `{ today: {...}, last7Days: {...}, allTime: {...} }`
  - Added proper response parsing to convert `today.totalReceived` → `todayRevenue`, etc.
  - Added debug logging to trace dashboard API responses

### Technical
- Added `MerchantPeriodStats` type for time period stats structure
- Added `MerchantDashboardResponse` type matching actual TransferSim API contract
- Updated `getMerchantStats()` to parse nested response structure
- Decimal string parsing (`"500.00"` → `500.00`) for revenue values

---

## [1.5.4] - 2026-01-06 - Deep Logout & Push Notification Fixes

### Added (Build 63)
- **Deep Logout (Long-Press)**
  - Long-press (2 seconds) on "Sign Out" button triggers deep logout
  - Deactivates push token for this device before signing out
  - Shows confirmation alert: "Device Cleared"
  - Fixes cross-device notification issue when multiple users test on same device
  - Normal tap still performs regular logout (no change for end users)

### Technical
- Added `handleDeepLogout()` function with push token deactivation
- Changed Sign Out button from `TouchableOpacity` to `Pressable` with `onLongPress`
- Added `Pressable` to react-native imports

---

## [1.5.3] - 2026-01-06 - Universal Links & QR Scanner Improvements

### Fixed (Build 62)
- **P2P QR Transfer - recipientAliasType**
  - Fixed: P2P transfers via QR code now pass `recipientAliasType` to TransferSim API
  - TransferSim v0.4.3 now returns `recipientAliasType` in token resolution
  - Resolves "Could not determine alias type" error when sending via QR scan

- **QR Scanner Debouncing**
  - Fixed: QR scanner no longer fires multiple times on error
  - Added synchronous ref locks to prevent rapid-fire scans
  - Scanner stays locked until user dismisses error dialog
  - Prevents "spinning out" when scanning invalid QR codes

### Technical
- Added `qrScanLockRef` and `p2pQrScanLockRef` refs for synchronous scan locking
- Updated `ResolvedToken` type to include optional `recipientAliasType` field
- Updated `sendMoney()` function to accept optional `recipientAliasType` parameter

---

## [1.5.3] - 2026-01-05 - Bug Fixes & UX Improvements

### Fixed (Build 59)
- **Share Button in Business Section**
  - Fixed: Share button in Micro Merchant dashboard now works
  - Shares merchant payment info with alias for easy customer sharing

- **Auto-Generate QR Codes**
  - QR codes now auto-generate when opening Receive Money screen
  - QR codes now auto-generate when switching to Business mode
  - No longer requires manual tap on "Generate QR Code" button
  - Created top-level `generatePersonalQR()` function for reuse

- **P2P Enrollment State on App Restart**
  - Fixed: P2P enrollment status now checked on app initialization
  - Previously, users had to manually tap P2P tab to trigger enrollment check
  - Now `checkP2PEnrollment()` runs after wallet summary loads on login

- **Personal Receive QR Code Layout**
  - Fixed: QR code container now properly sized (248x280) with 16px padding
  - QR code no longer bumps into top of frame when expiry text is shown
  - Equal spacing on all sides of QR code within container

### Technical
- Added `generatePersonalQR()` at component level (moved from render block)
- Added useEffect hooks for auto-QR generation on screen/mode changes
- Added `checkP2PEnrollment()` call in `initializeApp()` after successful login

### DevOps
- Created CI/CD build guide (`docs/CICD_BUILD_GUIDE.md`)
- Documented Buildkite and GitHub Actions pipeline configurations
- Added App Store Connect API key authentication for TestFlight uploads
- Pipeline templates available locally (excluded from repo for security)

---

## [1.5.2] - 2026-01-04 - Micro Merchant & QR Code Fixes

### Fixed (Build 58)
- **Micro Merchant Enrollment API Schema Mismatch**
  - Fixed field names to match TransferSim API contract:
    - `businessName` → `merchantName`
    - `category` → `merchantCategory`
  - Fixed enum values:
    - `FOOD_BEVERAGE` → `FOOD_AND_BEVERAGE`
    - `HEALTH_BEAUTY` → `HEALTH_AND_BEAUTY`
    - `CRAFTS_ARTISAN` → `CRAFTS_AND_HANDMADE`
  - Merchant registration now works correctly in both dev and production

- **QR Code Rendering**
  - Added `react-native-qrcode-svg` library for actual QR code generation
  - Merchant QR codes now display scannable QR codes instead of placeholder emoji
  - Personal receive QR codes also now render properly

- **Share Alias Crash**
  - Fixed crash when tapping "Share Alias" button on Receive screen
  - Root cause: Dynamic import of `Share` module caused crash with New Architecture
  - Solution: Moved `Share` to static imports at top of file

- **Merchant QR Code UI**
  - Fixed overlapping text issue when QR code is displayed
  - Title now dynamically shows "Scan to pay [merchant name]" when QR is generated

### Technical
- Added `react-native-qrcode-svg` and `react-native-svg` dependencies
- Updated `MerchantEnrollmentRequest`, `MerchantProfile`, and `MerchantCategory` types
- Added static `Share` import to prevent dynamic import crashes

---

## [1.5.1] - 2026-01-04 - Push Notification Token Fix

### Fixed (Build 57)
- **Push Token Not Re-registering After Device Reset**
  - Fixed: `handleResetDevice` now clears `notificationsRequested` state
  - Previously, after Reset Device, the notification init would return early because `notificationsRequested` was still `true`
  - This caused APNs to reject tokens as "Unregistered" because the new device ID was never associated with the push token
  - Now, after reset, the app properly re-registers the push token with the new device ID on next login

### Technical
- Added `setNotificationsRequested(false)` to `handleResetDevice()` in App.tsx
- Push notification infrastructure confirmed working end-to-end on dev environment

---

## [1.4.1] - 2026-01-04 - P2P Transfer Details Investigation

### Investigation (Build 54)
- **TransferSim API Issues Identified**
  - Added debug logging to diagnose P2P transfer display issues
  - Identified three backend bugs in TransferSim API:

1. **Alias Lookup Missing Display Name**
   - Endpoint: `GET /api/v1/aliases/lookup`
   - Issue: Response doesn't include `displayName` field
   - Impact: Recipient confirmation only shows bank name, not user's name

2. **Received Transfers Missing Sender Info**
   - Endpoint: `GET /api/v1/transfers`
   - Issue: Response missing `senderAlias`, `senderDisplayName`, `senderBankName`
   - Impact: Transfer history shows "Unknown" for received transfers

3. **Direction Filter Ignored**
   - Endpoint: `GET /api/v1/transfers?direction=sent`
   - Issue: `direction` query param is ignored, returns all transfers
   - Impact: All/Sent/Received filter buttons don't work

### Added
- Debug logging for `lookupAlias()` response
- Debug logging for `getTransfers()` with direction param and response

---

## [1.4.0] - 2026-01-03 - P2P Transfer Integration & Micro Merchants

### Improved (Build 53)
- **Data Refresh Strategy**
  - P2P enrollment check now runs in background after login (both password and verify code flows)
  - P2P data (accounts, aliases, transfers) refreshes after bank enrollment completion
  - `loadP2PData()` now called after P2P enrollment to immediately populate accounts
  - Ensures "From Account" is available immediately after P2P enrollment without app restart

- **Environment Configuration Cleanup**
  - Restored proper iOS Settings.bundle reading for environment selection
  - Environment now correctly reads from iOS Settings > mwsim > Server
  - Removed debug logging from API interceptors (cleaner production logs)
  - Cleaned up verbose `getAccounts()` and `getPaymentDetails()` debug output

### Investigation Complete (Build 52+)
- **Root Cause of P2P Tab Crash Identified**
  - The crash was caused by `loadP2PData()` being called on EVERY P2P tab switch (added in Build 29)
  - When transfers existed, the race between API fetch and React render caused native TurboModule crash
  - Empty transfer array = no crash; transfers present = crash during render
  - Solution: Removed aggressive tab-switch refreshing; use pull-to-refresh instead

- **Transfer Data Sanitization Added**
  - Added `sanitizeTransfer()` and `sanitizeTransfers()` functions in transferSim.ts
  - All transfers from API are now validated with safe defaults for required fields
  - Prevents crashes from malformed API data (null amount, missing createdAt, etc.)
  - Safe defaults: `amount=0`, `direction='sent'`, `status='PENDING'`, `createdAt=now`
  - Also added `sanitizeMerchantTransfer()` for Micro Merchant transactions

### Fixed (Build 33)
- **TurboModule Crash on P2P Tab (Native Side)**
  - Fixed: Added try-catch protection to all SecureStorage JSON.parse calls
  - Crash was occurring in React Native TurboModule when accessing SecureStore
  - Protected: `getUserData()`, `getCachedCards()`, `getP2PUserContext()`, `getP2PEnrollment()`
  - Malformed or corrupted stored data no longer crashes the app
  - Additional defensive null checks for transfer arrays in render code
  - Added `.filter(t => t != null)` before mapping over transfer arrays

### Fixed (Build 32)
- **App Crash on P2P Tab for Users with Transfers**
  - Fixed: Defensive null checks for all transfer arrays (recentTransfers, historyTransfers, merchantTransfers)
  - API responses may return null for `transfers` field; now defaults to empty array
  - Added null safety to `loadP2PData()`, `loadHistoryTransfers()`, `loadMerchantTransfers()`
  - Fixed `getStatusColor()` calls to handle undefined status
  - Fixed `selectedTransfer.transferId.substring()` crash when transferId is undefined

- **FROM ACCOUNT Not Showing After Initial P2P Enrollment**
  - Fixed: `loadP2PData()` is now called immediately after P2P enrollment completes
  - Previously, accounts were only loaded when switching tabs (not during initial enrollment flow)
  - Users can now send money right after enrolling without needing to log out/in

### Fixed (Build 31)
- **App Crash After P2P Transfer**
  - Fixed: Null safety checks added to all transfer rendering code
  - Transfer list items now handle undefined fields (amount, createdAt, transferId, aliases)
  - `formatDate()` and `formatFullDate()` functions now gracefully handle undefined dates
  - Prevents crash when navigating back to P2P screen after completing a transfer

- **Success Animation Not Reflecting Actual Transfer Outcome**
  - Fixed: Success screen now shows status-aware icons and titles based on actual transfer status
  - Processing (⏳ orange): Shows while status is PENDING, RESOLVING, DEBITING, or CREDITING
  - Success (✓ green): Shows when transfer status is COMPLETED
  - Failed (✕ red): Shows for DEBIT_FAILED, CREDIT_FAILED, CANCELLED, EXPIRED, REVERSED, RECIPIENT_NOT_FOUND
  - Previously always showed success icon regardless of actual outcome

### Fixed (Build 30)
- **P2P Transfer Status Display**
  - Fixed: Success screen now shows user-friendly status ("Transfer Complete", "Processing...") instead of raw codes like "PENDING"
  - Added: Polls TransferSim after 1 second to get confirmed final status (transfers complete in <1s)
  - Status text now color-coded: green for complete, orange for processing, red for failed

- **P2P Account Balance Not Updating After Transfer**
  - Fixed: Account balances now refresh when user taps "Done" on success screen
  - Calls `loadP2PData()` to fetch fresh balances from BSIM Open Banking API
  - User sees updated balance immediately upon returning to P2P home

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
