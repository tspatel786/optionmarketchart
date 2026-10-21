import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import crypto from 'crypto';
import {
  GrowwApiClient,
  GrowwApiError,
  generateChecksum,
  getNextGrowwDailyExpiry,
  sanitizeSecret,
} from '../growwApiClient';

describe('GrowwApiClient & Authentication', () => {
  describe('generateChecksum', () => {
    it('should compute valid SHA-256 hash of secret + timestamp', () => {
      const secret = 'my_secret_key';
      const timestamp = '1729500000';
      const expected = crypto.createHash('sha256').update(`${secret}${timestamp}`).digest('hex');
      const actual = generateChecksum(secret, timestamp);
      expect(actual).toBe(expected);
      expect(actual.length).toBe(64);
    });
  });

  describe('getNextGrowwDailyExpiry', () => {
    it('should calculate expiry for 6:00 AM IST next day if current time is after 6:00 AM IST', () => {
      // 10:00 AM IST (04:30 UTC)
      const date = new Date('2026-10-21T04:30:00.000Z');
      const expiry = getNextGrowwDailyExpiry(date);
      // Expiry should be tomorrow 6:00 AM IST (00:30 UTC)
      expect(expiry.getUTCHours()).toBe(0);
      expect(expiry.getUTCMinutes()).toBe(30);
      expect(expiry.getTime()).toBeGreaterThan(date.getTime());
    });

    it('should calculate expiry for 6:00 AM IST today if current time is before 6:00 AM IST', () => {
      // 5:00 AM IST (23:30 UTC previous day)
      const date = new Date('2026-10-20T23:30:00.000Z');
      const expiry = getNextGrowwDailyExpiry(date);
      expect(expiry.getUTCHours()).toBe(0);
      expect(expiry.getUTCMinutes()).toBe(30);
      expect(expiry.getTime()).toBeGreaterThan(date.getTime());
    });
  });

  describe('sanitizeSecret', () => {
    it('should mask sensitive API keys and tokens', () => {
      expect(sanitizeSecret('groww_live_secret_key_12345')).toBe('grow...2345');
      expect(sanitizeSecret('short')).toBe('****');
      expect(sanitizeSecret('1234')).toBe('****');
      expect(sanitizeSecret('')).toBe('[EMPTY]');
      expect(sanitizeSecret(undefined)).toBe('[EMPTY]');
    });
  });

  describe('GrowwApiClient Client Methods', () => {
    let originalFetch: typeof global.fetch;

    beforeEach(() => {
      originalFetch = global.fetch;
    });

    afterEach(() => {
      global.fetch = originalFetch;
      vi.restoreAllMocks();
    });

    it('should report configuration status properly', () => {
      const client = new GrowwApiClient({
        apiKey: 'gr_api_key_123456789',
        apiSecret: 'gr_api_secret_123456789',
      });
      expect(client.isConfigured()).toBe(true);
      const status = client.getTokenStatus();
      expect(status.configured).toBe(true);
      expect(status.hasActiveToken).toBe(false);
    });

    it('should authenticate via API Key + Secret checksum and obtain access token', async () => {
      const mockAuthResponse = {
        status: 'SUCCESS',
        payload: {
          token: 'groww_jwt_access_token_mock',
        },
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockAuthResponse,
        text: async () => JSON.stringify(mockAuthResponse),
      } as any);

      const client = new GrowwApiClient({
        apiKey: 'gr_api_key_123456789',
        apiSecret: 'gr_api_secret_123456789',
      });

      const token = await client.getAccessToken();
      expect(token).toBe('groww_jwt_access_token_mock');
      expect(client.getTokenStatus().hasActiveToken).toBe(true);

      // Subsequent call should use cached token
      const cached = await client.getAccessToken();
      expect(cached).toBe('groww_jwt_access_token_mock');
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should retry on HTTP 429 rate limit with exponential backoff on single endpoint', async () => {
      let callCount = 0;
      global.fetch = vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          return {
            ok: false,
            status: 429,
            headers: new Headers({ 'Retry-After': '1' }),
            text: async () => 'Rate limit exceeded',
          };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({ last_price: 24500 }),
          text: async () => JSON.stringify({ last_price: 24500 }),
        };
      });

      const client = new GrowwApiClient({
        accessToken: 'preconfigured_token_valid_over_10_chars',
        maxRetries: 2,
      });

      const quote = await client.getLiveQuote('NIFTY');
      expect(callCount).toBe(2);
      expect(quote.lastPrice).toBe(24500);
    });

    it('should throw GrowwApiError on unrecoverable 401 Unauthorized', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized: Invalid credentials or approval required',
      } as any);

      const client = new GrowwApiClient({
        accessToken: 'invalid_token_over_10_chars',
        maxRetries: 1,
      });

      await expect(client.getLiveQuote('NIFTY')).rejects.toThrow(GrowwApiError);
    });
  });
});
