/**
 * Expo config plugin to register Settings.bundle defaults at app startup.
 *
 * This ensures NSUserDefaults has the correct default values from Settings.bundle
 * before React Native reads them.
 */
const { withAppDelegate } = require('@expo/config-plugins');

const DEFAULTS_REGISTRATION_CODE = `
  // Register Settings.bundle defaults
  if let settingsBundle = Bundle.main.path(forResource: "Settings", ofType: "bundle"),
     let settings = NSDictionary(contentsOfFile: settingsBundle + "/Root.plist"),
     let preferences = settings["PreferenceSpecifiers"] as? [[String: Any]] {
    var defaultsToRegister: [String: Any] = [:]
    for pref in preferences {
      if let key = pref["Key"] as? String,
         let defaultValue = pref["DefaultValue"] {
        defaultsToRegister[key] = defaultValue
      }
    }
    UserDefaults.standard.register(defaults: defaultsToRegister)
    print("[Settings] Registered defaults: \\(defaultsToRegister)")
  }

  // Set version and build info in Settings
  let version = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "Unknown"
  let build = Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "Unknown"
  UserDefaults.standard.set(version, forKey: "version_preference")
  UserDefaults.standard.set(build, forKey: "build_preference")
  print("[Settings] Version: \\(version), Build: \\(build)")
`;

const withSettingsDefaults = (config) => {
  return withAppDelegate(config, async (config) => {
    let contents = config.modResults.contents;

    // Check if we've already added this code
    if (contents.includes('Register Settings.bundle defaults')) {
      console.log('[withSettingsDefaults] Already added, skipping');
      return config;
    }

    // Find the application didFinishLaunchingWithOptions method
    // Expo's AppDelegate.swift splits the method signature across multiple lines
    const didFinishMarker = 'didFinishLaunchingWithOptions launchOptions:';

    if (contents.includes(didFinishMarker)) {
      // Find the method and then look for "-> Bool {" which marks the start of the body
      const methodStart = contents.indexOf(didFinishMarker);
      // Find the opening brace of the function body (after "-> Bool {")
      const braceIndex = contents.indexOf('{', methodStart);

      if (braceIndex !== -1) {
        // Insert our code right after the opening brace
        contents =
          contents.slice(0, braceIndex + 1) +
          '\n' +
          DEFAULTS_REGISTRATION_CODE +
          contents.slice(braceIndex + 1);

        console.log('[withSettingsDefaults] Added defaults registration to AppDelegate');
      }
    } else {
      console.log('[withSettingsDefaults] Could not find didFinishLaunchingWithOptions method');
    }

    config.modResults.contents = contents;
    return config;
  });
};

module.exports = withSettingsDefaults;
