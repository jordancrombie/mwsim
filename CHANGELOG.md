# Changelog

All notable changes to the mwsim project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.2] - 2025-12-15

### Added
- **Browser-aware return flow** - Users are returned to the same browser they came from
  - New `sourceBrowser` parameter parsed from deep link
  - Support for Chrome, Firefox, Edge, Opera, and Brave on iOS
  - Automatic fallback to default browser if specified browser not installed
- New `browserReturn.ts` service with browser URL scheme mappings
- `LSApplicationQueriesSchemes` added to Info.plist for iOS URL scheme queries

### Changed
- "Return to Store" now uses browser-specific URL schemes when `sourceBrowser` is provided
- Cold-start payment flow now preserves `sourceBrowser` across login

### Technical
- Implements SSIM team's browser-return proposal (`ssim/docs/proposals/mwsim-browser-return-proposal.md`)

### Tested
- Successfully verified browser-aware return with Safari and Chrome on iOS (2025-12-15)
- End-to-end checkout flow working with SSIM integration

---

## [0.3.1] - 2025-12-14

### Changed
- "Return to Store" button now appends `?mwsim_return=<requestId>` query parameter to returnUrl
- This allows SSIM checkout page to have context about the completed payment
- Applied to both success and error state return buttons
- Added debug logging for returnUrl handling

### Tested
- Successfully tested full mobile payment flow in dev environment
- End-to-end integration with WSIM, BSIM, and SSIM verified

---

## [0.3.0] - 2025-12-13

### Added

#### Payment Authorization Flow
- Deep link handler for `mwsim://payment/:requestId` - opens payment approval screen
- Payment Approval screen with merchant info, amount, and card selection
- Biometric authentication required before payment approval
- Cold-start auth flow - preserves requestId across login if user not authenticated
- SecureStore persistence for interrupted payments (recovers on app restart)
- Error handling for expired, cancelled, and already-processed payments
- "Return to Store" and "Go to Wallet" options after payment completion

#### API Endpoints
- `GET /api/mobile/payment/:requestId` - Get payment request details
- `POST /api/mobile/payment/:requestId/approve` - Approve payment with card
- `POST /api/mobile/payment/:requestId/cancel` - Cancel payment request
- `GET /api/mobile/payment/pending` - List pending payments (for future home screen section)

### Changed
- Bundle ID changed from `com.mwsim.wallet` to `com.banksim.wsim`
- Added Android package name `com.banksim.wsim`
- Updated `react-native-safe-area-context` from 4.14.0 to 5.6.2 (fixes iOS build issue)

---

## [0.2.0] - 2025-12-13

### Added

#### Card Management
- Card Details screen - tap any card to view full details
- Set Default Card - choose which card is used for payments
- Remove Card - remove cards from wallet with confirmation dialog
- Optimistic UI updates for instant feedback

#### API Endpoints (wsim backend)
- `POST /api/mobile/wallet/cards/:cardId/default` - Set card as default
- `DELETE /api/mobile/wallet/cards/:cardId` - Remove card (soft delete)
- Auto-promotion of next card to default when default card is removed

### Changed
- Card tap now navigates to details screen instead of showing alert
- Updated API client with correct mobile endpoint paths

---

## [0.1.0] - 2024-12-13

### Added

#### Authentication
- Welcome screen with Create Account and Sign In options
- Account creation flow with email and name input
- Email verification login flow
- Biometric setup screen (Face ID / Touch ID)
- Graceful fallback when biometric endpoint returns 404
- Device registration with unique device IDs
- JWT token storage and automatic refresh

#### Bank Enrollment
- Bank selection screen with available banks from API
- OAuth enrollment flow using expo-web-browser (system browser)
- Deep link handling for OAuth callbacks (`mwsim://enrollment/callback`)
- Success/error detection from callback URL parameters
- Automatic wallet refresh after successful enrollment

#### Wallet Management
- Home screen with user greeting and card list
- Card display with type (VISA/Mastercard), last four digits, and bank name
- Default card indicator badge
- Pull-to-refresh for wallet data
- Empty state with "Add a Bank" call-to-action
- "Add Another Bank" button for enrolled users

#### Developer Tools
- Reset Device button on welcome screen (generates new device ID)
- Console logging for API calls and enrollment flow debugging

#### Infrastructure
- Expo SDK 54 with TypeScript
- Axios API client with JWT interceptors
- Secure storage using expo-secure-store
- Biometric service using expo-local-authentication
- Environment configuration in `src/config/env.ts`
- Deep link URL scheme (`mwsim://`) configured in app.json

### Technical Notes

- Using state-based navigation instead of React Navigation for simplicity
- OAuth flow uses system browser (Safari) instead of WebView to avoid keyboard interaction issues
- All screens implemented in single App.tsx file for simplicity

### Known Issues

- Biometric setup may show "Coming Soon" if backend endpoint not deployed
- Device ID conflicts on simulators require manual reset
- WebView approach had keyboard issues (resolved by switching to expo-web-browser)

---

## Future Releases

### [0.4.0] - Planned
- Transaction history
- Push notifications
- Offline support

### [1.0.0] - Planned
- OpenWallet Foundation support (OID4VCI, OID4VP)
- Digital ID credentials
- Production security hardening
