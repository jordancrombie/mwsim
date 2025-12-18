// Mock @expo/config-plugins before importing the plugin
jest.mock('@expo/config-plugins', () => ({
  withAppDelegate: jest.fn((config, callback) => {
    // Store the callback for testing
    config._modCallback = callback;
    return config;
  }),
}));

const withSettingsDefaults = require('../../plugins/withSettingsDefaults');
const { withAppDelegate } = require('@expo/config-plugins');

describe('withSettingsDefaults plugin', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should export a function', () => {
    expect(typeof withSettingsDefaults).toBe('function');
  });

  it('should call withAppDelegate', () => {
    const config = { name: 'test' };
    withSettingsDefaults(config);
    expect(withAppDelegate).toHaveBeenCalledWith(config, expect.any(Function));
  });

  describe('AppDelegate modification', () => {
    const sampleAppDelegate = `
import Expo
import React

@UIApplicationMain
public class AppDelegate: ExpoAppDelegate {
  public override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    let delegate = ReactNativeDelegate()
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }
}
`;

    it('should add Settings.bundle defaults registration code', async () => {
      const config = {
        modResults: {
          contents: sampleAppDelegate,
        },
      };

      const result = withSettingsDefaults(config);
      const modifiedConfig = await result._modCallback(config);

      expect(modifiedConfig.modResults.contents).toContain(
        'Register Settings.bundle defaults'
      );
      expect(modifiedConfig.modResults.contents).toContain(
        'UserDefaults.standard.register(defaults: defaultsToRegister)'
      );
    });

    it('should skip if code already exists', async () => {
      const alreadyModifiedDelegate = sampleAppDelegate.replace(
        '-> Bool {',
        '-> Bool {\n  // Register Settings.bundle defaults\n'
      );

      const config = {
        modResults: {
          contents: alreadyModifiedDelegate,
        },
      };

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const result = withSettingsDefaults(config);
      await result._modCallback(config);

      expect(consoleSpy).toHaveBeenCalledWith(
        '[withSettingsDefaults] Already added, skipping'
      );
      consoleSpy.mockRestore();
    });

    it('should handle missing didFinishLaunchingWithOptions', async () => {
      const invalidDelegate = `
import Expo
public class AppDelegate: ExpoAppDelegate {
  // No didFinishLaunchingWithOptions method
}
`;

      const config = {
        modResults: {
          contents: invalidDelegate,
        },
      };

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const result = withSettingsDefaults(config);
      await result._modCallback(config);

      expect(consoleSpy).toHaveBeenCalledWith(
        '[withSettingsDefaults] Could not find didFinishLaunchingWithOptions method'
      );
      consoleSpy.mockRestore();
    });

    it('should insert code after the opening brace', async () => {
      const config = {
        modResults: {
          contents: sampleAppDelegate,
        },
      };

      const result = withSettingsDefaults(config);
      const modifiedConfig = await result._modCallback(config);

      // The code should be inserted right after the opening brace of didFinishLaunchingWithOptions
      const contents = modifiedConfig.modResults.contents;
      const braceIndex = contents.indexOf('{', contents.indexOf('didFinishLaunchingWithOptions'));
      const afterBrace = contents.slice(braceIndex + 1, braceIndex + 100);

      expect(afterBrace).toContain('Register Settings.bundle defaults');
    });
  });
});
