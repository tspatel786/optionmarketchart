import crypto from 'crypto';
import type { MarketCandle, LiveQuote } from './growwApiClient';

/**
 * Angel One SmartAPI Client
 * Documentation: https://smartapi.angelbroking.com/docs
 *
 * Implements:
 * 1. Automatic TOTP generation (RFC 6238) from base32 TOTP secret
 * 2. Login by Password/PIN + TOTP -> JWT Token & Refresh Token
 * 3. Proactive session renewal and token caching
 * 4. 5-minute closed historical candle data for NIFTY 50 and BANK NIFTY
 * 5. Live quote and LTP fetching
 * 6. Rate-limit protection and exponential backoff retries
 * 7. Masked structured logging (no PIN/passwords or JWTs in logs)
 */

export interface AngelOneConfig {
  apiKey?: string;
  clientCode?: string;
  pin?: string;
  totpSecret?: string;
  jwtToken?: string;
  refreshToken?: string;
  feedToken?: string;
  baseUrl?: string;
  timeoutMs?: number;
  maxRetries?: number;
  clientLocalIP?: string;
  clientPublicIP?: string;
  macAddress?: string;
  logger?: (level: 'info' | 'warn' | 'error', message: string, meta?: Record<string, any>) => void;
}

export interface AngelOneSession {
  jwtToken: string;
  refreshToken: string;
  feedToken: string;
  expiresAt: number; // Unix timestamp in ms
}

export class AngelOneApiError extends Error {
  public code?: string;
  public statusCode?: number;
  public endpoint?: string;
  public isAuthError: boolean;
  public isRateLimit: boolean;

  constructor(message: string, options?: { code?: string; statusCode?: number; endpoint?: string }) {
    super(message);
    this.name = 'AngelOneApiError';
    this.code = options?.code;
    this.statusCode = options?.statusCode;
    this.endpoint = options?.endpoint;
    this.isAuthError = options?.statusCode === 401 || options?.statusCode === 403 || options?.code === 'AG8001';
    this.isRateLimit = options?.statusCode === 429;
  }
}

/**
 * Decode base32 string into a binary Buffer
 */
export function base32Decode(base32: string): Buffer {
  const cleaned = base32.toUpperCase().replace(/=+$/, '').replace(/[\s-]+/g, '');
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];

  for (let i = 0; i < cleaned.length; i++) {
    const idx = alphabet.indexOf(cleaned[i]);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

/**
 * Generate 6-digit TOTP (RFC 6238 standard HMAC-SHA1)
 */
export function generateAngelTotp(secret: string, timeSec = Math.floor(Date.now() / 1000)): string {
  if (!secret) {
    throw new Error('TOTP secret is required to generate Angel One TOTP');
  }
  const key = base32Decode(secret);
  const timeStep = 30;
  const counter = Math.floor(timeSec / timeStep);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));

  const hmac = crypto.createHmac('sha1', key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code = (
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff)
  ) % 1_000_000;

  return code.toString().padStart(6, '0');
}

/**
 * Mask secret strings for secure structured logs
 */
export function maskAngelSecret(val?: string | null): string {
  if (!val) return '[EMPTY]';
  const trimmed = val.trim();
  if (trimmed.length <= 4) return '****';
  return `${trimmed.slice(0, 2)}***${trimmed.slice(-2)}`;
}

// Angel One official Exchange tokens for Indices and Major Underlyings
export const ANGEL_TOKENS: Record<string, { symbol: string; token: string; exchange: 'NSE' | 'BSE' | 'NFO' }> = {
  'NIFTY': { symbol: 'Nifty 50', token: '99926000', exchange: 'NSE' },
  'NIFTY 50': { symbol: 'Nifty 50', token: '99926000', exchange: 'NSE' },
  'BANKNIFTY': { symbol: 'Nifty Bank', token: '99926009', exchange: 'NSE' },
  'BANK NIFTY': { symbol: 'Nifty Bank', token: '99926009', exchange: 'NSE' },
  'FINNIFTY': { symbol: 'Nifty Fin Service', token: '99926037', exchange: 'NSE' },
  'SENSEX': { symbol: 'BSE SENSEX', token: '99919000', exchange: 'BSE' },
};

export class AngelOneApiClient {
  private apiKey?: string;
  private clientCode?: string;
  private pin?: string;
  private totpSecret?: string;
  private baseUrl: string;
  private timeoutMs: number;
  private maxRetries: number;
  private clientLocalIP: string;
  private clientPublicIP: string;
  private macAddress: string;

