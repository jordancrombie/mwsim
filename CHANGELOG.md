# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added
- **BLE Proximity Discovery for iOS**: Real-time Bluetooth discovery for P2P transfers
  - Native iOS module (`BleGattAdvertise`) using CBPeripheralManager for standard GATT advertising
  - Service UUID encoding to transmit beacon tokens (format: `E2C56DB5-DFFB-{MAJOR}-{MINOR}-D0F5A71096E0`)
  - Expo config plugin (`withBleGattAdvertise`) to inject native module during prebuild
  - Cross-platform BLE scanning using `react-native-ble-plx`
  - NearbyUsersPanel component for displaying discovered users
  - Integration with TransferSim Discovery API for beacon registration and lookup
  - RSSI-based distance estimation

### Fixed
- Token parsing bug: JavaScript bitwise operations treated large values as signed negative integers
- Debounce timer was resetting on every beacon discovery, preventing callbacks from firing
- Nearby user selection failed to proceed due to async React state update timing
- Missing aliasType when sending transfers to nearby users
