/**
 * Tests for the browserReturn service.
 *
 * Tests browser-specific URL construction for iOS and Android,
 * return URL routing, and deep link parsing.
 */

import { Linking, Platform } from 'react-native';
import { openReturnUrl, parseSourceBrowser } from '../../src/services/browserReturn';

// Mock react-native
jest.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
    select: jest.fn((obj: Record<string, any>) => obj.ios),
  },
  Linking: {
    openURL: jest.fn(),
    canOpenURL: jest.fn(),
  },
}));

const mockLinking = Linking as jest.Mocked<typeof Linking>;

describe('browserReturn', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (Platform as any).OS = 'ios';
    (Platform.select as jest.Mock).mockImplementation((obj: Record<string, any>) => obj.ios);
  });

  describe('openReturnUrl', () => {
    const testUrl = 'https://merchant.com/checkout/success';

    describe('default browser cases', () => {
      it('should open in default browser when no sourceBrowser provided', async () => {
        mockLinking.openURL.mockResolvedValue(undefined);

        await openReturnUrl(testUrl);

        expect(mockLinking.openURL).toHaveBeenCalledWith(testUrl);
        expect(mockLinking.canOpenURL).not.toHaveBeenCalled();
      });

      it('should open in default browser when sourceBrowser is null', async () => {
        mockLinking.openURL.mockResolvedValue(undefined);

        await openReturnUrl(testUrl, null);

        expect(mockLinking.openURL).toHaveBeenCalledWith(testUrl);
      });

      it('should open in default browser when sourceBrowser is "safari"', async () => {
        mockLinking.openURL.mockResolvedValue(undefined);

        await openReturnUrl(testUrl, 'safari');

        expect(mockLinking.openURL).toHaveBeenCalledWith(testUrl);
        expect(mockLinking.canOpenURL).not.toHaveBeenCalled();
      });

      it('should open in default browser when sourceBrowser is "other"', async () => {
        mockLinking.openURL.mockResolvedValue(undefined);

        await openReturnUrl(testUrl, 'other');

        expect(mockLinking.openURL).toHaveBeenCalledWith(testUrl);
        expect(mockLinking.canOpenURL).not.toHaveBeenCalled();
      });

      it('should open in default browser when sourceBrowser is unknown', async () => {
        mockLinking.openURL.mockResolvedValue(undefined);

        await openReturnUrl(testUrl, 'unknownbrowser');

        expect(mockLinking.openURL).toHaveBeenCalledWith(testUrl);
      });
    });

    describe('iOS Chrome', () => {
      it('should construct Chrome URL and open when available', async () => {
        mockLinking.canOpenURL.mockResolvedValue(true);
        mockLinking.openURL.mockResolvedValue(undefined);

        await openReturnUrl(testUrl, 'chrome');

        expect(mockLinking.canOpenURL).toHaveBeenCalledWith('googlechrome://');
        expect(mockLinking.openURL).toHaveBeenCalledWith(
          'googlechromes://merchant.com/checkout/success'
        );
      });

      it('should fallback to default when Chrome not installed', async () => {
        mockLinking.canOpenURL.mockResolvedValue(false);
        mockLinking.openURL.mockResolvedValue(undefined);

        await openReturnUrl(testUrl, 'chrome');

        expect(mockLinking.canOpenURL).toHaveBeenCalledWith('googlechrome://');
        expect(mockLinking.openURL).toHaveBeenCalledWith(testUrl);
      });

      it('should handle case-insensitive browser name', async () => {
        mockLinking.canOpenURL.mockResolvedValue(true);
        mockLinking.openURL.mockResolvedValue(undefined);

        await openReturnUrl(testUrl, 'CHROME');

        expect(mockLinking.canOpenURL).toHaveBeenCalledWith('googlechrome://');
      });
    });

    describe('iOS Firefox', () => {
      it('should construct Firefox URL with encoded URL', async () => {
        mockLinking.canOpenURL.mockResolvedValue(true);
        mockLinking.openURL.mockResolvedValue(undefined);

        await openReturnUrl(testUrl, 'firefox');

        expect(mockLinking.canOpenURL).toHaveBeenCalledWith('firefox://');
        expect(mockLinking.openURL).toHaveBeenCalledWith(
          `firefox://open-url?url=${encodeURIComponent(testUrl)}`
        );
      });

      it('should fallback when Firefox not installed', async () => {
        mockLinking.canOpenURL.mockResolvedValue(false);
        mockLinking.openURL.mockResolvedValue(undefined);

        await openReturnUrl(testUrl, 'firefox');

        expect(mockLinking.openURL).toHaveBeenCalledWith(testUrl);
      });
    });

    describe('iOS Edge', () => {
      it('should construct Edge URL', async () => {
        mockLinking.canOpenURL.mockResolvedValue(true);
        mockLinking.openURL.mockResolvedValue(undefined);

        await openReturnUrl(testUrl, 'edge');

        expect(mockLinking.canOpenURL).toHaveBeenCalledWith('microsoft-edge://');
        expect(mockLinking.openURL).toHaveBeenCalledWith(
          'microsoft-edge://merchant.com/checkout/success'
        );
      });
    });

    describe('iOS Opera', () => {
      it('should construct Opera URL with encoded URL', async () => {
        mockLinking.canOpenURL.mockResolvedValue(true);
        mockLinking.openURL.mockResolvedValue(undefined);

        await openReturnUrl(testUrl, 'opera');

        expect(mockLinking.canOpenURL).toHaveBeenCalledWith('opera://');
        expect(mockLinking.openURL).toHaveBeenCalledWith(
          `opera://open-url?url=${encodeURIComponent(testUrl)}`
        );
      });
    });

    describe('iOS Brave', () => {
      it('should construct Brave URL with encoded URL', async () => {
        mockLinking.canOpenURL.mockResolvedValue(true);
        mockLinking.openURL.mockResolvedValue(undefined);

        await openReturnUrl(testUrl, 'brave');

        expect(mockLinking.canOpenURL).toHaveBeenCalledWith('brave://');
        expect(mockLinking.openURL).toHaveBeenCalledWith(
          `brave://open-url?url=${encodeURIComponent(testUrl)}`
        );
      });
    });

    describe('Android browsers', () => {
      beforeEach(() => {
        (Platform as any).OS = 'android';
        (Platform.select as jest.Mock).mockImplementation((obj: Record<string, any>) => obj.android);
      });

      it('should construct Chrome intent URL for Android', async () => {
        mockLinking.canOpenURL.mockResolvedValue(true);
        mockLinking.openURL.mockResolvedValue(undefined);

        await openReturnUrl(testUrl, 'chrome');

        expect(mockLinking.openURL).toHaveBeenCalledWith(
          'intent://merchant.com/checkout/success#Intent;scheme=https;package=com.android.chrome;end'
        );
      });

      it('should construct Firefox intent URL for Android', async () => {
        mockLinking.canOpenURL.mockResolvedValue(true);
        mockLinking.openURL.mockResolvedValue(undefined);

        await openReturnUrl(testUrl, 'firefox');

        expect(mockLinking.openURL).toHaveBeenCalledWith(
          'intent://merchant.com/checkout/success#Intent;scheme=https;package=org.mozilla.firefox;end'
        );
      });

      it('should construct Samsung Browser intent URL', async () => {
        mockLinking.canOpenURL.mockResolvedValue(true);
        mockLinking.openURL.mockResolvedValue(undefined);

        await openReturnUrl(testUrl, 'samsung');

        expect(mockLinking.openURL).toHaveBeenCalledWith(
          'intent://merchant.com/checkout/success#Intent;scheme=https;package=com.sec.android.app.sbrowser;end'
        );
      });

      it('should preserve query params in Android intent URL', async () => {
        mockLinking.canOpenURL.mockResolvedValue(true);
        mockLinking.openURL.mockResolvedValue(undefined);

        const urlWithParams = 'https://merchant.com/checkout?orderId=123&status=success';
        await openReturnUrl(urlWithParams, 'chrome');

        expect(mockLinking.openURL).toHaveBeenCalledWith(
          'intent://merchant.com/checkout?orderId=123&status=success#Intent;scheme=https;package=com.android.chrome;end'
        );
      });

      it('should preserve hash in Android intent URL', async () => {
        mockLinking.canOpenURL.mockResolvedValue(true);
        mockLinking.openURL.mockResolvedValue(undefined);

        const urlWithHash = 'https://merchant.com/checkout#confirmation';
        await openReturnUrl(urlWithHash, 'chrome');

        expect(mockLinking.openURL).toHaveBeenCalledWith(
          'intent://merchant.com/checkout#confirmation#Intent;scheme=https;package=com.android.chrome;end'
        );
      });
    });

    describe('Samsung on iOS (no iOS scheme)', () => {
      it('should fallback to default browser when no iOS scheme exists', async () => {
        (Platform as any).OS = 'ios';
        (Platform.select as jest.Mock).mockImplementation((obj: Record<string, any>) => obj.ios);
        mockLinking.openURL.mockResolvedValue(undefined);

        await openReturnUrl(testUrl, 'samsung');

        // Samsung has no iOS scheme, so it should fall back to default
        expect(mockLinking.openURL).toHaveBeenCalledWith(testUrl);
      });
    });

    describe('error handling', () => {
      it('should fallback to default when canOpenURL throws', async () => {
        mockLinking.canOpenURL.mockRejectedValue(new Error('Permission denied'));
        mockLinking.openURL.mockResolvedValue(undefined);

        await openReturnUrl(testUrl, 'chrome');

        expect(mockLinking.openURL).toHaveBeenCalledWith(testUrl);
      });
    });
  });

  describe('parseSourceBrowser', () => {
    it('should parse sourceBrowser from URL with query params', () => {
      const url = 'mwsim://payment/abc123?returnUrl=https%3A%2F%2Fmerchant.com&sourceBrowser=chrome';

      const result = parseSourceBrowser(url);

      expect(result).toBe('chrome');
    });

    it('should return null when no query params', () => {
      const url = 'mwsim://payment/abc123';

      const result = parseSourceBrowser(url);

      expect(result).toBeNull();
    });

    it('should return null when sourceBrowser not present', () => {
      const url = 'mwsim://payment/abc123?returnUrl=https%3A%2F%2Fmerchant.com';

      const result = parseSourceBrowser(url);

      expect(result).toBeNull();
    });

    it('should parse various browser values', () => {
      expect(parseSourceBrowser('mwsim://pay?sourceBrowser=firefox')).toBe('firefox');
      expect(parseSourceBrowser('mwsim://pay?sourceBrowser=edge')).toBe('edge');
      expect(parseSourceBrowser('mwsim://pay?sourceBrowser=safari')).toBe('safari');
      expect(parseSourceBrowser('mwsim://pay?sourceBrowser=brave')).toBe('brave');
    });

    it('should handle empty sourceBrowser value', () => {
      const url = 'mwsim://payment/abc?sourceBrowser=';

      const result = parseSourceBrowser(url);

      expect(result).toBe('');
    });

    it('should parse sourceBrowser with multiple query params', () => {
      const url = 'mwsim://payment/abc?orderId=123&sourceBrowser=opera&amount=50.00';

      const result = parseSourceBrowser(url);

      expect(result).toBe('opera');
    });

    it('should handle malformed URL gracefully', () => {
      // URLSearchParams should handle this, but test edge case
      const url = 'not-a-valid-url';

      const result = parseSourceBrowser(url);

      expect(result).toBeNull();
    });
  });
});
