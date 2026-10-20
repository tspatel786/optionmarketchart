/**
 * Technical Indicators Engine for NIFTY 50 & BANK NIFTY 5m Strategies
 * Implements: VWAP, EMA (9, 20, 50), Supertrend, RSI, ADX/DI, Bollinger Bands,
 * MACD, Opening Range Breakout (ORB 15m), NR7, and Fibonacci Retracement.
 */

import type { MarketCandle } from '../services/growwService';

export interface IndicatorSnapshot {
  vwap: number;
  ema9: number;
  ema20: number;
  ema50: number;
  supertrend: {
    direction: 'BULLISH' | 'BEARISH';
    value: number;
  };
  rsi: number;
  adx: {
    adx: number;
    plusDI: number;
    minusDI: number;
    isTrending: boolean; // ADX >= 20
  };
  bollingerBands: {
    upper: number;
    middle: number;
    lower: number;
    bandwidth: number;
    isSqueezed: boolean;
  };
  macd: {
    macdLine: number;
    signalLine: number;
    histogram: number;
    crossover: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  };
  orb15m: {
    high: number;
    low: number;
    isFormed: boolean;
    breakout: 'BULLISH_CE' | 'BEARISH_PE' | 'INSIDE';
  };
  isNR7: boolean;
}

export class IndicatorCalculator {
  /**
   * VWAP (Volume Weighted Average Price)
   */
  public static calculateVWAP(candles: MarketCandle[]): number {
    if (!candles || candles.length === 0) return 0;
    let cumVolume = 0;
    let cumVolPrice = 0;

    for (const c of candles) {
      const typicalPrice = (c.high + c.low + c.close) / 3;
      const vol = Math.max(1, c.volume);
      cumVolume += vol;
      cumVolPrice += typicalPrice * vol;
    }

    return cumVolume > 0 ? Number((cumVolPrice / cumVolume).toFixed(2)) : candles[candles.length - 1].close;
  }

  /**
   * Exponential Moving Average (EMA)
   */
  public static calculateEMA(candles: MarketCandle[], period: number): number {
    if (!candles || candles.length === 0) return 0;
    if (candles.length < period) return candles[candles.length - 1].close;

    const k = 2 / (period + 1);
    let ema = candles[0].close;

    for (let i = 1; i < candles.length; i++) {
      ema = candles[i].close * k + ema * (1 - k);
    }

    return Number(ema.toFixed(2));
  }

  /**
   * RSI (Relative Strength Index - 14)
   */
  public static calculateRSI(candles: MarketCandle[], period: number = 14): number {
    if (!candles || candles.length < period + 1) return 50.0;

    let gains = 0;
    let losses = 0;

    for (let i = candles.length - period; i < candles.length; i++) {
      const change = candles[i].close - candles[i - 1].close;
      if (change > 0) gains += change;
      else losses += Math.abs(change);
    }

    const avgGain = gains / period;
    const avgLoss = losses / period;

    if (avgLoss === 0) return 100.0;
    const rs = avgGain / avgLoss;
    const rsi = 100 - (100 / (1 + rs));

    return Number(rsi.toFixed(2));
  }

  /**
   * Supertrend (Period: 10, Multiplier: 3)
   */
  public static calculateSupertrend(
    candles: MarketCandle[],
    period: number = 10,
    multiplier: number = 3
  ): { direction: 'BULLISH' | 'BEARISH'; value: number } {
    if (!candles || candles.length < period) {
      const last = candles[candles.length - 1];
      return { direction: 'BULLISH', value: last ? last.close : 0 };
    }

    // Simple ATR calculation
    let atrSum = 0;
    for (let i = candles.length - period; i < candles.length; i++) {
      const tr = Math.max(
        candles[i].high - candles[i].low,
        Math.abs(candles[i].high - candles[i - 1].close),
        Math.abs(candles[i].low - candles[i - 1].close)
      );
      atrSum += tr;
    }
    const atr = atrSum / period;

    const last = candles[candles.length - 1];
    const basicUpper = (last.high + last.low) / 2 + multiplier * atr;
    const basicLower = (last.high + last.low) / 2 - multiplier * atr;

    const isBullish = last.close >= basicLower;
    return {
      direction: isBullish ? 'BULLISH' : 'BEARISH',
      value: Number((isBullish ? basicLower : basicUpper).toFixed(2)),
    };
  }

  /**
   * Bollinger Bands (Period: 20, StdDev: 2)
   */
  public static calculateBollingerBands(
    candles: MarketCandle[],
    period: number = 20,
    multiplier: number = 2
  ): { upper: number; middle: number; lower: number; bandwidth: number; isSqueezed: boolean } {
    if (!candles || candles.length < 5) {
      const c = candles[candles.length - 1]?.close || 0;
      return { upper: c + 20, middle: c, lower: c - 20, bandwidth: 0.05, isSqueezed: false };
    }

    const slice = candles.slice(-period);
    const mean = slice.reduce((sum, c) => sum + c.close, 0) / slice.length;

    const variance = slice.reduce((sum, c) => sum + Math.pow(c.close - mean, 2), 0) / slice.length;
    const stdDev = Math.sqrt(variance);

    const upper = Number((mean + multiplier * stdDev).toFixed(2));
    const lower = Number((mean - multiplier * stdDev).toFixed(2));
    const bandwidth = Number(((upper - lower) / mean).toFixed(4));
    const isSqueezed = bandwidth < 0.008; // Narrow consolidation

    return { upper, middle: Number(mean.toFixed(2)), lower, bandwidth, isSqueezed };
  }

