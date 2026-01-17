# Changelog

All notable changes to mwsim are documented in this file.

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
