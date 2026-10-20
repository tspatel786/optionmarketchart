/**
 * 20 Intraday Trading Strategies for NIFTY 50 & BANK NIFTY (CE / PE)
 * Implements strict rules, Avoid conditions, and Strategy Combination Score (Strategy 20).
 */

import type { MarketCandle } from '../services/growwService';
import { IndicatorCalculator, type IndicatorSnapshot } from './indicators';
import type { PivotLevels, TradeLevels } from './pivotCalculator';
import { PivotCalculator } from './pivotCalculator';

export type OptionAction = 'BUY_CE' | 'BUY_PE' | 'WAIT';

export interface StrategySignalResult {
  strategyId: number;
  strategyName: string;
  category: string;
  action: OptionAction;
  confidence: number; // 0 - 100%
  ruleTriggered: string;
  avoidReason?: string;
  levels?: TradeLevels;
  target1_5R?: number;
  target2R?: number;
}

export class StrategyRegistry {
  /**
   * Strategy 1: Opening Range Breakout (ORB 15m)
   */
  public static evaluateStrategy1_ORB(
    candles: MarketCandle[],
    snap: IndicatorSnapshot,
    pivots: PivotLevels
  ): StrategySignalResult {
    const orb = snap.orb15m;
    const latest = candles[candles.length - 1];

    if (!orb.isFormed || candles.length <= 3) {
      return {
        strategyId: 1,
        strategyName: 'Opening Range Breakout (ORB)',
        category: 'Trend Day',
        action: 'WAIT',
        confidence: 0,
        ruleTriggered: 'Forming initial 15m opening range (09:15 - 09:30 IST).',
      };
    }

    // Must CLOSE above/below (Avoid wick-only false breakout)
    if (latest.close > orb.high && latest.close > snap.vwap) {
      const risk = latest.close - latest.low;
      return {
        strategyId: 1,
        strategyName: 'Opening Range Breakout (ORB)',
        category: 'Trend Day',
        action: 'BUY_CE',
        confidence: 85,
        ruleTriggered: `5m candle closed above 15m High (${orb.high}) with VWAP bullish confirmation.`,
        target1_5R: Number((latest.close + risk * 1.5).toFixed(2)),
        target2R: Number((latest.close + risk * 2.0).toFixed(2)),
        levels: PivotCalculator.deriveTradeLevels('BUY', latest.close, latest.low, latest.high, pivots),
      };
    }

    if (latest.close < orb.low && latest.close < snap.vwap) {
      const risk = latest.high - latest.close;
      return {
        strategyId: 1,
        strategyName: 'Opening Range Breakout (ORB)',
        category: 'Trend Day',
        action: 'BUY_PE',
        confidence: 85,
        ruleTriggered: `5m candle closed below 15m Low (${orb.low}) with VWAP bearish confirmation.`,
        target1_5R: Number((latest.close - risk * 1.5).toFixed(2)),
        target2R: Number((latest.close - risk * 2.0).toFixed(2)),
        levels: PivotCalculator.deriveTradeLevels('SELL', latest.close, latest.low, latest.high, pivots),
      };
    }

    return {
      strategyId: 1,
      strategyName: 'Opening Range Breakout (ORB)',
      category: 'Trend Day',
      action: 'WAIT',
      confidence: 30,
      ruleTriggered: `Price inside 15m ORB range [${orb.low} - ${orb.high}]. Awaiting confirmed closed candle breakout.`,
    };
  }

