# Changelog

All notable changes to mwsim are documented in this file.

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
