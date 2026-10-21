import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  AngelOneApiClient,
  AngelOneApiError,
  generateAngelTotp,
  base32Decode,
  maskAngelSecret,
  ANGEL_TOKENS,
} from '../angelOneApiClient';

describe('AngelOneApiClient & TOTP RFC 6238', () => {
  describe('base32Decode & generateAngelTotp', () => {
    it('should decode standard base32 string into buffer correctly', () => {
      // RFC 4648 base32 test vector: "MZXW6YTB" -> 5 bytes "fooba"
      const decoded = base32Decode('MZXW6YTB');
      expect(decoded.toString('utf-8')).toBe('fooba');

      // "foobar" in base32 is "MZXW6YTBOI======"
      const decodedBar = base32Decode('MZXW6YTBOI======');
      expect(decodedBar.toString('utf-8')).toBe('foobar');
    });

    it('should generate a 6-digit numeric TOTP code', () => {
      // Standard 32-char test secret (JBSWY3DPEHPK3PXP is standard RFC test key)
      const totp = generateAngelTotp('JBSWY3DPEHPK3PXP', 1700000000);
      expect(totp).toMatch(/^\d{6}$/);
      expect(totp.length).toBe(6);
    });

    it('should generate consistent TOTP for same timestamp window', () => {
      const secret = 'HXDMVJECJJWSRB3HWIZR4IFUGFTMXBOZ';
      const code1 = generateAngelTotp(secret, 1729500000);
      const code2 = generateAngelTotp(secret, 1729500015); // within same 30s window
      expect(code1).toBe(code2);
    });

    it('should throw if secret is empty', () => {
      expect(() => generateAngelTotp('')).toThrow('TOTP secret is required');
    });
  });

  describe('maskAngelSecret', () => {
    it('should mask sensitive credentials without exposing them', () => {
      expect(maskAngelSecret('0F9CsFDY')).toBe('0F***DY');
      expect(maskAngelSecret('A123456')).toBe('A1***56');
      expect(maskAngelSecret('1234')).toBe('****');
      expect(maskAngelSecret('')).toBe('[EMPTY]');
      expect(maskAngelSecret(undefined)).toBe('[EMPTY]');
    });
  });

  describe('ANGEL_TOKENS mapping', () => {
    it('should have accurate token IDs for NIFTY 50 and BANK NIFTY', () => {
      expect(ANGEL_TOKENS['NIFTY'].token).toBe('99926000');
      expect(ANGEL_TOKENS['NIFTY 50'].token).toBe('99926000');
      expect(ANGEL_TOKENS['BANKNIFTY'].token).toBe('99926009');
      expect(ANGEL_TOKENS['BANK NIFTY'].token).toBe('99926009');
    });
  });

  describe('AngelOneApiClient Client State & Authentication', () => {
    let originalFetch: typeof global.fetch;

    beforeEach(() => {
      originalFetch = global.fetch;
    });

    afterEach(() => {
      global.fetch = originalFetch;
      vi.restoreAllMocks();
    });

    it('should correctly report configured status when all credentials are provided', () => {
      const client = new AngelOneApiClient({
        apiKey: '0F9CsFDY',
        clientCode: 'P123456',
        pin: '1234',
        totpSecret: 'HXDMVJECJJWSRB3H',
      });
      expect(client.isConfigured()).toBe(true);
      const status = client.getSessionStatus();
      expect(status.configured).toBe(true);
      expect(status.apiKeyConfigured).toBe(true);
      expect(status.clientCode).toBe('P1***56');
    });

    it('should report unconfigured status when credentials are empty', () => {
      const client = new AngelOneApiClient({});
      expect(client.isConfigured()).toBe(false);
      expect(client.getSessionStatus().configured).toBe(false);
    });

    it('should authenticate successfully via loginByPassword and cache JWT session', async () => {
      const mockResponse = {
        status: true,
        message: 'SUCCESS',
        errorcode: '',
        data: {
          jwtToken: 'mock.jwt.token.for.angel.one.smartapi',
          refreshToken: 'mock.refresh.token',
          feedToken: 'mock.feed.token',
        },
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResponse,
        text: async () => JSON.stringify(mockResponse),
      } as any);

      const client = new AngelOneApiClient({
        apiKey: '0F9CsFDY',
        clientCode: 'P123456',
        pin: '1234',
        totpSecret: 'HXDMVJECJJWSRB3H',
      });

      const token = await client.getValidJwtToken();
      expect(token).toBe('mock.jwt.token.for.angel.one.smartapi');
      expect(client.getSessionStatus().hasSession).toBe(true);

      // Second call should return cached token without calling fetch again
      const cachedToken = await client.getValidJwtToken();
      expect(cachedToken).toBe('mock.jwt.token.for.angel.one.smartapi');
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should parse 5m candle data and filter out open unclosed candles', async () => {
      const nowEpoch = Math.floor(Date.now() / 1000);
      const pastTime1 = new Date((nowEpoch - 600) * 1000).toISOString();
      const pastTime2 = new Date((nowEpoch - 300) * 1000).toISOString();
      const openCandleTime = new Date((nowEpoch - 60) * 1000).toISOString(); // unclosed

      const candleResponse = {
        status: true,
        message: 'SUCCESS',
        data: [
          [pastTime1, 24500, 24550, 24480, 24520, 15000],
          [pastTime2, 24520, 24560, 24510, 24540, 18000],
          [openCandleTime, 24540, 24570, 24530, 24560, 5000], // should be filtered out
        ],
      };

      const client = new AngelOneApiClient({
        jwtToken: 'preconfigured.valid.jwt.token.above.20.chars',
      });

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => candleResponse,
        text: async () => JSON.stringify(candleResponse),
      } as any);

      const candles = await client.get5mClosedCandles('NIFTY', '2026-10-21 09:15', '2026-10-21 15:30');

      expect(candles.length).toBe(2);
      expect(candles[0].open).toBe(24500);
      expect(candles[0].close).toBe(24520);
      expect(candles[0].isClosed).toBe(true);
      expect(candles[1].open).toBe(24520);
      expect(candles[1].close).toBe(24540);
    });

    it('should handle Angel One API errors gracefully', async () => {
      const errorResponse = {
        status: false,
        message: 'Invalid TOTP or Credentials',
        errorcode: 'AG8001',
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => errorResponse,
      } as any);

      const client = new AngelOneApiClient({
        apiKey: '0F9CsFDY',
        clientCode: 'P123456',
        pin: '1234',
        totpSecret: 'HXDMVJECJJWSRB3H',
      });

      await expect(client.login()).rejects.toThrow(AngelOneApiError);
    });
  });
});
