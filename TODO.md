# mwsim TODO

Development roadmap and planned features for the mwsim mobile wallet application.

## Phase 2: Wallet Management & Payments

### Card Management
- [x] Set card as default
- [x] Remove card from wallet
- [x] Card details view
- [ ] Card nickname/label editing

### Payment Authorization
- [x] Deep link handler for payment requests (`mwsim://payment/:requestId`)
- [x] Payment approval screen with merchant info and card selection
- [x] Biometric authorization for payments
- [x] Cold-start auth flow (preserve requestId across login)
- [x] SecureStore persistence for interrupted payments
- [x] Return URL with mwsim_return context parameter
- [x] End-to-end flow tested in dev (2025-12-14)
- [x] Browser-aware return flow (sourceBrowser parameter, iOS browser URL schemes)
- [x] Safari and Chrome checkout flow verified on iOS (2025-12-15)
- [ ] QR code scanning for payment (Phase 3)
- [ ] Transaction receipt display

### Transaction History
- [ ] Transaction list view
- [ ] Transaction detail view
- [ ] Filter by date/card/merchant
- [ ] Search transactions

### UI Polish
- [ ] Custom splash screen - preload Joey image before showing text (avoid flash)

### Push Notifications
- [ ] Expo Push Notifications setup
- [ ] Payment request notifications
- [ ] Transaction confirmation notifications
- [ ] Security alerts

## Phase 3: OpenWallet Foundation

### OID4VCI (Verifiable Credential Issuance)
- [ ] Credential offer handling
- [ ] Credential request flow
- [ ] Credential storage
- [ ] Credential display

### OID4VP (Verifiable Presentations)
- [ ] Presentation request handling
- [ ] Selective disclosure UI
- [ ] Presentation submission
- [ ] Verifier trust indicators

### Digital ID Support
- [ ] Government ID credential types
- [ ] Age verification presentations
- [ ] Identity verification flows

## Technical Improvements

### Navigation
- [ ] Migrate to React Navigation (safe-area-context v5.6.2 now works)
- [ ] Add navigation state persistence
- [x] Deep link routing for payment requests

### State Management
- [ ] Migrate from useState to Zustand stores
- [ ] Offline state persistence
- [ ] Optimistic updates

### Security
- [ ] Certificate pinning
- [ ] Jailbreak/root detection
- [ ] Secure enclave key storage (iOS)
- [ ] Android Keystore integration
- [ ] Biometric key binding

### Testing
- [ ] Unit tests for services
- [ ] Component tests
- [ ] E2E tests with Detox
- [ ] API mock server

### CI/CD
- [ ] GitHub Actions workflow
- [ ] Automated builds
- [ ] TestFlight deployment (iOS)
- [ ] Play Store internal testing (Android)

## Bug Fixes & Polish

- [ ] Loading states for all API calls
- [ ] Error boundary implementation
- [ ] Accessibility improvements (VoiceOver/TalkBack)
- [ ] Localization support
- [ ] Dark mode support

## Documentation

- [ ] API documentation
- [ ] Component storybook
- [ ] Architecture decision records (ADRs)
- [ ] Contribution guidelines
