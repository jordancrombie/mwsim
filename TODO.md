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
- [x] QR code scanning for payment
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

## Multi-Bank Support

### Bank Display
- [x] Display bankName on card component
- [x] Display bankName in wallet card list
- [x] Display bankName in payment card selection
- [x] Display bank logo with fallback (icon/initials if missing)

### Connected Banks Management
- [ ] "Connected Banks" section in profile/settings
- [ ] Show enrolled banks with card counts
- [ ] "Connect Another Bank" action

## P2P Transfers (Planning)

Reference: `wsim/LOCAL_DEPLOYMENT_PLANS/P2P_TRANSFER_NETWORK_PLAN.md`

### Alias Management
- [ ] Register email alias
- [ ] Register phone alias
- [ ] Register username alias
- [ ] View/manage aliases
- [ ] Set primary alias
- [ ] Alias verification flow (email/SMS)

### Send Money
- [ ] Send by alias (email, phone, username)
- [ ] Send by QR code scan
- [ ] Send by NFC tap
- [ ] Amount entry with currency formatting
- [ ] Add memo/description
- [ ] Confirmation screen with recipient preview
- [ ] Biometric authorization for transfers

### Receive Money
- [ ] Generate receive QR code
- [ ] Share alias (copy, share sheet)
- [ ] Request specific amount (optional)
- [ ] Receive QR expiration handling

### Transfer History
- [ ] Transfer list view (sent/received)
- [ ] Transfer detail view
- [ ] Filter by status, date, direction
- [ ] Search by alias/name

### Notifications
- [ ] Push notification for incoming transfer
- [ ] Push notification for transfer complete
- [ ] In-app notification center

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

### Developer Tools & Debugging
- [ ] In-app debug console/log viewer (accessible via Settings or shake gesture)
- [ ] Toggle to enable verbose API request/response logging
- [ ] Network request inspector (view headers, payloads, timing)
- [ ] Environment indicator with detailed config info
- [ ] Export debug logs for troubleshooting

### Testing
- [x] Unit tests for services (169 tests)
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
