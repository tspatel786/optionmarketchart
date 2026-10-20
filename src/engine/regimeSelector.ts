import type { MarketCandle } from '../services/growwService';
import { IndicatorCalculator, type IndicatorSnapshot } from './indicators';
import type { PivotLevels } from './pivotCalculator';

export type MarketRegimeType = 
  | 'TRENDING_BULL'
  | 'TRENDING_BEAR'
  | 'SIDEWAYS_RANGE'
  | 'VOLATILE_CHOP';

export interface RegimeAnalysis {
  regime: MarketRegimeType;
  confidence: number; // 0 - 100%
  description: string;
  favoredStrategies: number[]; // Strategy IDs
  prohibitedStrategies: number[]; // Strategy IDs to filter out
  volatilityLevel: 'LOW' | 'NORMAL' | 'ELEVATED' | 'EXTREME';
  trendStrength: number; // ADX value
  reasons: string[];
}

export class RegimeSelector {
  /**
   * Classify current market regime strictly from historical completed 5m candles and VIX.
   * Free of look-ahead bias.
   */
  public static classify(
    candles: MarketCandle[],
    snap: IndicatorSnapshot,
    _pivots: PivotLevels,
    vix?: number | null
  ): RegimeAnalysis {
    if (candles.length < 10) {
      return {
        regime: 'SIDEWAYS_RANGE',
        confidence: 50,
        description: 'Insufficient candles to classify market regime (less than 10 5m bars). Defaulting to cautious Sideways Range.',
        favoredStrategies: [7, 12, 15],
        prohibitedStrategies: [1, 2, 4],
        volatilityLevel: 'NORMAL',
        trendStrength: snap.adx.adx,
        reasons: ['Awaiting minimum 10 closed candles for reliable trend calculation.'],
      };
    }

    const latest = candles[candles.length - 1];
    const adx = snap.adx.adx;
    const plusDI = snap.adx.plusDI;
    const minusDI = snap.adx.minusDI;
    const currentVix = vix ?? 13.5;

    const reasons: string[] = [];

    // 1. Extreme / Elevated Volatility Check
    let volLevel: 'LOW' | 'NORMAL' | 'ELEVATED' | 'EXTREME' = 'NORMAL';
    if (currentVix >= 22) {
      volLevel = 'EXTREME';
      reasons.push(`India VIX (${currentVix.toFixed(2)}) is in EXTREME zone (>22). High probability of sharp whipsaws.`);
    } else if (currentVix >= 17) {
      volLevel = 'ELEVATED';
      reasons.push(`India VIX (${currentVix.toFixed(2)}) is ELEVATED (>=17). Wider stops required.`);
    } else if (currentVix <= 11) {
      volLevel = 'LOW';
      reasons.push(`India VIX (${currentVix.toFixed(2)}) is LOW (<=11). Low option premiums and slow expansion.`);
    }

    // 2. Volatile Chop Detection
    // Conditions: VIX extreme OR erratic price crossing above & below VWAP repeatedly in last 5 candles
    const last5 = candles.slice(-5);
    const vwapCrosses = last5.filter((c, idx) => {
      if (idx === 0) return false;
      const prev = last5[idx - 1];
      return (prev.close < snap.vwap && c.close > snap.vwap) || (prev.close > snap.vwap && c.close < snap.vwap);
    }).length;

    if (volLevel === 'EXTREME' || (vwapCrosses >= 3 && adx < 20)) {
      reasons.push(`Frequent VWAP crossings (${vwapCrosses} in 5 bars) with low directional ADX (${adx.toFixed(1)}).`);
      return {
        regime: 'VOLATILE_CHOP',
        confidence: 85,
        description: 'Erratic market behavior with choppy oscillations around VWAP. Breakouts are likely false.',
        favoredStrategies: [20], // Only master confluence with 3+ consensus permitted
        prohibitedStrategies: [1, 2, 4, 9], // Disable standard breakout & momentum strategies
        volatilityLevel: volLevel,
        trendStrength: adx,
        reasons,
      };
    }

    // 3. Trending Bull Detection
    // Conditions: Price > EMA 20 > EMA 50, Supertrend Green, ADX > 22, +DI > -DI, Price > VWAP
    const isEmaBullStack = latest.close > snap.ema20 && snap.ema20 > snap.ema50;
    const isSupertrendBull = snap.supertrend.direction === 'BULLISH';
    const isDiBull = plusDI > minusDI && adx >= 20;
    const isAboveVwap = latest.close > snap.vwap;

    if (isEmaBullStack && isSupertrendBull && isDiBull && isAboveVwap) {
      reasons.push(`Price (₹${latest.close.toFixed(2)}) stacked above EMA 20 (₹${snap.ema20.toFixed(2)}) & EMA 50 (₹${snap.ema50.toFixed(2)}).`);
      reasons.push(`Supertrend is BULLISH, ADX strong at ${adx.toFixed(1)} with +DI (${plusDI.toFixed(1)}) > -DI (${minusDI.toFixed(1)}).`);
      reasons.push(`Price firmly trading above intraday VWAP (₹${snap.vwap.toFixed(2)}).`);
      return {
        regime: 'TRENDING_BULL',
        confidence: Math.min(95, Math.round(70 + (adx / 2))),
        description: 'Sustained Bullish Up-trend with strong momentum and institutional volume support above VWAP.',
        favoredStrategies: [1, 2, 4, 9, 20], // ORB CE, EMA Pullback CE, Supertrend CE, PDH Breakout, Master Confluence
        prohibitedStrategies: [7], // Don't expect tight range contraction
        volatilityLevel: volLevel,
        trendStrength: adx,
        reasons,
      };
    }

    // 4. Trending Bear Detection
    // Conditions: Price < EMA 20 < EMA 50, Supertrend Red, ADX > 22, -DI > +DI, Price < VWAP
    const isEmaBearStack = latest.close < snap.ema20 && snap.ema20 < snap.ema50;
    const isSupertrendBear = snap.supertrend.direction === 'BEARISH';
    const isDiBear = minusDI > plusDI && adx >= 20;
    const isBelowVwap = latest.close < snap.vwap;

    if (isEmaBearStack && isSupertrendBear && isDiBear && isBelowVwap) {
      reasons.push(`Price (₹${latest.close.toFixed(2)}) stacked below EMA 20 (₹${snap.ema20.toFixed(2)}) & EMA 50 (₹${snap.ema50.toFixed(2)}).`);
      reasons.push(`Supertrend is BEARISH, ADX strong at ${adx.toFixed(1)} with -DI (${minusDI.toFixed(1)}) > +DI (${plusDI.toFixed(1)}).`);
      reasons.push(`Price firmly trading below intraday VWAP (₹${snap.vwap.toFixed(2)}).`);
      return {
        regime: 'TRENDING_BEAR',
        confidence: Math.min(95, Math.round(70 + (adx / 2))),
        description: 'Sustained Bearish Down-trend with strong downward momentum below VWAP.',
        favoredStrategies: [1, 2, 4, 9, 20], // ORB PE, EMA Pullback PE, Supertrend PE, PDL Breakdown, Master Confluence
        prohibitedStrategies: [7],
        volatilityLevel: volLevel,
        trendStrength: adx,
        reasons,
      };
    }

    // 5. Default: Sideways / Range-Bound Compression
    reasons.push(`ADX is below strong trend threshold (${adx.toFixed(1)} < 22).`);
    reasons.push(`Price oscillating within moving average bounds [EMA20: ₹${snap.ema20.toFixed(2)}, EMA50: ₹${snap.ema50.toFixed(2)}].`);
    return {
      regime: 'SIDEWAYS_RANGE',
      confidence: 75,
      description: 'Range-bound non-trending market. Favor mean reversion, Bollinger Band squeeze, and pivot support/resistance tests.',
      favoredStrategies: [5, 7, 12, 15, 20], // RSI Reversal, BB Squeeze, Pivots, NR7, Master Confluence
      prohibitedStrategies: [1, 2], // Breakouts and trend pullbacks prone to failure in narrow chop
      volatilityLevel: volLevel,
      trendStrength: adx,
      reasons,
    };
  }
}
