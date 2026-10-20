import { type MarketCandle, type LiveQuote, growwService } from './growwService';

export interface MarketDataProvider {
  name: string;
  isReady(): boolean;
  get5mClosedCandles(symbol: 'NIFTY' | 'BANKNIFTY', startTime: string, endTime: string): Promise<MarketCandle[]>;
  getQuote(symbol: 'NIFTY' | 'BANKNIFTY' | string): Promise<LiveQuote>;
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

export const activeMarketDataProvider: MarketDataProvider = new GrowwMarketDataProvider();
