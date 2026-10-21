import { type MarketCandle, type LiveQuote, growwService } from './growwService';
import { angelOneClient, AngelOneApiClient } from './angelOneApiClient';

export interface MarketDataProvider {
  name: string;
  isReady(): boolean;
  get5mClosedCandles(symbol: 'NIFTY' | 'BANKNIFTY', startTime: string, endTime: string): Promise<MarketCandle[]>;
  getQuote(symbol: 'NIFTY' | 'BANKNIFTY' | string): Promise<LiveQuote>;
}

export class AngelOneMarketDataProvider implements MarketDataProvider {
  public name = 'Angel One SmartAPI';

  constructor(private client: AngelOneApiClient = angelOneClient) {}

  public isReady(): boolean {
    return this.client.isConfigured();
  }

  public async get5mClosedCandles(
    symbol: 'NIFTY' | 'BANKNIFTY',
    startTime: string,
    endTime: string
  ): Promise<MarketCandle[]> {
    return this.client.get5mClosedCandles(symbol, startTime, endTime);
  }

  public async getQuote(symbol: 'NIFTY' | 'BANKNIFTY' | string): Promise<LiveQuote> {
    return this.client.getLiveQuote(symbol);
  }
}

export class GrowwMarketDataProvider implements MarketDataProvider {
  public name = 'Groww Trade API';

  public isReady(): boolean {
    return growwService.isConfigured();
  }

  public async get5mClosedCandles(
    symbol: 'NIFTY' | 'BANKNIFTY',
    startTime: string,
    endTime: string
  ): Promise<MarketCandle[]> {
    return growwService.get5mCandles(symbol, startTime, endTime);
  }

  public async getQuote(symbol: 'NIFTY' | 'BANKNIFTY' | string): Promise<LiveQuote> {
    return growwService.getLiveQuote(symbol);
  }
}

/**
 * Adaptive Market Data Provider:
 * Automatically uses Angel One SmartAPI if configured,
 * otherwise falls back to Groww Trade API if configured.
 */
export class AdaptiveMarketDataProvider implements MarketDataProvider {
  private angelOne = new AngelOneMarketDataProvider();
  private groww = new GrowwMarketDataProvider();

  public get name(): string {
    if (this.angelOne.isReady()) {
      return this.angelOne.name;
    }
    if (this.groww.isReady()) {
      return this.groww.name;
    }
    return 'Angel One (Awaiting Credentials)';
  }

  public isReady(): boolean {
    return this.angelOne.isReady() || this.groww.isReady();
  }

  public async get5mClosedCandles(
    symbol: 'NIFTY' | 'BANKNIFTY',
    startTime: string,
    endTime: string
  ): Promise<MarketCandle[]> {
    if (this.angelOne.isReady()) {
      try {
        return await this.angelOne.get5mClosedCandles(symbol, startTime, endTime);
      } catch (err) {
        if (this.groww.isReady()) {
          return await this.groww.get5mClosedCandles(symbol, startTime, endTime);
        }
        throw err;
      }
    }

    if (this.groww.isReady()) {
      return await this.groww.get5mClosedCandles(symbol, startTime, endTime);
    }

    throw new Error('NO_BROKER_CONFIGURED: Neither Angel One nor Groww credentials configured');
  }

  public async getQuote(symbol: 'NIFTY' | 'BANKNIFTY' | string): Promise<LiveQuote> {
    if (this.angelOne.isReady()) {
      try {
        return await this.angelOne.getQuote(symbol);
      } catch (err) {
        if (this.groww.isReady()) {
          return await this.groww.getQuote(symbol);
        }
        throw err;
      }
    }

    if (this.groww.isReady()) {
      return await this.groww.getQuote(symbol);
    }

    throw new Error('NO_BROKER_CONFIGURED: Neither Angel One nor Groww credentials configured');
  }
}

export const activeMarketDataProvider: MarketDataProvider = new AdaptiveMarketDataProvider();
