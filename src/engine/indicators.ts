/**
 * Technical Indicators Engine for NIFTY 50 & BANK NIFTY 5m Strategies
 * Implements: VWAP, EMA (9, 20, 50), Supertrend, RSI, ADX/DI, Bollinger Bands,
 * MACD, Opening Range Breakout (ORB 15m), NR7, Keltner, Donchian, ATR Expansion,
 * Liquidity Sweep, Fair Value Gap (FVG), Volume Breakout, and RSI Divergence.
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
  atr14: number;
  keltnerChannels: {
    upper: number;
    middle: number;
    lower: number;
  };
  donchianChannels: {
    upper: number;
    middle: number;
    lower: number;
  };
  atrExpansion: {
    isExpanded: boolean;
    ratio: number;
  };
  liquiditySweep: {
    type: 'BULLISH_SWEEP' | 'BEARISH_SWEEP' | 'NONE';
    level: number;
  };
  fairValueGap: {
    type: 'BULLISH_FVG' | 'BEARISH_FVG' | 'NONE';
    zoneTop: number;
    zoneBottom: number;
  };
  volumeBreakout: {
    isVolumeConfirmed: boolean;
    volumeRatio: number;
  };
  divergence: {
    type: 'BULLISH_DIV' | 'BEARISH_DIV' | 'NONE';
    description: string;
  };
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

    if (cumVolume === 0) return candles[candles.length - 1].close;
    return Number((cumVolPrice / cumVolume).toFixed(2));
  }

  /**
   * Exponential Moving Average (EMA)
   */
  public static calculateEMA(candles: MarketCandle[], period: number): number {
    if (!candles || candles.length === 0) return 0;
    const effectivePeriod = Math.min(period, Math.max(2, candles.length));
    const k = 2 / (effectivePeriod + 1);
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
   * ATR (Average True Range)
   */
  public static calculateATR(candles: MarketCandle[], period: number = 14): number {
    if (!candles || candles.length < period + 1) return 20;
    let atrSum = 0;
    const startIdx = Math.max(1, candles.length - period);
    for (let i = startIdx; i < candles.length; i++) {
      const prev = candles[i - 1];
      const tr = Math.max(
        candles[i].high - candles[i].low,
        prev ? Math.abs(candles[i].high - prev.close) : 0,
        prev ? Math.abs(candles[i].low - prev.close) : 0
      );
      atrSum += tr;
    }
    const count = candles.length - startIdx;
    return Number((count > 0 ? atrSum / count : 20).toFixed(2));
  }

  /**
   * Supertrend (Period: 10, Multiplier: 3)
   */
  public static calculateSupertrend(
    candles: MarketCandle[],
    period: number = 10,
    multiplier: number = 3
  ): { direction: 'BULLISH' | 'BEARISH'; value: number } {
    if (!candles || candles.length < period + 1) {
      const last = candles && candles.length > 0 ? candles[candles.length - 1] : undefined;
      return { direction: 'BULLISH', value: last ? last.close : 0 };
    }

    const atr = this.calculateATR(candles, period);
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
    const isSqueezed = bandwidth < 0.008;

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
    const signalLine = Number((macdLine * 0.2 + (macdLine * 0.8)).toFixed(2));
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
    if (!candles || candles.length < period + 1) {
      return { adx: 25.0, plusDI: 22.0, minusDI: 18.0, isTrending: true };
    }

    let plusDM = 0;
    let minusDM = 0;
    let trSum = 0;

    const startIdx = Math.max(1, candles.length - period);
    for (let i = startIdx; i < candles.length; i++) {
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
    const dx = diSum > 0 ? (diDiff / diSum) * 100 : 20;

    return {
      adx: Number(dx.toFixed(1)),
      plusDI,
      minusDI,
      isTrending: dx >= 20.0,
    };
  }

  /**
   * Strategy 21: Keltner Channels (20 EMA +/- 1.5 ATR)
   */
  public static calculateKeltnerChannels(
    candles: MarketCandle[],
    emaPeriod: number = 20,
    multiplier: number = 1.5
  ): { upper: number; middle: number; lower: number } {
    const middle = this.calculateEMA(candles, emaPeriod);
    const atr = this.calculateATR(candles, 10);
    const upper = Number((middle + multiplier * atr).toFixed(2));
    const lower = Number((middle - multiplier * atr).toFixed(2));
    return { upper, middle, lower };
  }

  /**
   * Strategy 22: Donchian Channels (20 Period)
   */
  public static calculateDonchianChannels(
    candles: MarketCandle[],
    period: number = 20
  ): { upper: number; middle: number; lower: number } {
    if (!candles || candles.length < 5) {
      const c = candles && candles.length > 0 ? candles[candles.length - 1].close : 0;
      return { upper: c + 30, middle: c, lower: c - 30 };
    }
    // Look back excluding current candle
    const slice = candles.slice(-Math.min(period, candles.length) - 1, -1);
    const upper = Math.max(...slice.map(c => c.high));
    const lower = Math.min(...slice.map(c => c.low));
    const middle = Number(((upper + lower) / 2).toFixed(2));
    return { upper, middle, lower };
  }

  /**
   * Strategy 23: ATR Volatility Expansion
   */
  public static calculateATRExpansion(
    candles: MarketCandle[],
    period: number = 14,
    expansionRatio: number = 1.3
  ): { isExpanded: boolean; ratio: number } {
    if (!candles || candles.length < 2) return { isExpanded: false, ratio: 1.0 };
    const latest = candles[candles.length - 1];
    const range = latest.high - latest.low;
    const atr = this.calculateATR(candles, period);
    const ratio = atr > 0 ? Number((range / atr).toFixed(2)) : 1.0;
    return { isExpanded: ratio >= expansionRatio, ratio };
  }

  /**
   * Strategy 24: Liquidity Sweep Reversal
   */
  public static detectLiquiditySweep(
    candles: MarketCandle[],
    lookback: number = 10
  ): { type: 'BULLISH_SWEEP' | 'BEARISH_SWEEP' | 'NONE'; level: number } {
    if (!candles || candles.length < 3) return { type: 'NONE', level: 0 };
    const effectiveLookback = Math.min(lookback, candles.length - 1);
    const latest = candles[candles.length - 1];
    const priorSlice = candles.slice(-effectiveLookback - 1, -1);
    const priorHigh = Math.max(...priorSlice.map(c => c.high));
    const priorLow = Math.min(...priorSlice.map(c => c.low));

    // Bearish Sweep: Swept above prior high with wick, but closed back BELOW prior high!
    if (latest.high > priorHigh && latest.close < priorHigh && latest.open < priorHigh) {
      return { type: 'BEARISH_SWEEP', level: priorHigh };
    }
    // Bullish Sweep: Swept below prior low with wick, but closed back ABOVE prior low!
    if (latest.low < priorLow && latest.close > priorLow && latest.open > priorLow) {
      return { type: 'BULLISH_SWEEP', level: priorLow };
    }
    return { type: 'NONE', level: 0 };
  }

  /**
   * Strategy 25: Fair Value Gap (FVG)
   */
  public static detectFairValueGap(
    candles: MarketCandle[]
  ): { type: 'BULLISH_FVG' | 'BEARISH_FVG' | 'NONE'; zoneTop: number; zoneBottom: number } {
    if (!candles || candles.length < 3) return { type: 'NONE', zoneTop: 0, zoneBottom: 0 };
    const c1 = candles[candles.length - 3];
    const c2 = candles[candles.length - 2];
    const c3 = candles[candles.length - 1];

    if (c1.high < c3.low && c2.close > c2.open && (c3.low - c1.high) > 5) {
      return { type: 'BULLISH_FVG', zoneTop: c3.low, zoneBottom: c1.high };
    }
    if (c1.low > c3.high && c2.close < c2.open && (c1.low - c3.high) > 5) {
      return { type: 'BEARISH_FVG', zoneTop: c1.low, zoneBottom: c3.high };
    }
    return { type: 'NONE', zoneTop: 0, zoneBottom: 0 };
  }

  /**
   * Strategy 26: Volume Breakout Confirmation
   */
  public static checkVolumeBreakout(
    candles: MarketCandle[],
    lookback: number = 20,
    thresholdMultiplier: number = 1.5
  ): { isVolumeConfirmed: boolean; volumeRatio: number } {
    if (!candles || candles.length < 5) return { isVolumeConfirmed: false, volumeRatio: 1.0 };
    const latest = candles[candles.length - 1];
    const slice = candles.slice(-Math.min(lookback, candles.length) - 1, -1);
    const avgVol = slice.reduce((acc, c) => acc + c.volume, 0) / Math.max(1, slice.length);

    if (avgVol <= 0 || latest.volume <= 0) {
      return { isVolumeConfirmed: false, volumeRatio: 0 };
    }
    const ratio = Number((latest.volume / avgVol).toFixed(2));
    return { isVolumeConfirmed: ratio >= thresholdMultiplier, volumeRatio: ratio };
  }

  /**
   * Strategy 28: RSI / MACD Divergence
   */
  public static detectRSIDivergence(
    candles: MarketCandle[],
    lookback: number = 14
  ): { type: 'BULLISH_DIV' | 'BEARISH_DIV' | 'NONE'; description: string } {
    if (!candles || candles.length < lookback + 5) return { type: 'NONE', description: 'Normal' };
    const latest = candles[candles.length - 1];
    const pastCandle = candles[candles.length - Math.min(lookback, candles.length - 2)];
    const currentRsi = this.calculateRSI(candles, 14);
    const pastSlice = candles.slice(0, candles.length - 5);
    const pastRsi = this.calculateRSI(pastSlice, 14);

    if (latest.close < pastCandle.close && currentRsi > pastRsi + 3) {
      return { type: 'BULLISH_DIV', description: `Bullish Divergence: Price made lower low while RSI rose (${pastRsi.toFixed(1)} -> ${currentRsi.toFixed(1)})` };
    }
    if (latest.close > pastCandle.close && currentRsi < pastRsi - 3) {
      return { type: 'BEARISH_DIV', description: `Bearish Divergence: Price made higher high while RSI fell (${pastRsi.toFixed(1)} -> ${currentRsi.toFixed(1)})` };
    }
    return { type: 'NONE', description: 'No divergence' };
  }

  /**
   * Strategy 1: Opening Range Breakout (ORB 15m)
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

    const orbCandles = candles.slice(0, 3);
    const high = Math.max(...orbCandles.map(c => c.high));
    const low = Math.min(...orbCandles.map(c => c.low));

    const latest = candles[candles.length - 1];
    let breakout: 'BULLISH_CE' | 'BEARISH_PE' | 'INSIDE' = 'INSIDE';

    if (candles.length > 3) {
      if (latest.close > high) breakout = 'BULLISH_CE';
      else if (latest.close < low) breakout = 'BEARISH_PE';
    }

    return { high, low, isFormed: true, breakout };
  }

  /**
   * Strategy 15: NR7 (Narrow Range 7)
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
      atr14: this.calculateATR(candles, 14),
      keltnerChannels: this.calculateKeltnerChannels(candles, 20, 1.5),
      donchianChannels: this.calculateDonchianChannels(candles, 20),
      atrExpansion: this.calculateATRExpansion(candles, 14, 1.3),
      liquiditySweep: this.detectLiquiditySweep(candles, 10),
      fairValueGap: this.detectFairValueGap(candles),
      volumeBreakout: this.checkVolumeBreakout(candles, 20, 1.5),
      divergence: this.detectRSIDivergence(candles, 14),
    };
  }
}
