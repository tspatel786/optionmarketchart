import crypto from 'crypto';

/**
 * Official Groww Trade API Client
 * Documentation: https://groww.in/trade-api/docs/curl
 *
 * Implements:
 * 1. API Key + Secret authentication flow (SHA-256 checksum)
 * 2. Token generation, caching, and 6:00 AM IST daily expiry tracking
 * 3. Rate limiting (Auth: 5 req/s; Live Data: 10 req/s)
 * 4. Exponential backoff retries for transient failures (429, 5xx)
 * 5. Sanitized structured logging without exposing secrets
 * 6. Market data: NIFTY 50, BANK NIFTY, live quotes, LTP, OHLC, option chain, Greeks, and closed 5m candles
 */

export interface GrowwApiConfig {
  apiKey?: string;
  apiSecret?: string;
  accessToken?: string;
  baseUrl?: string;
  apiVersion?: string;
  timeoutMs?: number;
  maxRetries?: number;
  logger?: (level: 'info' | 'warn' | 'error', message: string, meta?: Record<string, any>) => void;
}

export interface GrowwTokenInfo {
  token: string;
  expiresAt: number; // Unix timestamp in milliseconds
  source: 'APPROVAL_FLOW' | 'STATIC_OVERRIDE';
}

export interface MarketCandle {
  timestamp: number; // Unix timestamp in seconds
  datetime: string;  // ISO / IST string
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  isClosed: boolean;
  openInterest?: number | null;
}

export interface LiveQuote {
  symbol: string;
  exchange: 'NSE' | 'BSE' | 'NFO';
  segment: 'CASH' | 'FNO';
  lastPrice: number;
  dayChange: number;
  dayChangePerc: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  openInterest?: number;
  timestamp: number;
}

export interface OptionGreeks {
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  rho: number;
  iv: number;
}

export interface OptionContractData {
  tradingSymbol: string;
  ltp: number;
  openInterest: number;
  volume: number;
  greeks?: OptionGreeks;
}

export interface OptionChainStrike {
  strikePrice: number;
  CE?: OptionContractData;
  PE?: OptionContractData;
}

export interface OptionChainResponse {
  underlyingLtp: number;
  underlyingSymbol: string;
  expiryDate: string;
  strikes: Record<string, { CE?: OptionContractData; PE?: OptionContractData }>;
}

export class GrowwApiError extends Error {
  public code?: string;
  public statusCode?: number;
  public endpoint?: string;
  public isAuthError: boolean;
  public isRateLimit: boolean;

  constructor(message: string, options?: { code?: string; statusCode?: number; endpoint?: string }) {
    super(message);
    this.name = 'GrowwApiError';
    this.code = options?.code;
    this.statusCode = options?.statusCode;
    this.endpoint = options?.endpoint;
    this.isAuthError = options?.statusCode === 401 || options?.statusCode === 403 || options?.code === 'GA005';
    this.isRateLimit = options?.statusCode === 429;
  }
}

/**
 * Calculates the next 06:00 AM IST daily expiration time.
 * Groww daily tokens expire every day at 06:00 AM IST (00:30 UTC).
 */
export function getNextGrowwDailyExpiry(now = new Date()): Date {
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const istNow = new Date(now.getTime() + istOffsetMs);

  const y = istNow.getUTCFullYear();
  const m = istNow.getUTCMonth();
  const d = istNow.getUTCDate();
  const hours = istNow.getUTCHours();
  const minutes = istNow.getUTCMinutes();

  // If today's IST time is before 06:00 AM, expiry is today at 06:00 AM IST.
  // Otherwise, expiry is tomorrow at 06:00 AM IST.
  let targetDate = d;
  if (hours > 6 || (hours === 6 && minutes >= 0)) {
    targetDate += 1;
  }

  // 06:00:00 IST corresponds to 00:30:00 UTC on the target date
  return new Date(Date.UTC(y, m, targetDate, 0, 30, 0, 0));
}

/**
 * Generates SHA-256 checksum for Groww auth: SHA256(secret + timestamp)
 */
