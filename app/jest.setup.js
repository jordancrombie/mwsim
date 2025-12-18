// Jest setup file
// Note: @testing-library/react-native v12.4+ has built-in matchers
// No need to import extend-expect separately

// Mock expo-secure-store
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

// Mock expo-local-authentication
jest.mock('expo-local-authentication', () => ({
  hasHardwareAsync: jest.fn(() => Promise.resolve(true)),
  isEnrolledAsync: jest.fn(() => Promise.resolve(true)),
  authenticateAsync: jest.fn(() => Promise.resolve({ success: true })),
  supportedAuthenticationTypesAsync: jest.fn(() => Promise.resolve([1])), // Default to fingerprint
  SecurityLevel: {
    NONE: 0,
    SECRET: 1,
    BIOMETRIC_WEAK: 2,
    BIOMETRIC_STRONG: 3,
  },
  AuthenticationType: {
    FINGERPRINT: 1,
    FACIAL_RECOGNITION: 2,
    IRIS: 3,
  },
}));

// Mock expo-device
jest.mock('expo-device', () => ({
  modelName: 'iPhone 15 Pro',
  osName: 'iOS',
  osVersion: '17.0',
}));

// Mock expo-web-browser
jest.mock('expo-web-browser', () => ({
  openAuthSessionAsync: jest.fn(),
  openBrowserAsync: jest.fn(),
  dismissBrowser: jest.fn(),
}));

// Mock expo-camera
jest.mock('expo-camera', () => ({
  CameraView: 'CameraView',
  useCameraPermissions: jest.fn(() => [{ granted: true }, jest.fn()]),
}));

// Mock React Native Settings
jest.mock('react-native/Libraries/Settings/Settings', () => ({
  get: jest.fn(() => 'production'),
  set: jest.fn(),
}));


// Silence console warnings in tests
global.console = {
  ...console,
  warn: jest.fn(),
  log: jest.fn(),
};
