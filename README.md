# mwsim

Mobile wallet simulator app built with React Native and Expo SDK 54.

## Features

- **P2P Transfers**: Send and receive money between users
- **BLE Proximity Discovery**: Find nearby iOS users via Bluetooth for quick transfers
- **QR Code Payments**: Scan or display QR codes for transfers
- **Biometric Authentication**: Face ID / Touch ID for secure transactions
- **Multi-bank Support**: Connect multiple bank accounts via BSIM

## Development

### Prerequisites

- Node.js 18+
- Xcode 15+ (for iOS)
- CocoaPods

### Setup

```bash
cd app
npm install
npx expo prebuild --clean
```

### Run on iOS Device

```bash
npx expo run:ios --device
```

### TestFlight Upload

See `CLAUDE.md` for detailed instructions.

## Related Projects

- **WSIM**: Backend wallet service
- **TransferSim**: Transfer processing service
- **BSIM**: Bank simulator
