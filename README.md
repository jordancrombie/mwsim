# mwsim - Mobile Wallet Simulator

A React Native mobile wallet application for iOS and Android that works with the [wsim](../wsim) web wallet simulator.

## Overview

mwsim enables users to:
- Create wallet accounts with email verification
- Enroll payment cards from banking simulators (BSIMs) via OAuth
- Manage their digital wallet
- Use biometric authentication (Face ID / Touch ID)

## Features

### Authentication
- **Account Creation** - Create a new wallet account with email and name
- **Email Verification** - Secure login via email verification codes
- **Biometric Setup** - Optional Face ID / Touch ID authentication
- **Device Binding** - Secure device registration with unique device IDs

### Bank Enrollment
- **Bank Selection** - Browse available banks for card enrollment
- **OAuth Flow** - Secure bank authentication via system browser (Safari/Chrome)
- **Card Import** - Automatic import of cards after successful enrollment
- **Deep Link Handling** - Seamless return to app after OAuth completion (`mwsim://` scheme)

### Wallet Management
- **Card List** - View all enrolled cards with card type and bank info
- **Card Details** - Tap a card to view details with management options
- **Set Default Card** - Choose which card is used for payments
- **Remove Card** - Remove cards from wallet (with confirmation)
- **Default Card Indicator** - Visual badge for default payment card
- **Pull to Refresh** - Refresh wallet data from server
- **Add More Banks** - Enroll additional banks at any time

### Developer Tools
- **Reset Device** - Generate new device ID for testing (dev mode)
- **Debug Logging** - Console logs for enrollment and API debugging

## Project Structure

```
mwsim/
├── app/                    # React Native application
│   ├── App.tsx             # Main app component with all screens
│   ├── app.json            # Expo configuration (scheme, bundle ID)
│   ├── src/
│   │   ├── screens/        # Screen components (for future navigation)
│   │   ├── components/     # Reusable UI components
│   │   ├── services/       # API, auth, storage services
│   │   │   ├── api.ts      # Axios API client with JWT auth
│   │   │   ├── biometric.ts # Biometric authentication
│   │   │   └── secureStorage.ts # Expo Secure Store wrapper
│   │   ├── store/          # Zustand state management
│   │   ├── types/          # TypeScript types
│   │   └── config/         # App configuration
│   └── package.json
├── docs/                   # Documentation
│   └── WSIM_API_PROPOSAL.md
├── PLAN.md                 # Implementation plan
├── TODO.md                 # Development roadmap
├── CHANGELOG.md            # Version history
└── README.md
```

## Tech Stack

- **React Native** (Expo SDK 54) - Cross-platform mobile framework
- **TypeScript** - Type safety
- **Axios** - HTTP client with JWT interceptors
- **Zustand** - State management
- **Expo Secure Store** - Secure credential storage
- **Expo Local Authentication** - Biometrics (Face ID / Touch ID)
- **Expo Web Browser** - System browser for OAuth flows

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Expo CLI (`npm install -g expo-cli`)
- iOS Simulator (Mac) or Android Emulator
- wsim backend running (see [wsim setup](../wsim/README.md))

### Installation

```bash
# Navigate to app directory
cd app

# Install dependencies
npm install

# Start the development server
npm start

# Run on iOS simulator
npm run ios

# Run on Android emulator
npm run android
```

### Configuration

Update the API URLs in `app/src/config/env.ts` to point to your wsim backend:

```typescript
export const config = {
  apiUrl: 'https://wsim-dev.banksim.ca/api',
  apiTimeout: 30000,
};
```

## API Integration

The app integrates with the wsim backend via these endpoints:

### Authentication
- `POST /mobile/device/register` - Register device
- `POST /mobile/auth/register` - Create account
- `POST /mobile/auth/login` - Initiate login
- `POST /mobile/auth/login/verify` - Verify login code
- `POST /mobile/auth/biometric/setup` - Setup biometrics

### Wallet
- `GET /mobile/wallet/summary` - Get wallet summary with cards
- `POST /mobile/wallet/cards/:cardId/default` - Set card as default
- `DELETE /mobile/wallet/cards/:cardId` - Remove card from wallet

### Enrollment
- `GET /mobile/enrollment/banks` - List available banks
- `POST /mobile/enrollment/start/:bsimId` - Start OAuth enrollment (returns authUrl)
- OAuth callback redirects to `mwsim://enrollment/callback?success=true|false`

### Payment
- `GET /mobile/payment/:requestId` - Get payment request details
- `POST /mobile/payment/:requestId/approve` - Approve payment with selected card
- `POST /mobile/payment/:requestId/cancel` - Cancel payment request
- `GET /mobile/payment/pending` - List pending payment requests

## Deep Linking

The app uses the `mwsim://` URL scheme:

**Enrollment Callbacks:**
- **Success**: `mwsim://enrollment/callback?success=true`
- **Error**: `mwsim://enrollment/callback?success=false&error=<message>`

**Payment Approval:**
- **Payment Request**: `mwsim://payment/:requestId` - Opens payment approval screen

Configured in `app.json`:
```json
{
  "expo": {
    "scheme": "mwsim",
    "ios": {
      "bundleIdentifier": "com.banksim.wsim"
    },
    "android": {
      "package": "com.banksim.wsim"
    }
  }
}
```

## Development Status

### Phase 1: Customer Onboarding (Complete)
- [x] Project setup and structure
- [x] Welcome screen
- [x] Account creation flow
- [x] Email login flow
- [x] Biometric setup (graceful fallback if unavailable)
- [x] Bank selection screen
- [x] OAuth enrollment via system browser
- [x] Deep link callback handling
- [x] Wallet home screen with cards
- [x] Device reset for testing

### Phase 2: Wallet Management & Payments
- [x] Card management (set default, remove)
- [x] Payment authorization flow (deep link, approval screen, biometric)
- [ ] Transaction history
- [ ] Push notifications

### Phase 3: OpenWallet Foundation
- [ ] OID4VCI (Verifiable Credential Issuance)
- [ ] OID4VP (Verifiable Presentations)
- [ ] Digital ID support

## Known Limitations

- Navigation uses simple state-based routing for simplicity
- Biometric setup endpoint may return 404 if not yet deployed on backend
- Device ID conflicts can occur on simulators (use Reset Device button)

## wsim Integration

mwsim requires mobile-specific API endpoints in wsim. See [WSIM_API_PROPOSAL.md](docs/WSIM_API_PROPOSAL.md) for the backend changes.

## License

Private - Internal use only
