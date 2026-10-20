/**
 * Groww Trade API Client
 * Official Endpoint: https://api.groww.in/v1
 * Interval: strictly 5-minute (5m) closed candles
 */

export interface MarketCandle {
  timestamp: number; // Unix timestamp in seconds
  datetime: string;  // ISO / IST string
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  isClosed: boolean;
}

export interface LiveQuote {
  symbol: string;
  exchange: 'NSE' | 'BSE';
  lastPrice: number;
  dayChange: number;
  dayChangePerc: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  timestamp: number;
}

export class GrowwApiService {
  private baseUrl = 'https://api.groww.in/v1';
  private apiVersion = '1.0';
  private accessToken: string | null = null;

  constructor(token?: string) {
    if (token) {
      this.accessToken = token;
    }
  }

  public setAccessToken(token: string): void {
    this.accessToken = token.trim();
  }

  public isConfigured(): boolean {
    return Boolean(this.accessToken && this.accessToken.length > 10);
  }

  private getHeaders(): HeadersInit {
    if (!this.accessToken) {
      throw new Error('Groww Access Token is not set. Please provide a valid Bearer token.');
    }
    return {
      'Authorization': `Bearer ${this.accessToken}`,
      'X-API-VERSION': this.apiVersion,
      'Accept': 'application/json',
    };
  }

  /**
   * Fetch 5-minute historical candles from Groww API
   * Evaluated strictly on CLOSED candles (timestamp + 300s <= now)
   */
  public async get5mCandles(
    tradingSymbol: 'NIFTY' | 'BANKNIFTY' | string,
    startTime: string,
    endTime: string
  ): Promise<MarketCandle[]> {
    if (!this.isConfigured()) {
      throw new Error('GROWW_NOT_CONFIGURED: Missing access token');
    }

    const url = new URL(`${this.baseUrl}/historical/candle/range`);
    url.searchParams.append('exchange', 'NSE');
    url.searchParams.append('segment', 'CASH');
    url.searchParams.append('trading_symbol', tradingSymbol);
    url.searchParams.append('start_time', startTime);
    url.searchParams.append('end_time', endTime);
    url.searchParams.append('interval_in_minutes', '5');

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Groww API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    if (data.status !== 'SUCCESS' || !data.payload?.candles) {
      return [];
    }

    const nowEpoch = Math.floor(Date.now() / 1000);
    const rawCandles: any[] = data.payload.candles;

    // Groww candle format: [timestamp, open, high, low, close, volume]
    return rawCandles
      .map((c) => {
        const candleTime = Number(c[0]);
        // A 5m candle is closed if at least 5 minutes (300 seconds) have elapsed since its start
        const isClosed = candleTime + 300 <= nowEpoch;
        return {
          timestamp: candleTime,
          datetime: new Date(candleTime * 1000).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
          open: Number(c[1]),
          high: Number(c[2]),
          low: Number(c[3]),
          close: Number(c[4]),
          volume: Number(c[5] || 0),
          isClosed,
        };
      })
      .filter((candle) => candle.isClosed); // STRICT REQUIREMENT: Only closed candles, no repainting
  }

  /**
   * Fetch Live Quote & OHLC snapshot for an instrument
   */
  public async getLiveQuote(tradingSymbol: 'NIFTY' | 'BANKNIFTY' | string): Promise<LiveQuote> {
    if (!this.isConfigured()) {
      throw new Error('GROWW_NOT_CONFIGURED: Missing access token');
    }

    const url = new URL(`${this.baseUrl}/live-data/quote`);
    url.searchParams.append('exchange', 'NSE');
    url.searchParams.append('segment', 'CASH');
    url.searchParams.append('trading_symbol', tradingSymbol);

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Groww API error (${response.status}): ${errorText}`);
    }

    const resJson = await response.json();
    if (resJson.status !== 'SUCCESS' || !resJson.payload) {
      throw new Error('Groww quote data unavailable');
    }

    const p = resJson.payload;
    // Parse ohlc field if provided as string or object
    let o = 0, h = 0, l = 0, c = 0;
    if (typeof p.ohlc === 'object' && p.ohlc !== null) {
      o = Number(p.ohlc.open);
      h = Number(p.ohlc.high);
      l = Number(p.ohlc.low);
      c = Number(p.ohlc.close);
    } else if (typeof p.ohlc === 'string') {
      try {
        const cleaned = p.ohlc.replace(/([a-zA-Z0-9_]+):/g, '"$1":');
        const parsed = JSON.parse(cleaned);
        o = Number(parsed.open);
        h = Number(parsed.high);
        l = Number(parsed.low);
        c = Number(parsed.close);
      } catch {
        // Fallback to high_trade_range / low_trade_range / last_price
        o = Number(p.last_price || 0);
        h = Number(p.high_trade_range || p.last_price || 0);
        l = Number(p.low_trade_range || p.last_price || 0);
        c = Number(p.last_price || 0);
      }
    }

    return {
      symbol: tradingSymbol,
      exchange: 'NSE',
      lastPrice: Number(p.last_price || 0),
      dayChange: Number(p.day_change || 0),
      dayChangePerc: Number(p.day_change_perc || 0),
      open: o,
      high: h,
      low: l,
      close: c,
      volume: Number(p.total_volume || 0),
      timestamp: Number(p.last_trade_time || Date.now()),
    };
  }
}

export const growwService = new GrowwApiService();