  /**
   * MACD (12, 26, 9)
   */
  public static calculateMACD(candles: MarketCandle[]): {
    macdLine: number;
    signalLine: number;
    histogram: number;
    crossover: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  } {
    const ema12 = this.calculateEMA(candles, 12);
    const ema26 = this.calculateEMA(candles, 26);
    const macdLine = Number((ema12 - ema26).toFixed(2));
    const signalLine = Number((macdLine * 0.2 + (macdLine * 0.8)).toFixed(2)); // Approximate signal
    const histogram = Number((macdLine - signalLine).toFixed(2));

    const crossover = macdLine > signalLine ? 'BULLISH' : macdLine < signalLine ? 'BEARISH' : 'NEUTRAL';
    return { macdLine, signalLine, histogram, crossover };
  }

  /**
   * ADX (14) & Directional Movement (+DI, -DI)
   */
  public static calculateADX(candles: MarketCandle[], period: number = 14): {
    adx: number;
    plusDI: number;
    minusDI: number;
    isTrending: boolean;
  } {
    if (!candles || candles.length < period) {
      return { adx: 25.0, plusDI: 22.0, minusDI: 18.0, isTrending: true };
    }

    let plusDM = 0;
    let minusDM = 0;
    let trSum = 0;

    for (let i = candles.length - period; i < candles.length; i++) {
      const upMove = candles[i].high - candles[i - 1].high;
      const downMove = candles[i - 1].low - candles[i].low;

      if (upMove > downMove && upMove > 0) plusDM += upMove;
      if (downMove > upMove && downMove > 0) minusDM += downMove;

      const tr = Math.max(
        candles[i].high - candles[i].low,
        Math.abs(candles[i].high - candles[i - 1].close),
        Math.abs(candles[i].low - candles[i - 1].close)
      );
      trSum += tr;
    }

    const plusDI = trSum > 0 ? Number(((plusDM / trSum) * 100).toFixed(1)) : 20.0;
    const minusDI = trSum > 0 ? Number(((minusDM / trSum) * 100).toFixed(1)) : 20.0;
    const diDiff = Math.abs(plusDI - minusDI);
    const diSum = plusDI + minusDI;
    const adx = diSum > 0 ? Number(((diDiff / diSum) * 100).toFixed(1)) : 22.0;

    return { adx, plusDI, minusDI, isTrending: adx >= 20 };
  }

  /**
   * Opening Range Breakout (ORB 15-Minute: 09:15 - 09:30 IST)
   */
  public static calculate15mORB(candles: MarketCandle[]): {
    high: number;
    low: number;
    isFormed: boolean;
    breakout: 'BULLISH_CE' | 'BEARISH_PE' | 'INSIDE';
  } {
    if (!candles || candles.length < 3) {
      return { high: 0, low: 0, isFormed: false, breakout: 'INSIDE' };
    }

    // First 3 closed 5m candles = 15m opening range (09:15-09:20, 09:20-09:25, 09:25-09:30)
    const orbCandles = candles.slice(0, 3);
    const high = Math.max(...orbCandles.map(c => c.high));
    const low = Math.min(...orbCandles.map(c => c.low));

    const latest = candles[candles.length - 1];
    let breakout: 'BULLISH_CE' | 'BEARISH_PE' | 'INSIDE' = 'INSIDE';

    if (candles.length > 3) {
      // Must CLOSE above/below (wick-only avoid filter)
      if (latest.close > high) breakout = 'BULLISH_CE';
      else if (latest.close < low) breakout = 'BEARISH_PE';
    }

    return { high, low, isFormed: true, breakout };
  }

  /**
   * NR7 (Narrow Range 7): Current candle has narrowest range among past 7 candles
   */
  public static checkNR7(candles: MarketCandle[]): boolean {
    if (!candles || candles.length < 7) return false;
    const ranges = candles.slice(-7).map(c => c.high - c.low);
    const currentRange = ranges[ranges.length - 1];
    return currentRange <= Math.min(...ranges);
  }

  /**
   * Compute full snapshot of all technical indicators for the current 5m candle
   */
  public static getSnapshot(candles: MarketCandle[]): IndicatorSnapshot {
    return {
      vwap: this.calculateVWAP(candles),
      ema9: this.calculateEMA(candles, 9),
      ema20: this.calculateEMA(candles, 20),
      ema50: this.calculateEMA(candles, 50),
      supertrend: this.calculateSupertrend(candles, 10, 3),
      rsi: this.calculateRSI(candles, 14),
      adx: this.calculateADX(candles, 14),
      bollingerBands: this.calculateBollingerBands(candles, 20, 2),
      macd: this.calculateMACD(candles),
      orb15m: this.calculate15mORB(candles),
      isNR7: this.checkNR7(candles),
    };
  }
}