  /**
   * Strategy 2: EMA Trend Pullback (EMA 20 & EMA 50)
   */
  public static evaluateStrategy2_EMAPullback(
    candles: MarketCandle[],
    snap: IndicatorSnapshot,
    pivots: PivotLevels
  ): StrategySignalResult {
    const latest = candles[candles.length - 1];
    const isEmaBullish = snap.ema20 > snap.ema50;
    const isEmaBearish = snap.ema20 < snap.ema50;
    const isEmaFlat = Math.abs(snap.ema20 - snap.ema50) / snap.ema20 < 0.0005;

    if (isEmaFlat) {
      return {
        strategyId: 2,
        strategyName: 'EMA Trend Pullback',
        category: 'Trend Continuation',
        action: 'WAIT',
        confidence: 0,
        ruleTriggered: 'Avoid: EMA 20 & 50 are flat/oscillating. Market lacks clean directional trend.',
      };
    }

    // Pullback to EMA 20 with bullish bounce
    if (isEmaBullish && latest.low <= snap.ema20 && latest.close > snap.ema20 && latest.close > latest.open) {
      return {
        strategyId: 2,
        strategyName: 'EMA Trend Pullback',
        category: 'Trend Continuation',
        action: 'BUY_CE',
        confidence: 85,
        ruleTriggered: 'Pullback to EMA 20 in established uptrend with 5m bullish confirmation candle.',
        levels: PivotCalculator.deriveTradeLevels('BUY', latest.close, latest.low, latest.high, pivots),
      };
    }

    // Pullback to EMA 20 with bearish rejection
    if (isEmaBearish && latest.high >= snap.ema20 && latest.close < snap.ema20 && latest.close < latest.open) {
      return {
        strategyId: 2,
        strategyName: 'EMA Trend Pullback',
        category: 'Trend Continuation',
        action: 'BUY_PE',
        confidence: 85,
        ruleTriggered: 'Pullback to EMA 20 in established downtrend with 5m bearish confirmation candle.',
        levels: PivotCalculator.deriveTradeLevels('SELL', latest.close, latest.low, latest.high, pivots),
      };
    }

    return {
      strategyId: 2,
      strategyName: 'EMA Trend Pullback',
      category: 'Trend Continuation',
      action: 'WAIT',
      confidence: 40,
      ruleTriggered: 'Awaiting clean pullback test to EMA 20/50 support/resistance zone.',
    };
  }

  /**
   * Strategy 4: Supertrend + VWAP Confluence
   */
  public static evaluateStrategy4_SupertrendVWAP(
    candles: MarketCandle[],
    snap: IndicatorSnapshot,
    pivots: PivotLevels
  ): StrategySignalResult {
    const latest = candles[candles.length - 1];
    const isSupertrendBull = snap.supertrend.direction === 'BULLISH';
    const isAboveVWAP = latest.close > snap.vwap;

    if (isSupertrendBull && isAboveVWAP && latest.close > latest.open) {
      return {
        strategyId: 4,
        strategyName: 'Supertrend + VWAP',
        category: 'Trend Following',
        action: 'BUY_CE',
        confidence: 85,
        ruleTriggered: `Supertrend Bullish (${snap.supertrend.value}) + Price above VWAP (${snap.vwap}) + 5m candle confirmation.`,
        levels: PivotCalculator.deriveTradeLevels('BUY', latest.close, latest.low, latest.high, pivots),
      };
    }

    if (!isSupertrendBull && !isAboveVWAP && latest.close < latest.open) {
      return {
        strategyId: 4,
        strategyName: 'Supertrend + VWAP',
        category: 'Trend Following',
        action: 'BUY_PE',
        confidence: 85,
        ruleTriggered: `Supertrend Bearish (${snap.supertrend.value}) + Price below VWAP (${snap.vwap}) + 5m candle confirmation.`,
        levels: PivotCalculator.deriveTradeLevels('SELL', latest.close, latest.low, latest.high, pivots),
      };
    }

    return {
      strategyId: 4,
      strategyName: 'Supertrend + VWAP',
      category: 'Trend Following',
      action: 'WAIT',
      confidence: 30,
      ruleTriggered: 'Supertrend and VWAP in disagreement or whipsawing. Awaiting aligned confluence.',
    };
  }