  private session: AngelOneSession | null = null;
  private loginPromise: Promise<AngelOneSession> | null = null;
  private lastRequestTime = 0;

  private logger: (level: 'info' | 'warn' | 'error', message: string, meta?: Record<string, any>) => void;

  constructor(config: AngelOneConfig = {}) {
    this.apiKey = config.apiKey?.trim();
    this.clientCode = config.clientCode?.trim();
    this.pin = config.pin?.trim();
    this.totpSecret = config.totpSecret?.trim();
    this.baseUrl = (config.baseUrl || 'https://apiconnect.angelone.in').replace(/\/+$/, '');
    this.timeoutMs = config.timeoutMs ?? 15000;
    this.maxRetries = config.maxRetries ?? 3;
    this.clientLocalIP = config.clientLocalIP || '192.168.1.1';
    this.clientPublicIP = config.clientPublicIP || process.env.ANGEL_ONE_STATIC_IP || '152.59.63.203';
    this.macAddress = config.macAddress || 'fe80::216e:6507:4b90:3719';

    if (config.jwtToken) {
      this.session = {
        jwtToken: config.jwtToken.trim(),
        refreshToken: config.refreshToken?.trim() || '',
        feedToken: config.feedToken?.trim() || '',
        expiresAt: Date.now() + 18 * 60 * 60 * 1000, // standard 18-hour session
      };
    }

    this.logger = config.logger || ((level, msg, meta) => {
      const metaStr = meta ? ` | ${JSON.stringify(meta)}` : '';
      if (level === 'error') {
        console.error(`[AngelOneApiClient] [ERROR] ${msg}${metaStr}`);
      } else if (level === 'warn') {
        console.warn(`[AngelOneApiClient] [WARN] ${msg}${metaStr}`);
      } else {
        console.log(`[AngelOneApiClient] [INFO] ${msg}${metaStr}`);
      }
    });
  }

  public setCredentials(credentials: {
    apiKey?: string;
    clientCode?: string;
    pin?: string;
    totpSecret?: string;
    jwtToken?: string;
  }): void {
    if (credentials.apiKey !== undefined) this.apiKey = credentials.apiKey.trim();
    if (credentials.clientCode !== undefined) this.clientCode = credentials.clientCode.trim();
    if (credentials.pin !== undefined) this.pin = credentials.pin.trim();
    if (credentials.totpSecret !== undefined) this.totpSecret = credentials.totpSecret.trim();
    if (credentials.jwtToken !== undefined) {
      this.session = {
        jwtToken: credentials.jwtToken.trim(),
        refreshToken: '',
        feedToken: '',
        expiresAt: Date.now() + 18 * 60 * 60 * 1000,
      };
    } else {
      this.session = null;
    }
  }

  private getEffectiveCredentials() {
    return {
      apiKey: this.apiKey || process.env.ANGEL_ONE_API_KEY?.trim(),
      clientCode: this.clientCode || process.env.ANGEL_ONE_CLIENT_CODE?.trim(),
      pin: this.pin || process.env.ANGEL_ONE_PIN?.trim(),
      totpSecret: this.totpSecret || process.env.ANGEL_ONE_TOTP_SECRET?.trim(),
    };
  }

  public isConfigured(): boolean {
    const creds = this.getEffectiveCredentials();
    const hasActiveJwt = Boolean(this.session && this.session.jwtToken.length > 20);
    const hasFullCredentials = Boolean(
      creds.apiKey && creds.apiKey.length > 5 &&
      creds.clientCode && creds.clientCode.length > 3 &&
      creds.pin && creds.pin.length >= 4 &&
      creds.totpSecret && creds.totpSecret.length >= 8
    );
    return hasActiveJwt || hasFullCredentials;
  }

  public getSessionStatus() {
    const creds = this.getEffectiveCredentials();
    return {
      configured: this.isConfigured(),
      hasSession: Boolean(this.session && this.session.jwtToken),
      clientCode: creds.clientCode ? maskAngelSecret(creds.clientCode) : 'N/A',
      apiKeyConfigured: Boolean(creds.apiKey),
      expiresInMinutes: this.session ? Math.max(0, Math.floor((this.session.expiresAt - Date.now()) / 60000)) : null,
    };
  }

