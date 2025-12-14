/**
 * Browser-aware return URL handling for mwsim.
 *
 * When a merchant website opens mwsim via deep link, we want to return users
 * to the same browser they came from (not just the default browser).
 *
 * SSIM passes a `sourceBrowser` parameter in the deep link, and we use
 * browser-specific URL schemes to open the return URL in the correct browser.
 *
 * @see ssim/docs/proposals/mwsim-browser-return-proposal.md
 */

import { Linking, Platform } from 'react-native';

export type BrowserType =
  | 'safari'
  | 'chrome'
  | 'firefox'
  | 'edge'
  | 'opera'
  | 'brave'
  | 'samsung'
  | 'other';

interface BrowserScheme {
  ios?: string;
  android?: string;
}

/**
 * Browser URL scheme mappings.
 *
 * iOS: Uses custom URL schemes to open specific browsers
 * Android: Uses intent URLs with package names
 */
const BROWSER_SCHEMES: Record<string, BrowserScheme> = {
  chrome: {
    // Chrome on iOS uses googlechromes:// for https URLs
    ios: 'googlechromes://',
    android: 'intent://HOST#Intent;scheme=https;package=com.android.chrome;end',
  },
  firefox: {
    // Firefox uses a special open-url scheme with encoded URL
    ios: 'firefox://open-url?url=',
    android: 'intent://HOST#Intent;scheme=https;package=org.mozilla.firefox;end',
  },
  edge: {
    // Edge uses microsoft-edge:// scheme
    ios: 'microsoft-edge://',
    android: 'intent://HOST#Intent;scheme=https;package=com.microsoft.emmx;end',
  },
  opera: {
    // Opera uses opera://open-url with encoded URL
    ios: 'opera://open-url?url=',
    android: 'intent://HOST#Intent;scheme=https;package=com.opera.browser;end',
  },
  brave: {
    // Brave uses brave://open-url with encoded URL
    ios: 'brave://open-url?url=',
    android: 'intent://HOST#Intent;scheme=https;package=com.brave.browser;end',
  },
  samsung: {
    // Samsung Internet (Android only)
    android: 'intent://HOST#Intent;scheme=https;package=com.sec.android.app.sbrowser;end',
  },
  // Safari and other use default https:// handling
  safari: {},
  other: {},
};

/**
 * Constructs a browser-specific URL for iOS.
 */
function constructIOSUrl(returnUrl: string, browser: string): string | null {
  const scheme = BROWSER_SCHEMES[browser];
  if (!scheme?.ios) {
    return null;
  }

  switch (browser) {
    case 'chrome':
    case 'edge':
      // Chrome and Edge: replace https:// with their scheme
      // googlechromes://example.com/path or microsoft-edge://example.com/path
      return returnUrl.replace(/^https?:\/\//, scheme.ios);

    case 'firefox':
    case 'opera':
    case 'brave':
      // Firefox, Opera, Brave: use open-url with encoded URL
      // firefox://open-url?url=https%3A%2F%2Fexample.com
      return `${scheme.ios}${encodeURIComponent(returnUrl)}`;

    default:
      return null;
  }
}

/**
 * Constructs a browser-specific URL for Android using intent URLs.
 */
function constructAndroidUrl(returnUrl: string, browser: string): string | null {
  const scheme = BROWSER_SCHEMES[browser];
  if (!scheme?.android) {
    return null;
  }

  // Parse the URL to extract host and path
  const url = new URL(returnUrl);
  const hostAndPath = `${url.host}${url.pathname}${url.search}${url.hash}`;

  // Replace HOST placeholder in intent URL
  return scheme.android.replace('HOST', hostAndPath);
}

/**
 * Opens a return URL in the specified browser, with fallback to default.
 *
 * @param returnUrl - The HTTPS URL to open
 * @param sourceBrowser - The browser identifier from the deep link (optional)
 * @returns Promise that resolves when URL is opened
 *
 * @example
 * // Open in Chrome if available, otherwise default browser
 * await openReturnUrl('https://store.com/checkout', 'chrome');
 *
 * // Open in default browser
 * await openReturnUrl('https://store.com/checkout');
 */
export async function openReturnUrl(
  returnUrl: string,
  sourceBrowser?: string | null
): Promise<void> {
  // If no source browser specified, or it's safari/other, use default
  if (!sourceBrowser || sourceBrowser === 'safari' || sourceBrowser === 'other') {
    console.log('[browserReturn] Opening in default browser:', returnUrl);
    await Linking.openURL(returnUrl);
    return;
  }

  const browserKey = sourceBrowser.toLowerCase();
  const scheme = BROWSER_SCHEMES[browserKey];

  // If we don't recognize the browser, use default
  if (!scheme) {
    console.log(`[browserReturn] Unknown browser "${sourceBrowser}", using default:`, returnUrl);
    await Linking.openURL(returnUrl);
    return;
  }

  // Construct platform-specific URL
  const browserUrl = Platform.select({
    ios: constructIOSUrl(returnUrl, browserKey),
    android: constructAndroidUrl(returnUrl, browserKey),
  });

  // Try to open in the specific browser
  if (browserUrl) {
    try {
      const canOpen = await Linking.canOpenURL(browserUrl);
      if (canOpen) {
        console.log(`[browserReturn] Opening in ${sourceBrowser}:`, browserUrl);
        await Linking.openURL(browserUrl);
        return;
      }
      console.log(`[browserReturn] Cannot open ${sourceBrowser} URL, browser may not be installed`);
    } catch (error) {
      console.log(`[browserReturn] Error checking ${sourceBrowser}:`, error);
    }
  }

  // Fallback to default browser
  console.log('[browserReturn] Falling back to default browser:', returnUrl);
  await Linking.openURL(returnUrl);
}

/**
 * Parses the sourceBrowser parameter from a deep link URL.
 *
 * @param url - The full deep link URL
 * @returns The sourceBrowser value or null if not present
 *
 * @example
 * parseSourceBrowser('mwsim://payment/abc?returnUrl=...&sourceBrowser=chrome')
 * // Returns: 'chrome'
 */
export function parseSourceBrowser(url: string): string | null {
  try {
    // Parse query params from URL
    const queryStart = url.indexOf('?');
    if (queryStart === -1) return null;

    const queryString = url.slice(queryStart + 1);
    const params = new URLSearchParams(queryString);
    return params.get('sourceBrowser');
  } catch {
    return null;
  }
}