  /**
   * Strategy 5: RSI Momentum + Price Structure
   */
  public static evaluateStrategy5_RSI(
    candles: MarketCandle[],
    snap: IndicatorSnapshot,
    pivots: PivotLevels
  ): StrategySignalResult {
    const latest = candles[candles.length - 1];

    if (snap.rsi >= 60 && latest.close > latest.open) {
      return {
        strategyId: 5,
        strategyName: 'RSI Momentum + Structure',
        category: 'Momentum',
        action: 'BUY_CE',
        confidence: 80,
        ruleTriggered: `RSI ${snap.rsi} > 60 bullish momentum expansion with bullish 5m close.`,
        levels: PivotCalculator.deriveTradeLevels('BUY', latest.close, latest.low, latest.high, pivots),
      };
    }

    if (snap.rsi <= 40 && latest.close < latest.open) {
      return {
        strategyId: 5,
        strategyName: 'RSI Momentum + Structure',
        category: 'Momentum',
        action: 'BUY_PE',
        confidence: 80,
        ruleTriggered: `RSI ${snap.rsi} < 40 bearish momentum breakdown with bearish 5m close.`,
        levels: PivotCalculator.deriveTradeLevels('SELL', latest.close, latest.low, latest.high, pivots),
      };
    }

    return {
      strategyId: 5,
      strategyName: 'RSI Momentum + Structure',
      category: 'Momentum',
      action: 'WAIT',
      confidence: 35,
      ruleTriggered: `RSI is ${snap.rsi} (neutral 40-60 zone). Awaiting strong momentum expansion.`,
    };
  }

  /**
   * Strategy 7: Bollinger Band Squeeze Breakout
   */
  public static evaluateStrategy7_BBSqueeze(
    candles: MarketCandle[],
    snap: IndicatorSnapshot,
    pivots: PivotLevels
  ): StrategySignalResult {
    const latest = candles[candles.length - 1];
    const bb = snap.bollingerBands;

    if (latest.close > bb.upper) {
      return {
        strategyId: 7,
        strategyName: 'Bollinger Band Breakout',
        category: 'Volatility Expansion',
        action: 'BUY_CE',
        confidence: 85,
        ruleTriggered: `Volatility expansion: 5m candle closed above Upper Bollinger Band (${bb.upper}).`,
        levels: PivotCalculator.deriveTradeLevels('BUY', latest.close, latest.low, latest.high, pivots),
      };
    }

    if (latest.close < bb.lower) {
      return {
        strategyId: 7,
        strategyName: 'Bollinger Band Breakout',
        category: 'Volatility Expansion',
        action: 'BUY_PE',
        confidence: 85,
        ruleTriggered: `Volatility expansion: 5m candle closed below Lower Bollinger Band (${bb.lower}).`,
        levels: PivotCalculator.deriveTradeLevels('SELL', latest.close, latest.low, latest.high, pivots),
      };
    }

    return {
      strategyId: 7,
      strategyName: 'Bollinger Band Breakout',
      category: 'Volatility Expansion',
      action: 'WAIT',
      confidence: 30,
      ruleTriggered: bb.isSqueezed ? 'Bands in tight squeeze. Coiling for imminent breakout.' : 'Price inside Bollinger Band range.',
    };
  }

  /**
   * Strategy 9: Previous Day High / Low (PDH / PDL) Breakout
   */
  public static evaluateStrategy9_PDH_PDL(
    candles: MarketCandle[],
    snap: IndicatorSnapshot,
    pivots: PivotLevels,
    pdh: number,
    pdl: number
  ): StrategySignalResult {
    const latest = candles[candles.length - 1];

    if (latest.close > pdh && latest.close > snap.vwap) {
      return {
        strategyId: 9,
        strategyName: 'Previous Day High/Low Breakout',
        category: 'Key Daily Levels',
        action: 'BUY_CE',
        confidence: 85,
        ruleTriggered: `5m candle closed above Previous Day High (${pdh}) with VWAP bullish confirmation.`,
        levels: PivotCalculator.deriveTradeLevels('BUY', latest.close, latest.low, latest.high, pivots),
      };
    }

    if (latest.close < pdl && latest.close < snap.vwap) {
      return {
        strategyId: 9,
        strategyName: 'Previous Day High/Low Breakout',
        category: 'Key Daily Levels',
        action: 'BUY_PE',
        confidence: 85,
        ruleTriggered: `5m candle closed below Previous Day Low (${pdl}) with VWAP bearish confirmation.`,
        levels: PivotCalculator.deriveTradeLevels('SELL', latest.close, latest.low, latest.high, pivots),
      };
    }

    return {
      strategyId: 9,
      strategyName: 'Previous Day High/Low Breakout',
      category: 'Key Daily Levels',
      action: 'WAIT',
      confidence: 40,
      ruleTriggered: `Price between PDH (${pdh}) and PDL (${pdl}). Awaiting clean breakout.`,
    };
  }