  /**
   * Acquire valid Angel One JWT token
   */
  public async getValidJwtToken(): Promise<string> {
    const now = Date.now();
    if (this.session && this.session.expiresAt - now > 60_000) {
      return this.session.jwtToken;
    }

    if (this.loginPromise) {
      const res = await this.loginPromise;
      return res.jwtToken;
    }

    this.loginPromise = (async () => {
      try {
        const sess = await this.login();
        this.session = sess;
        return sess;
      } finally {
        this.loginPromise = null;
      }
    })();

    const result = await this.loginPromise;
    return result.jwtToken;
  }

  /**
   * Login using ClientCode, Password/PIN, and dynamic TOTP
   * POST /rest/auth/partner/v1/loginByPassword
   */
  public async login(): Promise<AngelOneSession> {
    const creds = this.getEffectiveCredentials();
    if (!creds.apiKey || !creds.clientCode || !creds.pin || !creds.totpSecret) {
      if (this.session?.jwtToken) return this.session;
      throw new AngelOneApiError(
        'Missing Angel One credentials. Required: ANGEL_ONE_API_KEY, ANGEL_ONE_CLIENT_CODE, ANGEL_ONE_PIN, ANGEL_ONE_TOTP_SECRET',
        { code: 'CONFIG_MISSING', statusCode: 400 }
      );
    }

    const totp = generateAngelTotp(creds.totpSecret);
    const loginUrl = `${this.baseUrl}/rest/auth/angelbroking/user/v1/loginByPassword`;

    this.logger('info', 'Authenticating with Angel One SmartAPI via TOTP', {
      clientCode: maskAngelSecret(creds.clientCode),
      apiKey: maskAngelSecret(creds.apiKey),
    });

    const body = {
      clientcode: creds.clientCode,
      password: creds.pin,
      totp,
    };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-UserType': 'USER',
      'X-SourceID': 'WEB',
      'X-ClientLocalIP': this.clientLocalIP,
      'X-ClientPublicIP': this.clientPublicIP,
      'X-MACAddress': this.macAddress,
      'X-PrivateKey': creds.apiKey,
    };

