# mwsim - Mobile Wallet Simulator

## Project Overview

mwsim is a React Native mobile wallet application for iOS and Android that works alongside the existing wsim (web wallet simulator) project. It enables users to enroll payment credentials from banking simulators (BSIMs) and authorize payments at merchant simulators (SSIMs).

### Goals
1. **Phase 1**: Customer onboarding and initial card enrollment
2. **Phase 2**: Wallet management and payment authorization
3. **Phase 3**: OpenWallet Foundation integration (OID4VP/OID4VCI)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Mobile App (mwsim)                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │   React     │  │  Biometric  │  │   Secure Storage        │  │
│  │   Native    │  │  Auth       │  │   (Keychain/Keystore)   │  │
│  │   UI        │  │  (Face/Touch│  │   - JWT tokens          │  │
│  │             │  │   ID)       │  │   - Device credentials  │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
│                              │                                    │
│                    ┌─────────┴─────────┐                         │
│                    │   API Client      │                         │
│                    │   (REST + WebView)│                         │
│                    └─────────┬─────────┘                         │
└──────────────────────────────┼───────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    wsim Backend (Extended)                       │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │              Existing Endpoints (Reuse)                     ││
│  │  - /api/enrollment/* (bank enrollment via WebView)          ││
│  │  - /api/wallet/cards (card management)                      ││
│  │  - /api/passkey/* (WebAuthn - via WebView)                  ││
│  │  - /api/auth/* (authentication)                             ││
│  └─────────────────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────────────────┐│
│  │              New Mobile Endpoints (Proposed)                ││
│  │  - POST /api/mobile/device/register                         ││
│  │  - POST /api/mobile/auth/biometric/setup                    ││
│  │  - POST /api/mobile/auth/biometric/verify                   ││
│  │  - POST /api/mobile/auth/token/refresh                      ││
│  │  - GET  /api/mobile/wallet/summary                          ││
│  │  - POST /api/mobile/push/register                           ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Banking Simulators (BSIMs)                    │
│              (TD Bank Sim, RBC Bank Sim, etc.)                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Customer Onboarding & Initial Enrollment

### User Journey

```
┌──────────────────────────────────────────────────────────────────┐
│  1. WELCOME SCREEN                                                │
│  ┌────────────────────────────────────┐                          │
│  │         🏦 mwsim Wallet            │                          │
│  │                                    │                          │
│  │    Your digital wallet for        │                          │
│  │    secure payments                 │                          │
│  │                                    │                          │
│  │    [  Create Account  ]            │                          │
│  │    [  Sign In         ]            │                          │
│  └────────────────────────────────────┘                          │
└──────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│  2. ACCOUNT CREATION                                              │
│  ┌────────────────────────────────────┐                          │
│  │    Create Your Wallet              │                          │
│  │                                    │                          │
│  │    Email: [________________]       │                          │
│  │    Name:  [________________]       │                          │
│  │                                    │                          │
│  │    [  Continue  ]                  │                          │
│  └────────────────────────────────────┘                          │
└──────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│  3. BIOMETRIC SETUP                                               │
│  ┌────────────────────────────────────┐                          │
│  │    Secure Your Wallet              │                          │
│  │                                    │                          │
│  │         [Face ID Icon]             │                          │
│  │                                    │                          │
│  │    Enable Face ID to securely     │                          │
│  │    access your wallet and         │                          │
│  │    authorize payments              │                          │
│  │                                    │                          │
│  │    [  Enable Face ID  ]            │                          │
│  │    [  Skip for now    ]            │                          │
│  └────────────────────────────────────┘                          │
└──────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│  4. ADD FIRST BANK                                                │
│  ┌────────────────────────────────────┐                          │
│  │    Add Your First Card             │                          │
│  │                                    │                          │
│  │    Connect a bank to add your     │                          │
│  │    cards to the wallet             │                          │
│  │                                    │                          │
│  │    ┌──────────────────────────┐   │                          │
│  │    │ 🏦 TD Bank Simulator     │   │                          │
│  │    └──────────────────────────┘   │                          │
│  │    ┌──────────────────────────┐   │                          │
│  │    │ 🏦 RBC Bank Simulator    │   │                          │
│  │    └──────────────────────────┘   │                          │
│  │                                    │                          │
│  │    [  Skip for now    ]            │                          │
│  └────────────────────────────────────┘                          │
└──────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│  5. BANK LOGIN (WebView)                                          │
│  ┌────────────────────────────────────┐                          │
│  │    TD Bank Simulator Login         │                          │
│  │    ─────────────────────────       │                          │
│  │                                    │                          │
│  │    Username: [________________]    │                          │
│  │    Password: [________________]    │                          │
│  │                                    │                          │
│  │    [  Sign In  ]                   │                          │
│  │                                    │  ← OAuth flow in WebView │
│  │    This is the bank's login page  │                          │
│  │    served from the BSIM            │                          │
│  └────────────────────────────────────┘                          │
└──────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│  6. CARD SELECTION                                                │
│  ┌────────────────────────────────────┐                          │
│  │    Select Cards to Add             │                          │
│  │                                    │                          │
│  │    ☑ Visa ****4242                │                          │
│  │    ☑ Mastercard ****8888          │                          │
│  │    ☐ Debit ****1234               │                          │
│  │                                    │                          │
│  │    [  Add Selected Cards  ]        │                          │
│  └────────────────────────────────────┘                          │
└──────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│  7. SUCCESS / WALLET HOME                                         │
│  ┌────────────────────────────────────┐                          │
│  │    My Wallet                       │                          │
│  │                                    │                          │
│  │    ┌──────────────────────────┐   │                          │
│  │    │  💳 Visa ****4242        │   │                          │
│  │    │  TD Bank Simulator       │   │                          │
│  │    │  ⭐ Default              │   │                          │
│  │    └──────────────────────────┘   │                          │
│  │                                    │                          │
│  │    ┌──────────────────────────┐   │                          │
│  │    │  💳 MC ****8888          │   │                          │
│  │    │  TD Bank Simulator       │   │                          │
│  │    └──────────────────────────┘   │                          │
│  │                                    │                          │
│  │    [  + Add Another Bank  ]        │                          │
│  └────────────────────────────────────┘                          │
└──────────────────────────────────────────────────────────────────┘
```

---

## Technical Implementation Plan

### 1. Project Setup

```
mwsim/
├── app/                          # React Native app
│   ├── src/
│   │   ├── screens/              # Screen components
│   │   │   ├── Welcome.tsx
│   │   │   ├── CreateAccount.tsx
│   │   │   ├── BiometricSetup.tsx
│   │   │   ├── BankSelection.tsx
│   │   │   ├── BankEnrollment.tsx  # WebView wrapper
│   │   │   ├── CardSelection.tsx
│   │   │   └── WalletHome.tsx
│   │   ├── components/           # Reusable components
│   │   │   ├── Card.tsx
│   │   │   ├── Button.tsx
│   │   │   ├── BankListItem.tsx
│   │   │   └── BiometricPrompt.tsx
│   │   ├── services/             # API and auth services
│   │   │   ├── api.ts            # REST client
│   │   │   ├── auth.ts           # Auth helpers
│   │   │   ├── biometric.ts      # Face/Touch ID
│   │   │   └── secureStorage.ts  # Keychain/Keystore
│   │   ├── navigation/           # React Navigation config
│   │   │   └── AppNavigator.tsx
│   │   ├── hooks/                # Custom React hooks
│   │   │   ├── useAuth.ts
│   │   │   ├── useBiometric.ts
│   │   │   └── useWallet.ts
│   │   ├── store/                # State management (Zustand)
│   │   │   ├── authStore.ts
│   │   │   └── walletStore.ts
│   │   ├── types/                # TypeScript types
│   │   │   └── index.ts
│   │   └── config/               # App configuration
│   │       └── env.ts
│   ├── ios/                      # iOS native project
│   ├── android/                  # Android native project
│   ├── app.json
│   ├── package.json
│   └── tsconfig.json
├── docs/                         # Documentation
│   ├── WSIM_API_PROPOSALS.md     # Proposed wsim changes
│   └── ARCHITECTURE.md
└── README.md
```

### 2. Technology Stack

| Category | Technology | Rationale |
|----------|------------|-----------|
| **Framework** | React Native 0.76+ | Cross-platform, TypeScript support, aligns with wsim frontend |
| **Navigation** | React Navigation 7 | Standard for RN, deep linking support |
| **State** | Zustand | Lightweight, TypeScript-first, simpler than Redux |
| **HTTP Client** | Axios | Consistent with wsim backend patterns |
| **Biometrics** | react-native-biometrics | Face ID / Touch ID / Fingerprint |
| **Secure Storage** | react-native-keychain | Keychain (iOS) / Keystore (Android) |
| **WebView** | react-native-webview | For OAuth/enrollment flows |
| **Forms** | React Hook Form + Zod | Type-safe validation |
| **Styling** | NativeWind (Tailwind) | Consistent with wsim frontend styling |

### 3. Key Dependencies

```json
{
  "dependencies": {
    "react": "^18.3.1",
    "react-native": "^0.76.0",
    "@react-navigation/native": "^7.0.0",
    "@react-navigation/native-stack": "^7.0.0",
    "react-native-screens": "^4.0.0",
    "react-native-safe-area-context": "^4.0.0",
    "react-native-webview": "^14.0.0",
    "react-native-biometrics": "^3.0.0",
    "react-native-keychain": "^9.0.0",
    "axios": "^1.7.0",
    "zustand": "^5.0.0",
    "react-hook-form": "^7.50.0",
    "zod": "^3.23.0",
    "nativewind": "^4.0.0"
  },
  "devDependencies": {
    "typescript": "^5.5.0",
    "@types/react": "^18.3.0",
    "tailwindcss": "^3.4.0"
  }
}
```

---

## Proposed wsim Backend Changes

### New Mobile API Endpoints

These endpoints are designed for mobile-specific needs while reusing existing wsim logic.

#### 1. Device Registration

```typescript
// POST /api/mobile/device/register
// Register a mobile device with the wallet

Request:
{
  "deviceId": "uuid-generated-on-device",
  "platform": "ios" | "android",
  "deviceName": "iPhone 15 Pro",
  "pushToken": "apns-or-fcm-token" // optional
}

Response:
{
  "deviceCredential": "encrypted-device-token",
  "expiresAt": "2025-01-01T00:00:00Z"
}
```

#### 2. Biometric Authentication Setup

```typescript
// POST /api/mobile/auth/biometric/setup
// Link biometric authentication to user account

Request:
{
  "deviceId": "uuid",
  "publicKey": "base64-encoded-public-key",
  "biometricType": "face" | "fingerprint"
}

Response:
{
  "biometricId": "uuid",
  "status": "enabled"
}
```

#### 3. Biometric Authentication Verify

```typescript
// POST /api/mobile/auth/biometric/verify
// Authenticate user via biometric signature

Request:
{
  "deviceId": "uuid",
  "biometricId": "uuid",
  "signature": "base64-signed-challenge",
  "challenge": "server-provided-challenge"
}

Response:
{
  "accessToken": "jwt-access-token",
  "refreshToken": "jwt-refresh-token",
  "expiresIn": 3600,
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe"
  }
}
```

#### 4. Token Refresh

```typescript
// POST /api/mobile/auth/token/refresh
// Refresh expired access token

Request:
{
  "refreshToken": "jwt-refresh-token"
}

Response:
{
  "accessToken": "new-jwt-access-token",
  "expiresIn": 3600
}
```

#### 5. Mobile Wallet Summary

```typescript
// GET /api/mobile/wallet/summary
// Get wallet overview optimized for mobile

Response:
{
  "user": {
    "id": "uuid",
    "name": "John Doe"
  },
  "cards": [
    {
      "id": "uuid",
      "lastFour": "4242",
      "cardType": "VISA",
      "bankName": "TD Bank Simulator",
      "bankLogo": "https://...",
      "isDefault": true,
      "addedAt": "2024-01-15T00:00:00Z"
    }
  ],
  "enrolledBanks": [
    {
      "bsimId": "td-bsim",
      "name": "TD Bank Simulator",
      "cardCount": 2
    }
  ],
  "biometricEnabled": true
}
```

### Database Schema Additions (Prisma)

```prisma
// Add to wsim/backend/prisma/schema.prisma

model MobileDevice {
  id               String   @id @default(uuid())
  userId           String
  user             WalletUser @relation(fields: [userId], references: [id], onDelete: Cascade)

  deviceId         String   @unique  // Client-generated UUID
  platform         String   // "ios" or "android"
  deviceName       String
  pushToken        String?  // APNS or FCM token

  // Device credential for authentication
  deviceCredential String   // Encrypted
  credentialExpiry DateTime

  // Biometric info
  biometricEnabled Boolean  @default(false)
  biometricType    String?  // "face" or "fingerprint"
  biometricPublicKey String? // For signature verification

  lastUsedAt       DateTime?
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  @@index([userId])
}

model MobileRefreshToken {
  id           String   @id @default(uuid())
  token        String   @unique
  userId       String
  user         WalletUser @relation(fields: [userId], references: [id], onDelete: Cascade)
  deviceId     String
  device       MobileDevice @relation(fields: [deviceId], references: [deviceId], onDelete: Cascade)

  expiresAt    DateTime
  revokedAt    DateTime?
  createdAt    DateTime @default(now())

  @@index([userId])
  @@index([deviceId])
}
```

---

## Authentication Flow

### Mobile-Specific Auth Strategy

```
┌─────────────────────────────────────────────────────────────────┐
│                    AUTHENTICATION FLOWS                          │
└─────────────────────────────────────────────────────────────────┘

1. INITIAL SETUP (First Launch)
   ┌──────────┐      ┌──────────┐      ┌──────────┐
   │  Mobile  │ ──── │  wsim    │ ──── │  wsim    │
   │   App    │      │ Backend  │      │   DB     │
   └──────────┘      └──────────┘      └──────────┘
        │                  │                 │
        │  POST /mobile/device/register      │
        │─────────────────▶│                 │
        │                  │  Create device  │
        │                  │────────────────▶│
        │                  │                 │
        │  { deviceCredential }              │
        │◀─────────────────│                 │
        │                  │                 │
        │  Store in Keychain                 │
        │                  │                 │

2. BIOMETRIC ENROLLMENT (After Account Creation)
   ┌──────────┐      ┌──────────┐      ┌──────────┐
   │  Mobile  │      │  wsim    │      │   iOS    │
   │   App    │      │ Backend  │      │ Keychain │
   └──────────┘      └──────────┘      └──────────┘
        │                  │                 │
        │  Generate keypair (Secure Enclave) │
        │───────────────────────────────────▶│
        │                  │                 │
        │  POST /mobile/auth/biometric/setup │
        │  { publicKey }   │                 │
        │─────────────────▶│                 │
        │                  │                 │
        │  { biometricId } │                 │
        │◀─────────────────│                 │
        │                  │                 │

3. SUBSEQUENT LOGIN (Biometric)
   ┌──────────┐      ┌──────────┐      ┌──────────┐
   │  Mobile  │      │  wsim    │      │   iOS    │
   │   App    │      │ Backend  │      │ Biometric│
   └──────────┘      └──────────┘      └──────────┘
        │                  │                 │
        │  GET /mobile/auth/challenge        │
        │─────────────────▶│                 │
        │  { challenge }   │                 │
        │◀─────────────────│                 │
        │                  │                 │
        │  Face ID prompt  │                 │
        │───────────────────────────────────▶│
        │  User approves   │                 │
        │◀───────────────────────────────────│
        │                  │                 │
        │  Sign challenge with private key   │
        │                  │                 │
        │  POST /mobile/auth/biometric/verify│
        │  { signature, challenge }          │
        │─────────────────▶│                 │
        │                  │                 │
        │  { accessToken, refreshToken }     │
        │◀─────────────────│                 │
        │                  │                 │
```

### Token Storage Strategy

| Token Type | Storage Location | Lifetime | Purpose |
|------------|------------------|----------|---------|
| Device Credential | Keychain/Keystore | 90 days | Identifies trusted device |
| Access Token | Memory (Zustand) | 1 hour | API authentication |
| Refresh Token | Keychain/Keystore | 30 days | Obtain new access tokens |
| Biometric Key | Secure Enclave | Permanent | Sign challenges |

---

## Enrollment Flow (Technical)

### Bank Enrollment via WebView

The existing wsim enrollment flow uses OAuth 2.0 with PKCE. For mobile, we'll wrap this in a WebView:

```typescript
// BankEnrollment.tsx - Simplified flow

function BankEnrollmentScreen({ route }) {
  const { bsimId } = route.params;
  const webViewRef = useRef<WebView>(null);

  // Start enrollment URL
  const enrollmentUrl = `${WSIM_API_URL}/enrollment/start/${bsimId}?mobile=true`;

  // Handle navigation state changes
  const handleNavigationChange = (navState: WebViewNavState) => {
    const { url } = navState;

    // Check for successful callback
    if (url.includes('/enrollment/callback') && url.includes('success=true')) {
      // Extract session info from URL or cookies
      handleEnrollmentSuccess(url);
    }

    // Check for cancel/error
    if (url.includes('error=') || url.includes('cancelled=true')) {
      handleEnrollmentError(url);
    }
  };

  return (
    <WebView
      ref={webViewRef}
      source={{ uri: enrollmentUrl }}
      onNavigationStateChange={handleNavigationChange}
      sharedCookiesEnabled={true}  // Important for session
      thirdPartyCookiesEnabled={true}
    />
  );
}
```

### Sequence Diagram

```
┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐
│  Mobile  │   │  wsim    │   │  wsim    │   │  BSIM    │
│   App    │   │ Backend  │   │Auth Srv  │   │ (Bank)   │
└──────────┘   └──────────┘   └──────────┘   └──────────┘
     │              │              │              │
     │  User taps "Add TD Bank"   │              │
     │              │              │              │
     │  Open WebView to:          │              │
     │  /api/enrollment/start/td  │              │
     │─────────────▶│              │              │
     │              │              │              │
     │              │  Generate PKCE, state      │
     │              │  Redirect to BSIM auth     │
     │              │─────────────────────────────▶
     │              │              │              │
     │◀────────────────────────────────────────────
     │  WebView shows BSIM login  │              │
     │              │              │              │
     │  User enters credentials   │              │
     │─────────────────────────────────────────────▶
     │              │              │              │
     │              │              │  Auth code   │
     │◀────────────────────────────────────────────
     │  Redirect to wsim callback │              │
     │              │              │              │
     │  WebView: /enrollment/callback?code=...   │
     │─────────────▶│              │              │
     │              │              │              │
     │              │  Exchange code for tokens  │
     │              │─────────────────────────────▶
     │              │              │              │
     │              │  wallet_credential         │
     │              │◀─────────────────────────────
     │              │              │              │
     │              │  Fetch cards, create enrollment
     │              │              │              │
     │  WebView: /enrollment/success?cards=2     │
     │◀─────────────│              │              │
     │              │              │              │
     │  Intercept URL, close WebView             │
     │  Refresh wallet cards      │              │
     │              │              │              │
```

---

## Implementation Phases

### Phase 1A: Project Foundation (Week 1-2)

**Tasks:**
1. Initialize React Native project with TypeScript
2. Configure NativeWind (Tailwind CSS)
3. Set up React Navigation
4. Implement secure storage service (Keychain/Keystore)
5. Create API client with Axios
6. Set up Zustand stores (auth, wallet)
7. Create basic component library (Button, Card, Input)

**Deliverables:**
- Working RN project that builds for iOS and Android
- Navigation structure in place
- API client configured for wsim backend

### Phase 1B: Authentication & Onboarding (Week 2-3)

**Tasks:**
1. Welcome screen UI
2. Account creation flow
3. Biometric setup (Face ID / Touch ID)
4. Device registration API integration
5. JWT token management
6. Login screen (for returning users)

**Deliverables:**
- User can create account
- Biometric authentication works
- Tokens stored securely

### Phase 1C: Bank Enrollment (Week 3-4)

**Tasks:**
1. Bank selection screen
2. WebView enrollment flow
3. Handle OAuth callbacks in WebView
4. Card selection after enrollment
5. Wallet home screen with cards

**Deliverables:**
- User can enroll bank cards via WebView
- Cards appear in wallet

### Phase 1D: Backend Integration (Parallel)

**Tasks (wsim team proposals):**
1. Propose mobile device registration endpoint
2. Propose biometric auth endpoints
3. Propose mobile-optimized wallet endpoint
4. Add `?mobile=true` parameter handling to enrollment

**Deliverables:**
- API proposal document for wsim team
- Database schema additions documented

---

## Future Phases (Overview)

### Phase 2: Wallet Management & Payments
- Card management (set default, remove)
- Payment authorization flow
- Transaction history
- Push notifications for payments

### Phase 3: OpenWallet Foundation (OID4VP/OID4VCI)
- Verifiable Credential issuance (OID4VCI)
- Verifiable Presentation (OID4VP)
- Digital ID support (mDL)
- Credential wallet storage

---

## Security Considerations

### Mobile-Specific Security

1. **Secure Storage**
   - All sensitive data in Keychain (iOS) / Keystore (Android)
   - Never store tokens in AsyncStorage
   - Use Secure Enclave for biometric keys

2. **Certificate Pinning**
   - Pin wsim backend certificate
   - Prevent MITM attacks

3. **Biometric Security**
   - Keys generated in Secure Enclave (iOS) / StrongBox (Android)
   - Challenge-response prevents replay attacks
   - Server verifies signatures, not app

4. **App Transport Security**
   - HTTPS only
   - TLS 1.3 preferred

5. **Code Protection**
   - ProGuard/R8 (Android)
   - No sensitive data in logs
   - Detect jailbreak/root (optional)

---

## Design Decisions

1. **Push Notifications**: Implement when a specific use case requires them (likely Phase 2 payments)

2. **Offline Mode**: Yes - show cached cards when offline, sync when connectivity returns

3. **Multi-Device**: Yes - users can use mwsim on multiple devices simultaneously

4. **Distribution**: TestFlight (iOS) / Internal Testing (Android) first, then App Store later

5. **Branding**: Inherit branding from wsim (colors, typography, visual identity)

---

## Known Issues & TODOs

### TODO: React Navigation Integration

**Issue**: `react-native-safe-area-context` v4.x and v5.x have a compatibility issue with iOS 26.1 (iPhone 17 Pro simulator) causing:
```
Error: Exception in HostFunction: TypeError: expected dynamic type 'boolean', but had type 'string'
```

**Current Workaround**: Using simple state-based navigation instead of React Navigation.

**Action Items**:
- [ ] Monitor `react-native-safe-area-context` releases for iOS 26 fix
- [ ] Test with physical devices (may only affect simulator)
- [ ] Consider Expo Router as alternative once stable
- [ ] Re-integrate React Navigation when fix is available

---

## Next Steps

1. **Review this plan** - Get feedback on approach
2. **Create wsim API proposals** - Document needed backend changes
3. **Initialize React Native project** - Set up development environment
4. **Build welcome & onboarding screens** - Start with UI
5. **Implement secure storage** - Foundation for auth

---

*Document Version: 1.0*
*Last Updated: 2024-12-13*
