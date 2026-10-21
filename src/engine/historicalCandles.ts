/**
 * Historical Market Candles Generator (5-Minute Closed Candles)
 * Generates realistic multi-session historical datasets for NIFTY 50 & BANK NIFTY
 * covering multiple market regimes: Trending Bull, Trending Bear, Sideways Range, and Expiry Volatility.
 */

import type { MarketCandle } from '../services/growwService';

export interface HistoricalSession {
  sessionDate: string;
  regime: 'TRENDING_BULL' | 'TRENDING_BEAR' | 'SIDEWAYS_RANGE' | 'EXPIRY_VOLATILE';
  description: string;
  candles: MarketCandle[];
}

export class HistoricalDataService {
  /**
   * Generates a 375+ candle historical dataset (5 consecutive trading sessions)
   * with authentic price action: ORB, VWAP bounces, Donchian breakouts, FVG imbalances,
   * Fibonacci retracements, and afternoon expiry expansion.
   */
  public static getHistoricalCandles(instrument: 'NIFTY 50' | 'BANK NIFTY'): MarketCandle[] {
    const basePrice = instrument === 'NIFTY 50' ? 24500 : 52000;
    const tickMultiplier = instrument === 'NIFTY 50' ? 1.0 : 2.4;
    const allCandles: MarketCandle[] = [];

    // Base date: 5 trading days ago starting at 09:15 IST
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);
    startDate.setHours(9, 15, 0, 0);

    let currentPrice = basePrice;
    let baseTime = Math.floor(startDate.getTime() / 1000);

    // 5 Sessions, 75 candles per 5m session (09:15 to 15:30 IST)
    const sessionsConfig = [
      // Day 1: Opening Range Breakout (Bullish Trend Day)
      { trendStep: 2.2 * tickMultiplier, volBase: 12000, noise: 4 * tickMultiplier },
      // Day 2: Sideways Range & Mean Reversion (Double Top / Liquidity Sweeps)
      { trendStep: 0.1 * tickMultiplier, volBase: 6500, noise: 8 * tickMultiplier, isRange: true },
      // Day 3: Gap Down & Heavy EMA Breakdown (Bearish Trend Day)
      { trendStep: -2.4 * tickMultiplier, volBase: 14000, noise: 5 * tickMultiplier, gap: -90 * tickMultiplier },
      // Day 4: Golden Pocket & Double Bottom Reversal Day (V-Shape Recovery)
      { trendStep: 1.8 * tickMultiplier, volBase: 9500, noise: 6 * tickMultiplier, isReversal: true },
      // Day 5: Expiry Day Afternoon Gamma Surge (13:00 - 15:15 IST)
      { trendStep: 1.2 * tickMultiplier, volBase: 16000, noise: 7 * tickMultiplier, isExpiry: true },
    ];

    sessionsConfig.forEach((cfg, sIdx) => {
      // Day Open gap
      if (cfg.gap) {
        currentPrice += cfg.gap;
      } else if (sIdx > 0) {
        currentPrice += (Math.sin(sIdx * 2) * 15 * tickMultiplier);
      }

      const dayOpen = currentPrice;

      for (let bar = 0; bar < 75; bar++) {
        const time = baseTime + (sIdx * 86400) + (bar * 300);
        let delta = cfg.trendStep;

        if (cfg.isRange) {
          // Oscillate between support and resistance
          delta = Math.sin(bar / 4) * 12 * tickMultiplier;
        } else if (cfg.isReversal) {
          // Morning dip to Golden pocket, afternoon rally
          delta = bar < 25 ? -1.5 * tickMultiplier : 2.5 * tickMultiplier;
        } else if (cfg.isExpiry && bar >= 45) {
          // Afternoon delta expansion surge
          delta = 3.5 * tickMultiplier;
        }

        const open = currentPrice;
        const noise = (Math.sin(bar * 3.7) + Math.cos(bar * 1.3)) * (cfg.noise / 2);
        const close = open + delta + noise;
        const high = Math.max(open, close) + Math.abs(Math.sin(bar)) * (cfg.noise * 0.8);
        const low = Math.min(open, close) - Math.abs(Math.cos(bar)) * (cfg.noise * 0.8);

        // Volume expansion on breakout / expiry
        const volMultiplier = (bar < 6 || (cfg.isExpiry && bar >= 45) || Math.abs(delta) > 3) ? 1.8 : 1.0;
        const volume = Math.floor((cfg.volBase + Math.random() * 4000) * volMultiplier);

        currentPrice = close;

        allCandles.push({
          timestamp: time,
          datetime: new Date(time * 1000).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
          open: Number(open.toFixed(2)),
          high: Number(high.toFixed(2)),
          low: Number(low.toFixed(2)),
          close: Number(close.toFixed(2)),
          volume,
          isClosed: true,
        });
      }
    });

    return allCandles;
  }
}
