# mwsim TODO

Development roadmap and planned features for the mwsim mobile wallet application.

## Build & Release Guidelines

### Creating Archives for TestFlight

When building archives for TestFlight upload, **always use unique archive names** to avoid overwriting previous builds.

**Custom Archive Location:** `/Users/jcrombie/ai/AppBuilds/IOS/Archives/`
(Configured in Xcode Preferences → Locations → Derived Data → Advanced)

```bash
# From app/ios directory:
cd /Users/jcrombie/ai/mwsim/app/ios

# Build with version-specific name (to project dir first, then move)
LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 xcodebuild \
  -workspace mwsim.xcworkspace \
  -scheme mwsim \
  -configuration Release \
  -destination "generic/platform=iOS" \
  -archivePath /Users/jcrombie/ai/mwsim/app/mwsim_1.4.0_XX.xcarchive \
  archive

# Then move to custom Archives folder for Organizer to find it:
mv /Users/jcrombie/ai/mwsim/app/mwsim_1.4.0_XX.xcarchive \
   /Users/jcrombie/ai/AppBuilds/IOS/Archives/$(date +%Y-%m-%d)/
```

### Build Checklist

1. **Bump build number** in `app.json` before each TestFlight upload
2. **Run `npx expo prebuild --clean`** if any plugins or native config changed
3. **Use unique archive names** (e.g., `mwsim_1.4.0_24.xcarchive`)
4. **Move archive** to `/Users/jcrombie/ai/AppBuilds/IOS/Archives/YYYY-MM-DD/`
5. **Open in Xcode Organizer** to upload to App Store Connect

### Version Info in Settings

The app displays version and build info in iOS Settings > mwsim > App Info.
This is populated at runtime from `Info.plist` via the `withSettingsDefaults` plugin.

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

## P2P Transfers (Complete - v1.4.0)

Reference: `wsim/LOCAL_DEPLOYMENT_PLANS/P2P_TRANSFER_NETWORK_PLAN.md`

### P2P Enrollment
- [x] P2P enrollment check on login
- [x] Auto-enrollment for logged-in users
- [x] P2P home screen with quick actions
- [x] Bottom tab navigation (Cards / P2P)

### Alias Management
- [x] Register email/phone/username alias
- [x] View/manage aliases
- [x] Set primary alias
- [x] Delete alias
- [ ] Alias verification flow (email/SMS)

### Send Money
- [x] Send by alias (email, phone, username)
- [x] Send by QR code scan
- [ ] Send by NFC tap (future)
- [x] Amount entry with currency formatting
- [x] Add memo/description
- [x] Confirmation screen with recipient preview
- [x] Biometric authorization for transfers

### Receive Money
- [x] Generate receive QR code (via TransferSim token API)
- [x] Share alias (share sheet integration)
- [ ] Request specific amount (optional)
- [x] Receive QR expiration handling

### Transfer History
- [x] Transfer list view (sent/received)
- [x] Filter by direction (All/Sent/Received)
- [x] Transfer detail view
- [ ] Filter by status, date
- [ ] Search by alias/name

### TransferSim Integration
- [x] Environment-aware URLs (dev: transfersim-dev.banksim.ca, prod: transfer.banksim.ca)
- [x] Lazy client initialization (prevents startup hang)
- [x] API key authentication
- [x] User context authorization headers

### Notifications (Future)
- [ ] Push notification for incoming transfer
- [ ] Push notification for transfer complete
- [ ] In-app notification center

## Micro Merchants (Phase 1 UI Complete - v1.4.0 build 20)

Reference: `transferSim/LOCAL_DEPLOYMENT_PLANS/MICRO_MERCHANT_PROPOSAL.md`

Extends P2P infrastructure to support small business payments with visual differentiation and fee handling.

### Core Concept
- **Two recipient types:** Individual (P2P) and Micro Merchant (business)
- **Color scheme:** Purple (#7C3AED) for Individual, Green (#10B981) for Micro Merchant
- **Fee structure:** Tiered flat ($0.25 < $200, $0.50 >= $200) - display only in Phase 1, collected in Phase 3

### Merchant Enrollment
- [x] "Become a Merchant" CTA in P2P Personal mode
- [x] Merchant enrollment screen (business name, category, account selection)
- [ ] Merchant profile creation via TransferSim API (awaiting backend)
- [x] Store merchant profile in state and SecureStorage

### P2P Tab Toggle (Personal/Business)
- [x] Segmented control: "Personal" | "Business"
- [x] Toggle only visible if user is enrolled as Micro Merchant
- [x] Persist selected mode in AsyncStorage
- [x] Purple accent for Personal, Green accent for Business
- [x] Status indicator on Business tab (enrolled vs "Setup →")

### Merchant Dashboard (Business Mode)
- [x] Prominent merchant QR code display
- [x] Business name and alias header
- [x] Today's revenue summary
- [x] Recent payments list (received as merchant)
- [x] "Full History" link to merchant transaction view

### Merchant QR Code
- [x] Green border (vs purple for personal)
- [x] Business name display above QR
- [x] Primary alias below QR
- [x] "Micro Merchant" badge
- [x] Share QR action
- [ ] Print QR action (PDF export for counter display)
- [x] Full-screen mode for easy scanning

### Visual Differentiation (Sender View)
- [x] Recipient card styling based on type
  - Individual: Purple border, person icon
  - Merchant: Green border, storefront icon
- [x] Fee preview when sending to Micro Merchant
- [x] Fee disclaimer on confirmation screen
- [ ] Transaction receipt shows gross amount and fee (needs API)

### Transaction History (Mode-Aware)
- [x] Personal mode: Show personal P2P transfers (sent/received)
- [x] Business mode: Show merchant receipts only
- [x] Transaction cards show fee deducted (merchant payments)
- [x] Green/purple visual differentiation in history

### Merchant Profile Management
- [x] Edit business name (UI ready)
- [x] Edit business category (UI ready)
- [x] View/change receiving account (UI ready)
- [x] Deactivate merchant account (UI ready)

### Types & State (src/types/index.ts, App.tsx)
- [x] Add `MerchantProfile` type
- [x] Add `RecipientType: 'individual' | 'merchant'`
- [x] Add `p2pMode: 'personal' | 'business'` state
- [x] Add `isMicroMerchant` boolean state
- [x] Add `merchantProfile` state

### TransferSim API Integration (src/services/transferSim.ts)
- [x] `enrollMerchant()` - Create merchant profile
- [x] `getMerchantProfile()` - Get current user's merchant profile
- [x] `updateMerchantProfile()` - Update business name/category
- [x] `generateMerchantToken()` - Generate merchant-specific QR token
- [x] `getMerchantTransfers()` - Get merchant transaction history
- [x] `resolveTokenWithMerchantInfo()` - Resolve token with recipientType
- [x] `calculateMerchantFee()` - Fee calculation utility

### Phase Dependencies
- **Phase 1 (UI Only):** ✅ Complete - All UI/UX changes, fee display only (no actual collection)
- **Phase 2 (Testing):** Awaiting TransferSim backend APIs
- **Phase 3 (Fee Collection):** BSIM fee API integration, actual fee deduction

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