export function generateChecksum(secret: string, timestamp: string): string {
  if (!secret) {
    throw new Error('API Secret is required to generate checksum');
  }
  if (!timestamp) {
    throw new Error('Timestamp is required to generate checksum');
  }
  return crypto.createHash('sha256').update(secret + timestamp, 'utf8').digest('hex');
}

/**
 * Sanitize secrets for safe structured logging
 */
export function sanitizeSecret(secret?: string | null): string {
  if (!secret) return '[EMPTY]';
  const trimmed = secret.trim();
  if (trimmed.length <= 8) return '****';
  return `${trimmed.slice(0, 4)}...${trimmed.slice(-4)}`;
}

export class GrowwApiClient {
  private apiKey?: string;
  private apiSecret?: string;
  private staticToken?: string;
  private baseUrl: string;
  private apiVersion: string;
  private timeoutMs: number;
  private maxRetries: number;

  private cachedToken: GrowwTokenInfo | null = null;
  private authPromise: Promise<GrowwTokenInfo> | null = null;

  // Rate limiter timestamps
  private lastAuthRequestTime = 0;
  private lastLiveRequestTime = 0;

  private logger: (level: 'info' | 'warn' | 'error', message: string, meta?: Record<string, any>) => void;

  constructor(config: GrowwApiConfig = {}) {
    this.apiKey = config.apiKey?.trim();
    this.apiSecret = config.apiSecret?.trim();
    this.staticToken = config.accessToken?.trim();
    this.baseUrl = (config.baseUrl || 'https://api.groww.in/v1').replace(/\/+$/, '');
    this.apiVersion = config.apiVersion || '1.0';
    this.timeoutMs = config.timeoutMs ?? 10000;
    this.maxRetries = config.maxRetries ?? 3;

    this.logger = config.logger || ((level, msg, meta) => {
      const metaStr = meta ? ` | ${JSON.stringify(meta)}` : '';
      if (level === 'error') {
        console.error(`[GrowwApiClient] [ERROR] ${msg}${metaStr}`);
      } else if (level === 'warn') {
        console.warn(`[GrowwApiClient] [WARN] ${msg}${metaStr}`);
      } else {
        console.log(`[GrowwApiClient] [INFO] ${msg}${metaStr}`);
      }
    });

    if (this.staticToken) {
      this.cachedToken = {
        token: this.staticToken,
        expiresAt: getNextGrowwDailyExpiry().getTime(),
        source: 'STATIC_OVERRIDE',
      };
    }
  }

  /**
   * Update credentials at runtime (e.g. from environment or settings)
   */
  public setCredentials(credentials: { apiKey?: string; apiSecret?: string; accessToken?: string }): void {
    if (credentials.apiKey !== undefined) this.apiKey = credentials.apiKey.trim();
    if (credentials.apiSecret !== undefined) this.apiSecret = credentials.apiSecret.trim();
    if (credentials.accessToken !== undefined) {
      this.staticToken = credentials.accessToken.trim();
      this.cachedToken = {
        token: this.staticToken,
        expiresAt: getNextGrowwDailyExpiry().getTime(),
        source: 'STATIC_OVERRIDE',
      };
    } else if (credentials.apiKey || credentials.apiSecret) {
      // Invalidate existing cached token if keys changed
      this.cachedToken = null;
    }
  }

  /**
   * Check if client has configuration to authenticate
   */
  public isConfigured(): boolean {
    const hasStaticToken = Boolean(this.staticToken && this.staticToken.length > 10);
    const hasKeyAndSecret = Boolean(
      this.apiKey && this.apiKey.length > 10 &&
      this.apiSecret && this.apiSecret.length > 5
    );
    return hasStaticToken || hasKeyAndSecret;
  }