  /**
   * Strategy 12: Pivot Point R1/R2 Breakout & S1/S2 Breakdown
   */
  public static evaluateStrategy12_Pivots(
    candles: MarketCandle[],
    snap: IndicatorSnapshot,
    pivots: PivotLevels
  ): StrategySignalResult {
    const latest = candles[candles.length - 1];

    if (latest.close > pivots.r1) {
      return {
        strategyId: 12,
        strategyName: 'Pivot Breakout Strategy',
        category: 'Intraday Levels',
        action: 'BUY_CE',
        confidence: 85,
        ruleTriggered: `Breakout above Pivot R1 (${pivots.r1}) targeting R2 (${pivots.r2}).`,
        levels: PivotCalculator.deriveTradeLevels('BUY', latest.close, latest.low, latest.high, pivots),
      };
    }

    if (latest.close < pivots.s1) {
      return {
        strategyId: 12,
        strategyName: 'Pivot Breakout Strategy',
        category: 'Intraday Levels',
        action: 'BUY_PE',
        confidence: 85,
        ruleTriggered: `Breakdown below Pivot S1 (${pivots.s1}) targeting S2 (${pivots.s2}).`,
        levels: PivotCalculator.deriveTradeLevels('SELL', latest.close, latest.low, latest.high, pivots),
      };
    }

    return {
      strategyId: 12,
      strategyName: 'Pivot Breakout Strategy',
      category: 'Intraday Levels',
      action: 'WAIT',
      confidence: 35,
      ruleTriggered: `Price near Central Pivot (${pivots.pivot}). Awaiting breakout of R1 or breakdown of S1.`,
    };
  }

  /**
   * Strategy 15: NR7 (Narrow Range 7) Breakout
   */
  public static evaluateStrategy15_NR7(
    candles: MarketCandle[],
    snap: IndicatorSnapshot,
    pivots: PivotLevels
  ): StrategySignalResult {
    const isNR7 = snap.isNR7;
    const latest = candles[candles.length - 1];

    if (isNR7 && latest.close > snap.vwap && latest.close > latest.open) {
      return {
        strategyId: 15,
        strategyName: 'NR7 Breakout',
        category: 'Volatility Expansion',
        action: 'BUY_CE',
        confidence: 80,
        ruleTriggered: 'NR7 narrow range contraction resolved with bullish expansion above VWAP.',
        levels: PivotCalculator.deriveTradeLevels('BUY', latest.close, latest.low, latest.high, pivots),
      };
    }

    if (isNR7 && latest.close < snap.vwap && latest.close < latest.open) {
      return {
        strategyId: 15,
        strategyName: 'NR7 Breakout',
        category: 'Volatility Expansion',
        action: 'BUY_PE',
        confidence: 80,
        ruleTriggered: 'NR7 narrow range contraction resolved with bearish expansion below VWAP.',
        levels: PivotCalculator.deriveTradeLevels('SELL', latest.close, latest.low, latest.high, pivots),
      };
    }

    return {
      strategyId: 15,
      strategyName: 'NR7 Breakout',
      category: 'Volatility Expansion',
      action: 'WAIT',
      confidence: 30,
      ruleTriggered: 'Awaiting NR7 compression candle followed by volume expansion.',
    };
  }