    const res = await this.executeFetchWithTimeout(loginUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    }, this.timeoutMs);

    if (!res.ok) {
      const errText = await res.text();
      this.logger('error', `Angel One login failed (HTTP ${res.status}): ${errText}`);
      throw new AngelOneApiError(`Angel One Login Failed (HTTP ${res.status}): ${errText}`, {
        statusCode: res.status,
        endpoint: '/rest/auth/angelbroking/user/v1/loginByPassword',
      });
    }

    const data = await res.json();
    if (data.status === false || !data.data?.jwtToken) {
      const msg = data.message || 'Login returned false status';
      const code = data.errorcode || 'LOGIN_ERROR';
      this.logger('error', `Angel One login response error [${code}]: ${msg}`);
      throw new AngelOneApiError(`Angel One Login Error [${code}]: ${msg}`, {
        code,
        statusCode: 401,
        endpoint: '/rest/auth/angelbroking/user/v1/loginByPassword',
      });
    }

    this.logger('info', 'Angel One authentication successful! Session acquired.');

    this.session = {
      jwtToken: data.data.jwtToken,
      refreshToken: data.data.refreshToken || '',
      feedToken: data.data.feedToken || '',
      expiresAt: Date.now() + 18 * 60 * 60 * 1000,
    };

    return this.session;
  }

  /**
   * Renew token session using refresh token
   */
  public async renewToken(): Promise<string> {
    const creds = this.getEffectiveCredentials();
    if (!this.session?.refreshToken || !creds.apiKey) {
      return (await this.login()).jwtToken;
    }

    const renewUrl = `${this.baseUrl}/rest/auth/angelbroking/jwt/v1/generateTokens`;
    const headers = {
      'Authorization': `Bearer ${this.session.jwtToken}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-UserType': 'USER',
      'X-SourceID': 'WEB',
      'X-ClientLocalIP': this.clientLocalIP,
      'X-ClientPublicIP': this.clientPublicIP,
      'X-MACAddress': this.macAddress,
      'X-PrivateKey': creds.apiKey,
    };

    try {
      const res = await this.executeFetchWithTimeout(renewUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({ refreshToken: this.session.refreshToken }),
      }, this.timeoutMs);

      if (res.ok) {
        const data = await res.json();
        if (data.status && data.data?.jwtToken) {
          this.session.jwtToken = data.data.jwtToken;
          if (data.data.refreshToken) this.session.refreshToken = data.data.refreshToken;
          this.session.expiresAt = Date.now() + 18 * 60 * 60 * 1000;
          return this.session.jwtToken;
        }
      }
    } catch {
      // Fallback to fresh login
    }

    return (await this.login()).jwtToken;
  }

  /**
   * Standard authenticated Angel One API request wrapper
   */
  public async request<T = any>(
    path: string,
    body: Record<string, any> = {},
    customTimeoutMs?: number
  ): Promise<T> {
    const fullUrl = path.startsWith('http') ? path : `${this.baseUrl}${path.startsWith('/') ? '' : '/'}${path}`;
    const timeout = customTimeoutMs ?? this.timeoutMs;

    let attempt = 0;
    while (attempt <= this.maxRetries) {
      attempt++;
      await this.throttleRateLimit();

      const jwtToken = await this.getValidJwtToken();

      const headers: Record<string, string> = {
        'Authorization': `Bearer ${jwtToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-UserType': 'USER',
        'X-SourceID': 'WEB',
        'X-ClientLocalIP': this.clientLocalIP,
        'X-ClientPublicIP': this.clientPublicIP,
        'X-MACAddress': this.macAddress,
        'X-PrivateKey': this.getEffectiveCredentials().apiKey || '',
      };

      try {
        const res = await this.executeFetchWithTimeout(fullUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        }, timeout);

        if (res.ok) {
          const resJson = await res.json();
          if (resJson.status === false) {
            const errCode = resJson.errorcode;
            const errMsg = resJson.message || 'Angel One API returned false status';

            // Token expired error code in Angel One (AG8001 / AG8002)
            if (errCode === 'AG8001' || errCode === 'AG8002' || errMsg.toLowerCase().includes('token')) {
              this.session = null;
              if (attempt === 1) {
                this.logger('warn', 'Angel One token expired. Retrying after re-authentication...');
                continue;
              }
            }

            throw new AngelOneApiError(`Angel One API Error [${errCode}]: ${errMsg}`, {
              code: errCode,
              statusCode: 400,
              endpoint: path,
            });
          }
          return resJson.data !== undefined ? resJson.data : resJson;
        }

        if (res.status === 401 || res.status === 403) {
          this.session = null;
          if (attempt === 1) {
            continue;
          }
          const errText = await res.text();
          throw new AngelOneApiError(`Angel One Unauthorized (${res.status}): ${errText}`, {
            statusCode: res.status,
            endpoint: path,
          });
        }

        if (res.status === 429) {
          if (attempt > this.maxRetries) {
            throw new AngelOneApiError('Angel One Rate Limit Exceeded (HTTP 429)', {
              statusCode: 429,
              endpoint: path,
            });
          }
          const waitMs = 1000 * Math.pow(2, attempt);
          await new Promise((r) => setTimeout(r, waitMs));
          continue;
        }

        if (res.status >= 500) {
          if (attempt > this.maxRetries) {
            const errText = await res.text();
            throw new AngelOneApiError(`Angel One Server Error (${res.status}): ${errText}`, {
              statusCode: res.status,
              endpoint: path,
            });
          }
          const waitMs = 500 * Math.pow(2, attempt);
          await new Promise((r) => setTimeout(r, waitMs));
          continue;
        }

        const clientErr = await res.text();
        throw new AngelOneApiError(`Angel One Request Error (${res.status}): ${clientErr}`, {
          statusCode: res.status,
          endpoint: path,
        });
      } catch (err: any) {
        if (err instanceof AngelOneApiError) throw err;
        if (attempt <= this.maxRetries) {
          const waitMs = 500 * Math.pow(2, attempt);
          await new Promise((r) => setTimeout(r, waitMs));
          continue;
        }
        throw new AngelOneApiError(`Network error communicating with Angel One: ${err.message}`, {
          endpoint: path,
        });
      }
    }

    throw new AngelOneApiError('Max retries exceeded', { endpoint: path });
  }

  // ==========================================
  // MARKET DATA METHODS
  // ==========================================

  /**
   * Fetch 5-Minute Closed Historical Candle Data from Angel One
   * POST /rest/secure/angelbroking/historical/v1/getCandleData
   * Interval: strictly closed candles (timestamp + 300 <= now)
   */
  public async get5mClosedCandles(
    tradingSymbol: 'NIFTY' | 'BANKNIFTY' | 'NIFTY 50' | 'BANK NIFTY' | string,
    fromDateTime: string, // YYYY-MM-DD HH:mm
    toDateTime: string    // YYYY-MM-DD HH:mm
  ): Promise<MarketCandle[]> {
    const symbolClean = tradingSymbol.toUpperCase().replace(/\s+/g, '');
    const meta = ANGEL_TOKENS[symbolClean] || ANGEL_TOKENS[tradingSymbol] || {
      symbol: tradingSymbol,
      token: '99926000',
      exchange: 'NSE' as const,
    };

    const path = '/rest/secure/angelbroking/historical/v1/getCandleData';
    const body = {
      exchange: meta.exchange,
      symboltoken: meta.token,
      interval: 'FIVE_MINUTE',
      fromdate: fromDateTime.slice(0, 16),
      todate: toDateTime.slice(0, 16),
    };

    const rawCandles = await this.request<any[]>(path, body);
    if (!Array.isArray(rawCandles) || rawCandles.length === 0) {
      return [];
    }

    const nowEpoch = Math.floor(Date.now() / 1000);
    const result: MarketCandle[] = [];

    // Angel One candle format: [ "2026-10-21T09:15:00+05:30", open, high, low, close, volume ]
    for (const c of rawCandles) {
      if (!Array.isArray(c) || c.length < 5) continue;

      const dateStr = String(c[0]);
      const candleEpoch = Math.floor(new Date(dateStr).getTime() / 1000);
      const isClosed = candleEpoch + 300 <= nowEpoch;

      // Filter to closed candles only to prevent signal repainting
      if (!isClosed) continue;

      result.push({
        timestamp: candleEpoch,
        datetime: new Date(candleEpoch * 1000).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
        open: Number(c[1] || 0),
        high: Number(c[2] || 0),
        low: Number(c[3] || 0),
        close: Number(c[4] || 0),
        volume: Number(c[5] || 0),
        isClosed: true,
      });
    }

    return result;
  }

  /**
   * Fetch Live Quote and LTP for an instrument
   * POST /rest/secure/angelbroking/order/v1/getLtpData
   */
  public async getLiveQuote(
    tradingSymbol: 'NIFTY' | 'BANKNIFTY' | 'NIFTY 50' | 'BANK NIFTY' | string
  ): Promise<LiveQuote> {
    const symbolClean = tradingSymbol.toUpperCase().replace(/\s+/g, '');
    const meta = ANGEL_TOKENS[symbolClean] || ANGEL_TOKENS[tradingSymbol] || {
      symbol: tradingSymbol,
      token: '99926000',
      exchange: 'NSE' as const,
    };

    const path = '/rest/secure/angelbroking/order/v1/getLtpData';
    const body = {
      exchange: meta.exchange,
      tradingsymbol: meta.symbol,
      symboltoken: meta.token,
    };

    const data = await this.request<any>(path, body);

    const ltp = Number(data?.ltp || 0);
    const open = Number(data?.open || ltp);
    const high = Number(data?.high || ltp);
    const low = Number(data?.low || ltp);
    const close = Number(data?.close || ltp);
    const dayChange = ltp - close;
    const dayChangePerc = close > 0 ? Number(((dayChange / close) * 100).toFixed(2)) : 0;

    return {
      symbol: tradingSymbol,
      exchange: meta.exchange,
      segment: 'CASH',
      lastPrice: ltp,
      dayChange,
      dayChangePerc,
      open,
      high,
      low,
      close,
      volume: 0,
      timestamp: Date.now(),
    };
  }

  private async executeFetchWithTimeout(
    url: string,
    options: RequestInit,
    timeoutMs: number
  ): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      return await fetch(url, {
        ...options,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  }

  private async throttleRateLimit(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    // Angel One limit: max 3-5 req/s (min 200ms spacing)
    if (elapsed < 200) {
      await new Promise((r) => setTimeout(r, 200 - elapsed));
    }
    this.lastRequestTime = Date.now();
  }
}

export const angelOneClient = new AngelOneApiClient({
  apiKey: process.env.ANGEL_ONE_API_KEY,
  clientCode: process.env.ANGEL_ONE_CLIENT_CODE,
  pin: process.env.ANGEL_ONE_PIN,
  totpSecret: process.env.ANGEL_ONE_TOTP_SECRET,
});