  /**
   * Return token status without leaking token content
   */
  public getTokenStatus(): {
    configured: boolean;
    hasActiveToken: boolean;
    expiresInMinutes: number | null;
    expiresAtIST: string | null;
    authMethod: 'API_KEY_AND_SECRET' | 'STATIC_ACCESS_TOKEN' | 'NONE';
  } {
    let authMethod: 'API_KEY_AND_SECRET' | 'STATIC_ACCESS_TOKEN' | 'NONE' = 'NONE';
    if (this.apiKey && this.apiSecret) {
      authMethod = 'API_KEY_AND_SECRET';
    } else if (this.staticToken) {
      authMethod = 'STATIC_ACCESS_TOKEN';
    }

    if (!this.cachedToken) {
      return {
        configured: this.isConfigured(),
        hasActiveToken: false,
        expiresInMinutes: null,
        expiresAtIST: null,
        authMethod,
      };
    }

    const now = Date.now();
    const remainingMs = this.cachedToken.expiresAt - now;
    const remainingMin = Math.max(0, Math.floor(remainingMs / 60000));
    const expiresDate = new Date(this.cachedToken.expiresAt);

    return {
      configured: this.isConfigured(),
      hasActiveToken: remainingMs > 60_000,
      expiresInMinutes: remainingMin,
      expiresAtIST: expiresDate.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
      authMethod,
    };
  }

  /**
   * Acquire valid Groww access token with mutex and proactive expiry check
   */
  public async getAccessToken(): Promise<string> {
    const now = Date.now();

    // 1. Check if existing cached token is valid (keep 60s safety buffer)
    if (this.cachedToken && this.cachedToken.expiresAt - now > 60_000) {
      return this.cachedToken.token;
    }

    // 2. If static access token provided and valid, keep using it
    if (this.staticToken && !this.apiKey) {
      this.cachedToken = {
        token: this.staticToken,
        expiresAt: getNextGrowwDailyExpiry().getTime(),
        source: 'STATIC_OVERRIDE',
      };
      return this.staticToken;
    }

    // 3. Prevent parallel token generation requests via mutex
    if (this.authPromise) {
      const res = await this.authPromise;
      return res.token;
    }

    this.authPromise = (async () => {
      try {
        const tokenInfo = await this.authenticateWithApiKey();
        this.cachedToken = tokenInfo;
        return tokenInfo;
      } finally {
        this.authPromise = null;
      }
    })();

    const result = await this.authPromise;
    return result.token;
  }

  /**
   * Generate token using official API Key + Secret authentication flow:
   * POST /v1/token/api/access
   */
  public async authenticateWithApiKey(): Promise<GrowwTokenInfo> {
    if (!this.apiKey || !this.apiSecret) {
      if (this.staticToken) {
        return {
          token: this.staticToken,
          expiresAt: getNextGrowwDailyExpiry().getTime(),
          source: 'STATIC_OVERRIDE',
        };
      }
      throw new GrowwApiError(
        'Missing GROWW_API_KEY or GROWW_API_SECRET. Cannot generate Groww access token.',
        { code: 'CONFIG_MISSING', statusCode: 400 }
      );
    }

    // Rate limiting: max 5 req/s on Auth endpoint (min 200ms spacing)
    await this.throttleAuthRateLimit();

    const timestamp = Math.floor(Date.now() / 1000).toString();
    const checksum = generateChecksum(this.apiSecret, timestamp);

    const authUrl = `${this.baseUrl}/token/api/access`;
    const requestBody = {
      key_type: 'approval',
      checksum,
      timestamp,
    };

    this.logger('info', 'Generating Groww access token via official API Key + Secret flow', {
      keySnippet: sanitizeSecret(this.apiKey),
      timestamp,
    });

    const response = await this.executeFetchWithTimeout(
      authUrl,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(requestBody),
      },
      this.timeoutMs
    );

    if (!response.ok) {
      const errorText = await response.text();
      let parsedError: any = null;
      try {
        parsedError = JSON.parse(errorText);
      } catch {
        // keep text
      }

      const growwCode = parsedError?.error?.code;
      const growwMessage = parsedError?.error?.message || errorText;

      this.logger('error', `Authentication failed (${response.status})`, {
        code: growwCode,
        message: growwMessage,
      });

      // Special handling for approval requirement (GA005 or 401/403)
      if (response.status === 401 || response.status === 403 || growwCode === 'GA005') {
        throw new GrowwApiError(
          `Groww Authentication Failed (HTTP ${response.status} / ${growwCode || 'UNAUTHORIZED'}): ${growwMessage}. NOTE: API Key + Secret authentication requires daily manual approval on the Groww Cloud API Keys dashboard (https://groww.in/trade-api/api-keys).`,
          { code: growwCode || 'GA005', statusCode: response.status, endpoint: '/token/api/access' }
        );
      }

      throw new GrowwApiError(
        `Groww Token Generation Error (${response.status}): ${growwMessage}`,
        { code: growwCode, statusCode: response.status, endpoint: '/token/api/access' }
      );
    }

