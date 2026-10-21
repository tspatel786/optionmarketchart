/**
 * Groww Service Facade
 * Delegates to the official typed GrowwApiClient.
 * Preserves compatibility across existing signal engines, components, and tests.
 */

import {
  GrowwApiClient,
  GrowwApiError,
  type MarketCandle,
  type LiveQuote,
  type OptionChainResponse,
  type OptionGreeks,
  type OptionContractData,
  type GrowwTokenInfo,
  generateChecksum,
  getNextGrowwDailyExpiry,
  sanitizeSecret,
} from './growwApiClient';

export {
  GrowwApiClient,
  GrowwApiError,
  type MarketCandle,
  type LiveQuote,
  type OptionChainResponse,
  type OptionGreeks,
  type OptionContractData,
  type GrowwTokenInfo,
  generateChecksum,
  getNextGrowwDailyExpiry,
  sanitizeSecret,
};

export class GrowwApiService {
  private client: GrowwApiClient;

  constructor(tokenOrClient?: string | GrowwApiClient) {
    if (tokenOrClient instanceof GrowwApiClient) {
      this.client = tokenOrClient;
    } else {
      this.client = new GrowwApiClient({
        accessToken: typeof tokenOrClient === 'string' ? tokenOrClient : undefined,
      });
    }
  }

  public getClient(): GrowwApiClient {
    return this.client;
  }

  public setAccessToken(token: string): void {
    this.client.setCredentials({ accessToken: token });
  }

  public setCredentials(credentials: { apiKey?: string; apiSecret?: string; accessToken?: string }): void {
    this.client.setCredentials(credentials);
  }

  public isConfigured(): boolean {
    return this.client.isConfigured();
  }

  public getTokenStatus() {
    return this.client.getTokenStatus();
  }

  public async getAccessToken(): Promise<string> {
    return this.client.getAccessToken();
  }

  /**
   * Fetch 5-minute historical candles from Groww API
   * Evaluated strictly on CLOSED candles (timestamp + 300s <= now)
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
    return this.client.get5mCandles(tradingSymbol, startTime, endTime, options);
  }

  /**
   * Fetch Live Quote & OHLC snapshot for an instrument
   */
  public async getLiveQuote(
    tradingSymbol: 'NIFTY' | 'BANKNIFTY' | string,
    exchange: 'NSE' | 'BSE' = 'NSE',
    segment: 'CASH' | 'FNO' = 'CASH'
  ): Promise<LiveQuote> {
    return this.client.getLiveQuote(tradingSymbol, exchange, segment);
  }

  /**
   * Fetch Option Chain with Greeks
   */
  public async getOptionChain(
    underlying: 'NIFTY' | 'BANKNIFTY' | string,
    expiryDate: string,
    exchange: 'NSE' | 'BSE' = 'NSE'
  ): Promise<OptionChainResponse> {
    return this.client.getOptionChain(underlying, expiryDate, exchange);
  }
}

export const growwService = new GrowwApiService();