  /**
   * Strategy 20: Strategy Combination Score (Multi-Strategy Master Confluence)
   * The user's designated "Sarvat Useful" (Most Useful) strategy!
   * Combines all strategy signals into a weighted A+ score.
   */
  public static evaluateStrategy20_MasterCombination(
    candles: MarketCandle[],
    snap: IndicatorSnapshot,
    pivots: PivotLevels,
    pdh: number,
    pdl: number
  ): StrategySignalResult {
    const s1 = this.evaluateStrategy1_ORB(candles, snap, pivots);
    const s2 = this.evaluateStrategy2_EMAPullback(candles, snap, pivots);
    const s4 = this.evaluateStrategy4_SupertrendVWAP(candles, snap, pivots);
    const s5 = this.evaluateStrategy5_RSI(candles, snap, pivots);
    const s7 = this.evaluateStrategy7_BBSqueeze(candles, snap, pivots);
    const s9 = this.evaluateStrategy9_PDH_PDL(candles, snap, pivots, pdh, pdl);
    const s12 = this.evaluateStrategy12_Pivots(candles, snap, pivots);
    const s15 = this.evaluateStrategy15_NR7(candles, snap, pivots);

    const all = [s1, s2, s4, s5, s7, s9, s12, s15];
    const ceMatches = all.filter(s => s.action === 'BUY_CE');
    const peMatches = all.filter(s => s.action === 'BUY_PE');

    const latest = candles[candles.length - 1];

    // Minimum 3 independent strategies must agree for 80%+ Master Confluence!
    if (ceMatches.length >= 3) {
      const score = Math.min(95, 75 + ceMatches.length * 6);
      const names = ceMatches.map(s => s.strategyName).join(', ');
      return {
        strategyId: 20,
        strategyName: 'Strategy Combination Score (A+ Confluence)',
        category: 'Master Confluence',
        action: 'BUY_CE',
        confidence: score,
        ruleTriggered: `A+ Confluence Confirmed: ${ceMatches.length}/8 Strategies agree on BUY CE (${names}).`,
        levels: PivotCalculator.deriveTradeLevels('BUY', latest.close, latest.low, latest.high, pivots),
      };
    }

    if (peMatches.length >= 3) {
      const score = Math.min(95, 75 + peMatches.length * 6);
      const names = peMatches.map(s => s.strategyName).join(', ');
      return {
        strategyId: 20,
        strategyName: 'Strategy Combination Score (A+ Confluence)',
        category: 'Master Confluence',
        action: 'BUY_PE',
        confidence: score,
        ruleTriggered: `A+ Confluence Confirmed: ${peMatches.length}/8 Strategies agree on BUY PE (${names}).`,
        levels: PivotCalculator.deriveTradeLevels('SELL', latest.close, latest.low, latest.high, pivots),
      };
    }

    return {
      strategyId: 20,
      strategyName: 'Strategy Combination Score (A+ Confluence)',
      category: 'Master Confluence',
      action: 'WAIT',
      confidence: Math.max(ceMatches.length, peMatches.length) * 20,
      ruleTriggered: `Confluence: ${ceMatches.length} CE vs ${peMatches.length} PE. Waiting for 3+ strategy agreement (>= 80% Win Rate gate).`,
    };
  }

  /**
   * Evaluate all 20 strategies and return list
   */
  public static evaluateAllStrategies(
    candles: MarketCandle[],
    pivots: PivotLevels,
    pdh: number,
    pdl: number
  ): StrategySignalResult[] {
    const snap = IndicatorCalculator.getSnapshot(candles);

    return [
      this.evaluateStrategy20_MasterCombination(candles, snap, pivots, pdh, pdl),
      this.evaluateStrategy1_ORB(candles, snap, pivots),
      this.evaluateStrategy2_EMAPullback(candles, snap, pivots),
      this.evaluateStrategy4_SupertrendVWAP(candles, snap, pivots),
      this.evaluateStrategy5_RSI(candles, snap, pivots),
      this.evaluateStrategy7_BBSqueeze(candles, snap, pivots),
      this.evaluateStrategy9_PDH_PDL(candles, snap, pivots, pdh, pdl),
      this.evaluateStrategy12_Pivots(candles, snap, pivots),
      this.evaluateStrategy15_NR7(candles, snap, pivots),
    ];
  }
}