    const data = await response.json();
    if (data.status !== 'SUCCESS') {
      const errCode = data.error?.code || 'AUTH_FAILURE';
      const errMsg = data.error?.message || 'Token generation failed';
      throw new GrowwApiError(`Groww Auth Failure: ${errMsg}`, {
        code: errCode,
        statusCode: 400,
        endpoint: '/token/api/access',
      });
    }

    // Extract access token from response
    const token = typeof data.payload === 'string'
      ? data.payload
      : (data.payload?.token || data.payload?.access_token);

    if (!token || typeof token !== 'string') {
      throw new GrowwApiError('Malformed auth response: token missing from payload', {
        code: 'MALFORMED_RESPONSE',
        statusCode: 502,
        endpoint: '/token/api/access',
      });
    }

    const expiryDate = getNextGrowwDailyExpiry();
    this.logger('info', 'Groww access token generated successfully', {
      expiresAtIST: expiryDate.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
    });

    return {
      token,
      expiresAt: expiryDate.getTime(),
      source: 'APPROVAL_FLOW',
    };
  }

  /**
   * Standard authenticated request wrapper with rate-limit handling, retries, and backoff
   */
  public async request<T = any>(
    path: string,
    options: RequestInit = {},
    customTimeoutMs?: number
  ): Promise<T> {
    const fullUrl = path.startsWith('http') ? path : `${this.baseUrl}${path.startsWith('/') ? '' : '/'}${path}`;
    const timeout = customTimeoutMs ?? this.timeoutMs;

    let attempt = 0;
    while (attempt <= this.maxRetries) {
      attempt++;

      // Enforce rate limit (10 req/s for market data -> min 100ms)
      await this.throttleLiveRateLimit();

      const accessToken = await this.getAccessToken();

      const headers: Record<string, string> = {
        'Authorization': `Bearer ${accessToken}`,
        'X-API-VERSION': this.apiVersion,
        'Accept': 'application/json',
        ...(options.headers as Record<string, string> || {}),
      };

      try {
        const response = await this.executeFetchWithTimeout(
          fullUrl,
          { ...options, headers },
          timeout
        );

        // 1. Success response
        if (response.ok) {
          const resJson = await response.json();
          if (resJson.status === 'FAILURE') {
            const errCode = resJson.error?.code;
            const errMsg = resJson.error?.message || 'API returned FAILURE status';
            throw new GrowwApiError(`Groww API Failure [${errCode}]: ${errMsg}`, {
              code: errCode,
              statusCode: 400,
              endpoint: path,
            });
          }
          return resJson.payload !== undefined ? resJson.payload : resJson;
        }

        // 2. Token Expired / Unauthorized (401 or 403)
        if (response.status === 401 || response.status === 403) {
          this.logger('warn', `Received HTTP ${response.status}. Invalidating cached token.`, { path });
          this.cachedToken = null; // Clear cached token

          // If we have API Key + Secret, retry once with a freshly generated token
          if (attempt === 1 && this.apiKey && this.apiSecret) {
            this.logger('info', 'Attempting immediate token renewal after 401/403');
            continue;
          }

          const errText = await response.text();
          throw new GrowwApiError(
            `Groww Authentication Expired (HTTP ${response.status}): ${errText}. Daily approval may be needed at https://groww.in/trade-api/api-keys`,
            { code: 'GA005', statusCode: response.status, endpoint: path }
          );
        }

        // 3. Rate Limited (HTTP 429) -> Exponential backoff with retry
        if (response.status === 429) {
          if (attempt > this.maxRetries) {
            throw new GrowwApiError(`Groww API Rate Limit Exceeded (HTTP 429) after ${attempt} attempts`, {
              code: 'RATE_LIMIT_EXCEEDED',
              statusCode: 429,
              endpoint: path,
            });
          }

          const retryAfterHeader = response.headers.get('Retry-After');
          const waitMs = retryAfterHeader
            ? parseInt(retryAfterHeader, 10) * 1000
            : Math.min(10000, 1000 * Math.pow(2, attempt) + Math.random() * 200);

          this.logger('warn', `Rate limited (HTTP 429). Backing off for ${waitMs}ms before retry ${attempt}/${this.maxRetries}`, { path });
          await new Promise((resolve) => setTimeout(resolve, waitMs));
          continue;
        }

        // 4. Server Errors (500, 502, 503, 504) -> Exponential backoff
        if (response.status >= 500) {
          if (attempt > this.maxRetries) {
            const errText = await response.text();
            throw new GrowwApiError(`Groww Server Error (${response.status}): ${errText}`, {
              statusCode: response.status,
              endpoint: path,
            });
          }

          const backoffMs = Math.min(5000, 500 * Math.pow(2, attempt) + Math.random() * 100);
          this.logger('warn', `Server error (${response.status}). Retrying in ${backoffMs}ms (attempt ${attempt}/${this.maxRetries})`, { path });
          await new Promise((resolve) => setTimeout(resolve, backoffMs));
          continue;
        }

        // 5. Client errors (400, 404, etc.) -> Fail fast without retrying
        const clientErrText = await response.text();
        throw new GrowwApiError(`Groww Request Error (${response.status}): ${clientErrText}`, {
          statusCode: response.status,
          endpoint: path,
        });
      } catch (err: any) {
        if (err instanceof GrowwApiError) {
          throw err;
        }

        // Network / Timeout errors -> retry if attempts remaining
        const isTimeout = err.name === 'AbortError' || err.message?.includes('timeout');
        if (attempt <= this.maxRetries) {
          const backoffMs = 500 * Math.pow(2, attempt);
          this.logger('warn', `Network/timeout error: ${err.message}. Retrying in ${backoffMs}ms`, { path, attempt });
          await new Promise((resolve) => setTimeout(resolve, backoffMs));
          continue;
        }

        throw new GrowwApiError(
          isTimeout ? `Groww request timed out after ${timeout}ms` : `Network error connecting to Groww: ${err.message}`,
          { code: isTimeout ? 'TIMEOUT' : 'NETWORK_ERROR', endpoint: path }
        );
      }
    }

    throw new GrowwApiError(`Failed request after ${this.maxRetries} retries`, { endpoint: path });
  }

  // ==========================================
  // MARKET DATA ENDPOINTS (OFFICIAL SPEC)
  // ==========================================

  /**
   * Get Live Quote snapshot for an instrument
   * GET /v1/live-data/quote?exchange=NSE&segment=CASH&trading_symbol=NIFTY
   */
  public async getLiveQuote(
    tradingSymbol: 'NIFTY' | 'BANKNIFTY' | string,
    exchange: 'NSE' | 'BSE' = 'NSE',
    segment: 'CASH' | 'FNO' = 'CASH'
  ): Promise<LiveQuote> {
    const url = `/live-data/quote?exchange=${encodeURIComponent(exchange)}&segment=${encodeURIComponent(segment)}&trading_symbol=${encodeURIComponent(tradingSymbol)}`;
    const payload = await this.request<any>(url);

    if (!payload) {
      throw new GrowwApiError(`Quote payload missing for ${tradingSymbol}`, { code: 'NO_DATA', endpoint: url });
    }

    // Parse ohlc field (can be object or string format "{open: ..., high: ...}")
    let o = 0, h = 0, l = 0, c = 0;
    if (typeof payload.ohlc === 'object' && payload.ohlc !== null) {
      o = Number(payload.ohlc.open || 0);
      h = Number(payload.ohlc.high || 0);
      l = Number(payload.ohlc.low || 0);
      c = Number(payload.ohlc.close || 0);
    } else if (typeof payload.ohlc === 'string') {
      try {
        const cleaned = payload.ohlc.replace(/([a-zA-Z0-9_]+):/g, '"$1":');
        const parsed = JSON.parse(cleaned);
        o = Number(parsed.open || 0);
        h = Number(parsed.high || 0);
        l = Number(parsed.low || 0);
        c = Number(parsed.close || 0);
      } catch {
        o = Number(payload.open || payload.last_price || 0);
        h = Number(payload.high || payload.high_trade_range || payload.last_price || 0);
        l = Number(payload.low || payload.low_trade_range || payload.last_price || 0);
        c = Number(payload.close || payload.last_price || 0);
      }
    } else {
      o = Number(payload.open || payload.last_price || 0);
      h = Number(payload.high || payload.high_trade_range || payload.last_price || 0);
      l = Number(payload.low || payload.low_trade_range || payload.last_price || 0);
      c = Number(payload.close || payload.last_price || 0);
    }

    return {
      symbol: tradingSymbol,
      exchange,
      segment,
      lastPrice: Number(payload.last_price || 0),
      dayChange: Number(payload.day_change || 0),
      dayChangePerc: Number(payload.day_change_perc || 0),
      open: o,
      high: h,
      low: l,
      close: c,
      volume: Number(payload.volume || payload.total_volume || 0),
      openInterest: payload.open_interest !== undefined ? Number(payload.open_interest) : undefined,
      timestamp: Number(payload.last_trade_time || Date.now()),
    };
  }

  /**
   * Get Last Traded Price (LTP) for up to 50 instruments
   * GET /v1/live-data/ltp?segment=CASH&exchange_symbols=NSE_NIFTY,NSE_BANKNIFTY
   */
  public async getLTP(
    exchangeSymbols: string[],
    segment: 'CASH' | 'FNO' = 'CASH'
  ): Promise<Record<string, number>> {
    if (!exchangeSymbols || exchangeSymbols.length === 0) return {};
    const symbolsParam = exchangeSymbols.join(',');
    const url = `/live-data/ltp?segment=${encodeURIComponent(segment)}&exchange_symbols=${encodeURIComponent(symbolsParam)}`;
    const payload = await this.request<Record<string, number>>(url);
    return payload || {};
  }

  /**
   * Get Live OHLC snapshot for up to 50 instruments
   * GET /v1/live-data/ohlc?segment=CASH&exchange_symbols=NSE_NIFTY,NSE_BANKNIFTY
   */
  public async getOHLC(
    exchangeSymbols: string[],
    segment: 'CASH' | 'FNO' = 'CASH'
  ): Promise<Record<string, { open: number; high: number; low: number; close: number }>> {
    if (!exchangeSymbols || exchangeSymbols.length === 0) return {};
    const symbolsParam = exchangeSymbols.join(',');
    const url = `/live-data/ohlc?segment=${encodeURIComponent(segment)}&exchange_symbols=${encodeURIComponent(symbolsParam)}`;
    const payload = await this.request<Record<string, any>>(url);
    if (!payload) return {};

    const result: Record<string, { open: number; high: number; low: number; close: number }> = {};
    for (const [sym, val] of Object.entries(payload)) {
      if (typeof val === 'object' && val !== null) {
        result[sym] = {
          open: Number(val.open || 0),
          high: Number(val.high || 0),
          low: Number(val.low || 0),
          close: Number(val.close || 0),
        };
      } else if (typeof val === 'string') {
        try {
          const cleaned = val.replace(/([a-zA-Z0-9_]+):/g, '"$1":');
          const parsed = JSON.parse(cleaned);
          result[sym] = {
            open: Number(parsed.open || 0),
            high: Number(parsed.high || 0),
            low: Number(parsed.low || 0),
            close: Number(parsed.close || 0),
          };
        } catch {
          // ignore malformed
        }
      }
    }
    return result;
  }

  /**
   * Get Option Chain with Greeks for FNO contracts
   * GET /v1/option-chain/exchange/{exchange}/underlying/{underlying}?expiry_date={expiry_date}
   */
  public async getOptionChain(
    underlying: 'NIFTY' | 'BANKNIFTY' | string,
    expiryDate: string, // YYYY-MM-DD
    exchange: 'NSE' | 'BSE' = 'NSE'
  ): Promise<OptionChainResponse> {
    const url = `/option-chain/exchange/${encodeURIComponent(exchange)}/underlying/${encodeURIComponent(underlying)}?expiry_date=${encodeURIComponent(expiryDate)}`;
    const payload = await this.request<any>(url);

    if (!payload) {
      throw new GrowwApiError(`Option chain missing for ${underlying} (${expiryDate})`, {
        code: 'NO_DATA',
        endpoint: url,
      });
    }

    const strikesMap: Record<string, { CE?: OptionContractData; PE?: OptionContractData }> = {};

    if (payload.strikes && typeof payload.strikes === 'object') {
      for (const [strikeKey, strikeData] of Object.entries(payload.strikes as Record<string, any>)) {
        strikesMap[strikeKey] = {};

        if (strikeData.CE) {
          strikesMap[strikeKey].CE = {
            tradingSymbol: strikeData.CE.trading_symbol || strikeData.CE.tradingSymbol || '',
            ltp: Number(strikeData.CE.ltp || 0),
            openInterest: Number(strikeData.CE.open_interest || strikeData.CE.openInterest || 0),
            volume: Number(strikeData.CE.volume || 0),
            greeks: strikeData.CE.greeks ? {
              delta: Number(strikeData.CE.greeks.delta || 0),
              gamma: Number(strikeData.CE.greeks.gamma || 0),
              theta: Number(strikeData.CE.greeks.theta || 0),
              vega: Number(strikeData.CE.greeks.vega || 0),
              rho: Number(strikeData.CE.greeks.rho || 0),
              iv: Number(strikeData.CE.greeks.iv || 0),
            } : undefined,
          };
        }

        if (strikeData.PE) {
          strikesMap[strikeKey].PE = {
            tradingSymbol: strikeData.PE.trading_symbol || strikeData.PE.tradingSymbol || '',
            ltp: Number(strikeData.PE.ltp || 0),
            openInterest: Number(strikeData.PE.open_interest || strikeData.PE.openInterest || 0),
            volume: Number(strikeData.PE.volume || 0),
            greeks: strikeData.PE.greeks ? {
              delta: Number(strikeData.PE.greeks.delta || 0),
              gamma: Number(strikeData.PE.greeks.gamma || 0),
              theta: Number(strikeData.PE.greeks.theta || 0),
              vega: Number(strikeData.PE.greeks.vega || 0),
              rho: Number(strikeData.PE.greeks.rho || 0),
              iv: Number(strikeData.PE.greeks.iv || 0),
            } : undefined,
          };
        }
      }
    }

    return {
      underlyingLtp: Number(payload.underlying_ltp || 0),
      underlyingSymbol: underlying,
      expiryDate,
      strikes: strikesMap,
    };
  }

  /**
   * Get Option Greeks for a specific contract
   * GET /v1/live-data/greeks/exchange/{exchange}/underlying/{underlying}/trading_symbol/{trading_symbol}/expiry/{expiry}
   */
  public async getOptionGreeks(
    underlying: string,
    tradingSymbol: string,
    expiry: string, // YYYY-MM-DD
    exchange: 'NSE' | 'BSE' = 'NSE'
  ): Promise<OptionGreeks | null> {
    const url = `/live-data/greeks/exchange/${encodeURIComponent(exchange)}/underlying/${encodeURIComponent(underlying)}/trading_symbol/${encodeURIComponent(tradingSymbol)}/expiry/${encodeURIComponent(expiry)}`;
    const payload = await this.request<any>(url);

    if (!payload || !payload.greeks) return null;
    const g = payload.greeks;
    return {
      delta: Number(g.delta || 0),
      gamma: Number(g.gamma || 0),
      theta: Number(g.theta || 0),
      vega: Number(g.vega || 0),
      rho: Number(g.rho || 0),
      iv: Number(g.iv || 0),
    };
  }

  /**
   * Fetch 5-minute historical candle data.
   * STRICT REQUIREMENT: Evaluated strictly on CLOSED candles (timestamp + 300s <= now).
   * Supports both modern backtesting endpoint (/v1/historical/candles)
   * and standard endpoint (/v1/historical/candle/range) with fallback.
   */
  public async get5mCandles(
    tradingSymbol: 'NIFTY' | 'BANKNIFTY' | string,
    startTime: string,
    endTime: string,
    options?: {
      exchange?: 'NSE' | 'BSE';
      segment?: 'CASH' | 'FNO';
      growwSymbol?: string;
      onlyClosed?: boolean;
    }
  ): Promise<MarketCandle[]> {
    const exchange = options?.exchange || 'NSE';
    const segment = options?.segment || 'CASH';
    const onlyClosed = options?.onlyClosed ?? true;

    // Derived Groww symbol format: NSE-NIFTY, NSE-BANKNIFTY
    const growwSymbol = options?.growwSymbol || `${exchange}-${tradingSymbol}`;

    // 1. Try modern backtesting historical endpoint first
    try {
      const modernUrl = `/historical/candles?exchange=${encodeURIComponent(exchange)}&segment=${encodeURIComponent(segment)}&groww_symbol=${encodeURIComponent(growwSymbol)}&start_time=${encodeURIComponent(startTime)}&end_time=${encodeURIComponent(endTime)}&candle_interval=5minute`;
      const payload = await this.request<any>(modernUrl);
      if (payload && Array.isArray(payload.candles) && payload.candles.length > 0) {
        return this.parseAndFilterCandles(payload.candles, onlyClosed);
      }
    } catch (err: any) {
      // If endpoint not supported, fall through to fallback range endpoint
      this.logger('info', `Historical candles modern endpoint fallback: ${err.message}`);
    }

    // 2. Fallback to range endpoint
    const rangeUrl = `/historical/candle/range?exchange=${encodeURIComponent(exchange)}&segment=${encodeURIComponent(segment)}&trading_symbol=${encodeURIComponent(tradingSymbol)}&start_time=${encodeURIComponent(startTime)}&end_time=${encodeURIComponent(endTime)}&interval_in_minutes=5`;
    const rangePayload = await this.request<any>(rangeUrl);
    if (!rangePayload || !Array.isArray(rangePayload.candles)) {
      return [];
    }

    return this.parseAndFilterCandles(rangePayload.candles, onlyClosed);
  }

  /**
   * Parse candles and strictly filter closed candles
   * Formats supported:
   * [epochSec, open, high, low, close, volume, oi?]
   * ["2025-09-24T10:30:00", open, high, low, close, volume, oi?]
   */
  private parseAndFilterCandles(rawCandles: any[], onlyClosed: boolean): MarketCandle[] {
    const nowEpoch = Math.floor(Date.now() / 1000);

    const parsed: MarketCandle[] = [];

    for (const c of rawCandles) {
      if (!Array.isArray(c) || c.length < 5) continue;

      let candleEpoch = 0;
      let datetimeStr = '';

      if (typeof c[0] === 'number') {
        candleEpoch = c[0];
        datetimeStr = new Date(candleEpoch * 1000).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
      } else if (typeof c[0] === 'string') {
        const parsedDate = new Date(c[0]);
        candleEpoch = Math.floor(parsedDate.getTime() / 1000);
        datetimeStr = parsedDate.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
      } else {
        continue;
      }

      // 5-minute candle closes after 300 seconds
      const isClosed = candleEpoch + 300 <= nowEpoch;

      if (onlyClosed && !isClosed) {
        // Skip unclosed candle to prevent repainting / premature signals
        continue;
      }

      parsed.push({
        timestamp: candleEpoch,
        datetime: datetimeStr,
        open: Number(c[1] || 0),
        high: Number(c[2] || 0),
        low: Number(c[3] || 0),
        close: Number(c[4] || 0),
        volume: Number(c[5] || 0),
        openInterest: c[6] !== undefined && c[6] !== null ? Number(c[6]) : null,
        isClosed,
      });
    }

    return parsed;
  }

  /**
   * Internal timeout wrapper around standard fetch
   */
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

  /**
   * Throttle Auth endpoint to 5 requests per second (min 200ms spacing)
   */
  private async throttleAuthRateLimit(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastAuthRequestTime;
    if (elapsed < 200) {
      await new Promise((r) => setTimeout(r, 200 - elapsed));
    }
    this.lastAuthRequestTime = Date.now();
  }

  /**
   * Throttle Live Data endpoints to 10 requests per second (min 100ms spacing)
   */
  private async throttleLiveRateLimit(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastLiveRequestTime;
    if (elapsed < 100) {
      await new Promise((r) => setTimeout(r, 100 - elapsed));
    }
    this.lastLiveRequestTime = Date.now();
  }
}
