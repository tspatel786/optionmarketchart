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
    const s21 = this.evaluateStrategy21_KeltnerBreakout(candles, snap, pivots);
    const s22 = this.evaluateStrategy22_DonchianBreakout(candles, snap, pivots);
    const s23 = this.evaluateStrategy23_ATRExpansion(candles, snap, pivots);
    const s24 = this.evaluateStrategy24_LiquiditySweep(candles, snap, pivots);
    const s25 = this.evaluateStrategy25_FairValueGap(candles, snap, pivots);
    const s26 = this.evaluateStrategy26_VolumeBreakout(candles, snap, pivots);
    const s28 = this.evaluateStrategy28_Divergence(candles, snap, pivots);

    const all = [s1, s2, s4, s5, s7, s9, s12, s15, s21, s22, s23, s24, s25, s26, s28];
    const ceMatches = all.filter(s => s.action === 'BUY_CE');
    const peMatches = all.filter(s => s.action === 'BUY_PE');

    const latest = candles[candles.length - 1];

    // Minimum 3 independent strategies must agree for 80%+ Master Confluence!
    if (ceMatches.length >= 3) {
      const score = Math.min(95, 75 + ceMatches.length * 4);
      const names = ceMatches.map(s => s.strategyName).slice(0, 4).join(', ');
      return {
        strategyId: 20,
        strategyName: 'Strategy Combination Score (A+ Confluence)',
        category: 'Master Confluence',
        action: 'BUY_CE',
        confidence: score,
        ruleTriggered: `A+ Confluence Confirmed: ${ceMatches.length}/${all.length} Strategies agree on BUY CE (${names}).`,
        target1_5R: Number((latest.close + (latest.close - latest.low) * 1.5).toFixed(2)),
        target2R: Number((latest.close + (latest.close - latest.low) * 2.0).toFixed(2)),
        levels: PivotCalculator.deriveTradeLevels('BUY', latest.close, latest.low, latest.high, pivots),
      };
    }

    if (peMatches.length >= 3) {
      const score = Math.min(95, 75 + peMatches.length * 4);
      const names = peMatches.map(s => s.strategyName).slice(0, 4).join(', ');
      return {
        strategyId: 20,
        strategyName: 'Strategy Combination Score (A+ Confluence)',
        category: 'Master Confluence',
        action: 'BUY_PE',
        confidence: score,
        ruleTriggered: `A+ Confluence Confirmed: ${peMatches.length}/${all.length} Strategies agree on BUY PE (${names}).`,
        target1_5R: Number((latest.close - (latest.high - latest.close) * 1.5).toFixed(2)),
        target2R: Number((latest.close - (latest.high - latest.close) * 2.0).toFixed(2)),
        levels: PivotCalculator.deriveTradeLevels('SELL', latest.close, latest.low, latest.high, pivots),
      };
    }

    return {
      strategyId: 20,
      strategyName: 'Strategy Combination Score (A+ Confluence)',
      category: 'Master Confluence',
      action: 'WAIT',
      confidence: Math.max(ceMatches.length, peMatches.length) * 15,
      ruleTriggered: `Confluence: ${ceMatches.length} CE vs ${peMatches.length} PE. Waiting for 3+ strategy consensus (>= 80% Win Rate gate).`,
    };
  }

  /**
   * Strategy 21: Keltner Channel Breakout (ATR-Based Band Breakout)
   */
  public static evaluateStrategy21_KeltnerBreakout(
    candles: MarketCandle[],
    snap: IndicatorSnapshot,
    pivots: PivotLevels
  ): StrategySignalResult {
    const latest = candles[candles.length - 1];
    const kc = snap.keltnerChannels;
    const body = Math.abs(latest.close - latest.open);
    const range = latest.high - latest.low;
    const isSolidCandle = range > 0 && (body / range) >= 0.5;

    if (latest.close > kc.upper && latest.close > snap.vwap && isSolidCandle && snap.supertrend.direction === 'BULLISH') {
      const risk = Math.max(15, latest.close - kc.middle);
      return {
        strategyId: 21,
        strategyName: 'Keltner Channel Breakout',
        category: 'Volatility Breakout',
        action: 'BUY_CE',
        confidence: 85,
        ruleTriggered: `Solid 5m candle closed above Upper Keltner Channel (₹${kc.upper}) with VWAP & Supertrend bullish alignment.`,
        target1_5R: Number((latest.close + risk * 1.5).toFixed(2)),
        target2R: Number((latest.close + risk * 2.0).toFixed(2)),
        levels: PivotCalculator.deriveTradeLevels('BUY', latest.close, kc.middle, latest.high, pivots),
      };
    }

    if (latest.close < kc.lower && latest.close < snap.vwap && isSolidCandle && snap.supertrend.direction === 'BEARISH') {
      const risk = Math.max(15, kc.middle - latest.close);
      return {
        strategyId: 21,
        strategyName: 'Keltner Channel Breakout',
        category: 'Volatility Breakout',
        action: 'BUY_PE',
        confidence: 85,
        ruleTriggered: `Solid 5m candle closed below Lower Keltner Channel (₹${kc.lower}) with VWAP & Supertrend bearish alignment.`,
        target1_5R: Number((latest.close - risk * 1.5).toFixed(2)),
        target2R: Number((latest.close - risk * 2.0).toFixed(2)),
        levels: PivotCalculator.deriveTradeLevels('SELL', latest.close, latest.low, kc.middle, pivots),
      };
    }

    return {
      strategyId: 21,
      strategyName: 'Keltner Channel Breakout',
      category: 'Volatility Breakout',
      action: 'WAIT',
      confidence: 30,
      ruleTriggered: `Price (₹${latest.close.toFixed(2)}) inside Keltner band [₹${kc.lower} - ₹${kc.upper}]. Awaiting confirmed breakout.`,
    };
  }

  /**
   * Strategy 22: Donchian Channel Breakout (20-Period High/Low Breakout)
   */
  public static evaluateStrategy22_DonchianBreakout(
    candles: MarketCandle[],
    snap: IndicatorSnapshot,
    pivots: PivotLevels
  ): StrategySignalResult {
    const latest = candles[candles.length - 1];
    const dc = snap.donchianChannels;

    if (snap.adx.adx < 18) {
      return {
        strategyId: 22,
        strategyName: 'Donchian Channel Breakout',
        category: 'Range Breakout',
        action: 'WAIT',
        confidence: 20,
        ruleTriggered: `ADX is weak (${snap.adx.adx} < 18). Donchian breakouts filtered out to avoid choppy range whipsaws.`,
      };
    }

    if (latest.close >= dc.upper && latest.close > snap.vwap) {
      const risk = latest.close - dc.middle;
      return {
        strategyId: 22,
        strategyName: 'Donchian Channel Breakout',
        category: 'Range Breakout',
        action: 'BUY_CE',
        confidence: 80,
        ruleTriggered: `5m candle broke 20-bar Donchian High (₹${dc.upper}) with ADX trend confirmation (${snap.adx.adx}).`,
        target1_5R: Number((latest.close + risk * 1.5).toFixed(2)),
        target2R: Number((latest.close + risk * 2.0).toFixed(2)),
        levels: PivotCalculator.deriveTradeLevels('BUY', latest.close, dc.middle, latest.high, pivots),
      };
    }

    if (latest.close <= dc.lower && latest.close < snap.vwap) {
      const risk = dc.middle - latest.close;
      return {
        strategyId: 22,
        strategyName: 'Donchian Channel Breakout',
        category: 'Range Breakout',
        action: 'BUY_PE',
        confidence: 80,
        ruleTriggered: `5m candle broke 20-bar Donchian Low (₹${dc.lower}) with ADX trend confirmation (${snap.adx.adx}).`,
        target1_5R: Number((latest.close - risk * 1.5).toFixed(2)),
        target2R: Number((latest.close - risk * 2.0).toFixed(2)),
        levels: PivotCalculator.deriveTradeLevels('SELL', latest.close, latest.low, dc.middle, pivots),
      };
    }

    return {
      strategyId: 22,
      strategyName: 'Donchian Channel Breakout',
      category: 'Range Breakout',
      action: 'WAIT',
      confidence: 30,
      ruleTriggered: `Price oscillating within 20-bar Donchian Channel [₹${dc.lower} - ₹${dc.upper}].`,
    };
  }

  /**
   * Strategy 23: ATR Volatility Expansion
   */
  public static evaluateStrategy23_ATRExpansion(
    candles: MarketCandle[],
    snap: IndicatorSnapshot,
    pivots: PivotLevels
  ): StrategySignalResult {
    const latest = candles[candles.length - 1];
    const isExpanded = snap.atrExpansion.isExpanded;
    const ratio = snap.atrExpansion.ratio;
    const dynamicSlPoints = snap.atr14 * 1.5;

    if (isExpanded && latest.close > latest.open && latest.close > snap.vwap) {
      return {
        strategyId: 23,
        strategyName: 'ATR Volatility Expansion',
        category: 'Volatility Expansion',
        action: 'BUY_CE',
        confidence: 85,
        ruleTriggered: `Volatility Expansion: Candle range is ${ratio}x of 14-ATR with bullish volume expansion above VWAP.`,
        target1_5R: Number((latest.close + dynamicSlPoints * 1.5).toFixed(2)),
        target2R: Number((latest.close + dynamicSlPoints * 2.0).toFixed(2)),
        levels: PivotCalculator.deriveTradeLevels('BUY', latest.close, latest.close - dynamicSlPoints, latest.high, pivots),
      };
    }

    if (isExpanded && latest.close < latest.open && latest.close < snap.vwap) {
      return {
        strategyId: 23,
        strategyName: 'ATR Volatility Expansion',
        category: 'Volatility Expansion',
        action: 'BUY_PE',
        confidence: 85,
        ruleTriggered: `Volatility Expansion: Candle range is ${ratio}x of 14-ATR with bearish volume expansion below VWAP.`,
        target1_5R: Number((latest.close - dynamicSlPoints * 1.5).toFixed(2)),
        target2R: Number((latest.close - dynamicSlPoints * 2.0).toFixed(2)),
        levels: PivotCalculator.deriveTradeLevels('SELL', latest.close, latest.low, latest.close + dynamicSlPoints, pivots),
      };
    }

    return {
      strategyId: 23,
      strategyName: 'ATR Volatility Expansion',
      category: 'Volatility Expansion',
      action: 'WAIT',
      confidence: 30,
      ruleTriggered: `Candle volatility (${ratio}x ATR) within normal bounds. Waiting for expansion spike.`,
    };
  }

  /**
   * Strategy 24: Liquidity Sweep Reversal (Smart Money Trap)
   */
  public static evaluateStrategy24_LiquiditySweep(
    candles: MarketCandle[],
    snap: IndicatorSnapshot,
    pivots: PivotLevels
  ): StrategySignalResult {
    const latest = candles[candles.length - 1];
    const sweep = snap.liquiditySweep;

    if (sweep.type === 'BULLISH_SWEEP') {
      const risk = latest.close - latest.low;
      return {
        strategyId: 24,
        strategyName: 'Liquidity Sweep Reversal',
        category: 'Smart Money Reversal',
        action: 'BUY_CE',
        confidence: 85,
        ruleTriggered: `Bullish Liquidity Sweep: Price pierced prior swing low (₹${sweep.level}) and closed firmly back inside range. Institutional stop run complete.`,
        target1_5R: Number((latest.close + risk * 1.5).toFixed(2)),
        target2R: Number((latest.close + risk * 2.0).toFixed(2)),
        levels: PivotCalculator.deriveTradeLevels('BUY', latest.close, latest.low - 5, latest.high, pivots),
      };
    }

    if (sweep.type === 'BEARISH_SWEEP') {
      const risk = latest.high - latest.close;
      return {
        strategyId: 24,
        strategyName: 'Liquidity Sweep Reversal',
        category: 'Smart Money Reversal',
        action: 'BUY_PE',
        confidence: 85,
        ruleTriggered: `Bearish Liquidity Sweep: Price pierced prior swing high (₹${sweep.level}) and closed firmly back inside range. Bull trap identified.`,
        target1_5R: Number((latest.close - risk * 1.5).toFixed(2)),
        target2R: Number((latest.close - risk * 2.0).toFixed(2)),
        levels: PivotCalculator.deriveTradeLevels('SELL', latest.close, latest.low, latest.high + 5, pivots),
      };
    }

    return {
      strategyId: 24,
      strategyName: 'Liquidity Sweep Reversal',
      category: 'Smart Money Reversal',
      action: 'WAIT',
      confidence: 25,
      ruleTriggered: 'No liquidity sweep detected at key swing highs or lows.',
    };
  }

  /**
   * Strategy 25: Fair Value Gap (FVG) Retest
   */
  public static evaluateStrategy25_FairValueGap(
    candles: MarketCandle[],
    snap: IndicatorSnapshot,
    pivots: PivotLevels
  ): StrategySignalResult {
    const latest = candles[candles.length - 1];
    const fvg = snap.fairValueGap;

    if (fvg.type === 'BULLISH_FVG' && latest.close >= fvg.zoneBottom && snap.supertrend.direction === 'BULLISH') {
      const risk = latest.close - fvg.zoneBottom;
      return {
        strategyId: 25,
        strategyName: 'Fair Value Gap (FVG)',
        category: 'Imbalance Retest',
        action: 'BUY_CE',
        confidence: 80,
        ruleTriggered: `Bullish FVG zone [₹${fvg.zoneBottom} - ₹${fvg.zoneTop}] retested with bullish trend confirmation.`,
        target1_5R: Number((latest.close + risk * 1.5).toFixed(2)),
        target2R: Number((latest.close + risk * 2.0).toFixed(2)),
        levels: PivotCalculator.deriveTradeLevels('BUY', latest.close, fvg.zoneBottom - 5, latest.high, pivots),
      };
    }

    if (fvg.type === 'BEARISH_FVG' && latest.close <= fvg.zoneTop && snap.supertrend.direction === 'BEARISH') {
      const risk = fvg.zoneTop - latest.close;
      return {
        strategyId: 25,
        strategyName: 'Fair Value Gap (FVG)',
        category: 'Imbalance Retest',
        action: 'BUY_PE',
        confidence: 80,
        ruleTriggered: `Bearish FVG zone [₹${fvg.zoneBottom} - ₹${fvg.zoneTop}] retested with bearish trend confirmation.`,
        target1_5R: Number((latest.close - risk * 1.5).toFixed(2)),
        target2R: Number((latest.close - risk * 2.0).toFixed(2)),
        levels: PivotCalculator.deriveTradeLevels('SELL', latest.close, latest.low, fvg.zoneTop + 5, pivots),
      };
    }

    return {
      strategyId: 25,
      strategyName: 'Fair Value Gap (FVG)',
      category: 'Imbalance Retest',
      action: 'WAIT',
      confidence: 30,
      ruleTriggered: 'Awaiting active Fair Value Gap formation and retest.',
    };
  }

  /**
   * Strategy 26: Volume Breakout Confirmation
   */
  public static evaluateStrategy26_VolumeBreakout(
    candles: MarketCandle[],
    snap: IndicatorSnapshot,
    pivots: PivotLevels
  ): StrategySignalResult {
    const latest = candles[candles.length - 1];
    const vb = snap.volumeBreakout;

    if (latest.volume === 0 || vb.volumeRatio === 0) {
      return {
        strategyId: 26,
        strategyName: 'Volume Breakout Confirmation',
        category: 'Volume Spread Analysis',
        action: 'WAIT',
        confidence: 0,
        ruleTriggered: 'Volume data unavailable or zero. Strategy disabled per safety rules.',
      };
    }

    if (vb.isVolumeConfirmed && latest.close > snap.vwap && latest.close > latest.open) {
      const risk = latest.close - latest.low;
      return {
        strategyId: 26,
        strategyName: 'Volume Breakout Confirmation',
        category: 'Volume Spread Analysis',
        action: 'BUY_CE',
        confidence: 85,
        ruleTriggered: `High Volume Bullish Expansion: 5m volume is ${vb.volumeRatio}x of 20-bar average with close above VWAP.`,
        target1_5R: Number((latest.close + risk * 1.5).toFixed(2)),
        target2R: Number((latest.close + risk * 2.0).toFixed(2)),
        levels: PivotCalculator.deriveTradeLevels('BUY', latest.close, latest.low, latest.high, pivots),
      };
    }

    if (vb.isVolumeConfirmed && latest.close < snap.vwap && latest.close < latest.open) {
      const risk = latest.high - latest.close;
      return {
        strategyId: 26,
        strategyName: 'Volume Breakout Confirmation',
        category: 'Volume Spread Analysis',
        action: 'BUY_PE',
        confidence: 85,
        ruleTriggered: `High Volume Bearish Breakdown: 5m volume is ${vb.volumeRatio}x of 20-bar average with close below VWAP.`,
        target1_5R: Number((latest.close - risk * 1.5).toFixed(2)),
        target2R: Number((latest.close - risk * 2.0).toFixed(2)),
        levels: PivotCalculator.deriveTradeLevels('SELL', latest.close, latest.low, latest.high, pivots),
      };
    }

    return {
      strategyId: 26,
      strategyName: 'Volume Breakout Confirmation',
      category: 'Volume Spread Analysis',
      action: 'WAIT',
      confidence: 30,
      ruleTriggered: `Volume is standard (${vb.volumeRatio}x average). Awaiting institutional volume surge (>= 1.5x).`,
    };
  }

  /**
   * Strategy 27: Relative Strength / Weakness Trend Confirmation
   */
  public static evaluateStrategy27_RelativeStrength(
    candles: MarketCandle[],
    snap: IndicatorSnapshot,
    pivots: PivotLevels,
    prevDayClose: number
  ): StrategySignalResult {
    const latest = candles[candles.length - 1];
    const pctChange = ((latest.close - prevDayClose) / prevDayClose) * 100;

    if (pctChange >= 0.40 && latest.close > snap.vwap && snap.ema20 > snap.ema50) {
      const risk = latest.close - snap.vwap;
      return {
        strategyId: 27,
        strategyName: 'Relative Strength / Weakness',
        category: 'Intermarket Trend',
        action: 'BUY_CE',
        confidence: 80,
        ruleTriggered: `Strong relative outperformance (+${pctChange.toFixed(2)}%) trading above VWAP and EMA 20/50 bull stack.`,
        target1_5R: Number((latest.close + risk * 1.5).toFixed(2)),
        target2R: Number((latest.close + risk * 2.0).toFixed(2)),
        levels: PivotCalculator.deriveTradeLevels('BUY', latest.close, snap.vwap, latest.high, pivots),
      };
    }

    if (pctChange <= -0.40 && latest.close < snap.vwap && snap.ema20 < snap.ema50) {
      const risk = snap.vwap - latest.close;
      return {
        strategyId: 27,
        strategyName: 'Relative Strength / Weakness',
        category: 'Intermarket Trend',
        action: 'BUY_PE',
        confidence: 80,
        ruleTriggered: `Strong relative underperformance (${pctChange.toFixed(2)}%) trading below VWAP and EMA 20/50 bear stack.`,
        target1_5R: Number((latest.close - risk * 1.5).toFixed(2)),
        target2R: Number((latest.close - risk * 2.0).toFixed(2)),
        levels: PivotCalculator.deriveTradeLevels('SELL', latest.close, latest.low, snap.vwap, pivots),
      };
    }

    return {
      strategyId: 27,
      strategyName: 'Relative Strength / Weakness',
      category: 'Intermarket Trend',
      action: 'WAIT',
      confidence: 40,
      ruleTriggered: `Day change (${pctChange >= 0 ? '+' : ''}${pctChange.toFixed(2)}%) within neutral threshold (-0.40% to +0.40%).`,
    };
  }

  /**
   * Strategy 28: RSI / MACD Momentum Divergence
   */
  public static evaluateStrategy28_Divergence(
    candles: MarketCandle[],
    snap: IndicatorSnapshot,
    pivots: PivotLevels
  ): StrategySignalResult {
    const latest = candles[candles.length - 1];
    const div = snap.divergence;

    if (div.type === 'BULLISH_DIV' && latest.close > latest.open) {
      const risk = latest.close - latest.low;
      return {
        strategyId: 28,
        strategyName: 'RSI / MACD Divergence',
        category: 'Momentum Divergence',
        action: 'BUY_CE',
        confidence: 85,
        ruleTriggered: `${div.description}. Confirmed by bullish 5m reversal candle.`,
        target1_5R: Number((latest.close + risk * 1.5).toFixed(2)),
        target2R: Number((latest.close + risk * 2.0).toFixed(2)),
        levels: PivotCalculator.deriveTradeLevels('BUY', latest.close, latest.low, latest.high, pivots),
      };
    }

    if (div.type === 'BEARISH_DIV' && latest.close < latest.open) {
      const risk = latest.high - latest.close;
      return {
        strategyId: 28,
        strategyName: 'RSI / MACD Divergence',
        category: 'Momentum Divergence',
        action: 'BUY_PE',
        confidence: 85,
        ruleTriggered: `${div.description}. Confirmed by bearish 5m rejection candle.`,
        target1_5R: Number((latest.close - risk * 1.5).toFixed(2)),
        target2R: Number((latest.close - risk * 2.0).toFixed(2)),
        levels: PivotCalculator.deriveTradeLevels('SELL', latest.close, latest.low, latest.high, pivots),
      };
    }

    return {
      strategyId: 28,
      strategyName: 'RSI / MACD Divergence',
      category: 'Momentum Divergence',
      action: 'WAIT',
      confidence: 30,
      ruleTriggered: 'No confirmed RSI or MACD divergence. Price and momentum in sync.',
    };
  }

  /**
   * Strategy 29: Gap-and-Go / Gap-Fade Setup
   */
  public static evaluateStrategy29_GapPlay(
    candles: MarketCandle[],
    snap: IndicatorSnapshot,
    pivots: PivotLevels,
    prevDayClose: number
  ): StrategySignalResult {
    if (candles.length < 3) {
      return {
        strategyId: 29,
        strategyName: 'Gap-and-Go / Gap-Fade',
        category: 'Opening Gap Dynamics',
        action: 'WAIT',
        confidence: 0,
        ruleTriggered: 'Evaluating initial 15m opening gap formation.',
      };
    }

    const firstCandle = candles[0];
    const latest = candles[candles.length - 1];
    const gapPercent = ((firstCandle.open - prevDayClose) / prevDayClose) * 100;

    if (gapPercent >= 0.30 && latest.close > firstCandle.high && latest.close > snap.vwap) {
      const risk = latest.close - firstCandle.open;
      return {
        strategyId: 29,
        strategyName: 'Gap-and-Go',
        category: 'Opening Gap Dynamics',
        action: 'BUY_CE',
        confidence: 85,
        ruleTriggered: `Gap-and-Go Bullish: +${gapPercent.toFixed(2)}% opening gap held firmly above Day Open (₹${firstCandle.open}) and VWAP.`,
        target1_5R: Number((latest.close + risk * 1.5).toFixed(2)),
        target2R: Number((latest.close + risk * 2.0).toFixed(2)),
        levels: PivotCalculator.deriveTradeLevels('BUY', latest.close, firstCandle.open, latest.high, pivots),
      };
    }

    if (gapPercent <= -0.30 && latest.close < firstCandle.low && latest.close < snap.vwap) {
      const risk = firstCandle.open - latest.close;
      return {
        strategyId: 29,
        strategyName: 'Gap-and-Go',
        category: 'Opening Gap Dynamics',
        action: 'BUY_PE',
        confidence: 85,
        ruleTriggered: `Gap-and-Go Bearish: ${gapPercent.toFixed(2)}% opening gap sustained below Day Open (₹${firstCandle.open}) and VWAP.`,
        target1_5R: Number((latest.close - risk * 1.5).toFixed(2)),
        target2R: Number((latest.close - risk * 2.0).toFixed(2)),
        levels: PivotCalculator.deriveTradeLevels('SELL', latest.close, latest.low, firstCandle.open, pivots),
      };
    }

    return {
      strategyId: 29,
      strategyName: 'Gap-and-Go / Gap-Fade',
      category: 'Opening Gap Dynamics',
      action: 'WAIT',
      confidence: 30,
      ruleTriggered: `Opening gap (${gapPercent >= 0 ? '+' : ''}${gapPercent.toFixed(2)}%) within standard range without directional breakout.`,
    };
  }

  /**
   * Strategy 30: Adaptive Trailing Stop (Trade Management Rule)
   */
  public static evaluateStrategy30_AdaptiveTrailingStop(
    currentProfitR: number,
    entryPrice: number,
    initialSl: number,
    atr: number,
    direction: 'BUY' | 'SELL'
  ): { trailedStopLoss: number; rule: string } {
    if (direction === 'BUY') {
      if (currentProfitR >= 2.0) {
        return {
          trailedStopLoss: Number((entryPrice + (entryPrice - initialSl)).toFixed(2)),
          rule: 'Profit >= 2R reached: Trailed Stop Loss locked at Target 1 (1R profit guaranteed).',
        };
      }
      if (currentProfitR >= 1.5) {
        return {
          trailedStopLoss: Number((entryPrice + atr * 0.5).toFixed(2)),
          rule: 'Profit >= 1.5R reached: Trailed Stop Loss moved to Breakeven + 0.5 ATR.',
        };
      }
      return {
        trailedStopLoss: initialSl,
        rule: 'Position below 1.5R threshold: Holding initial structural Stop Loss.',
      };
    } else {
      if (currentProfitR >= 2.0) {
        return {
          trailedStopLoss: Number((entryPrice - (initialSl - entryPrice)).toFixed(2)),
          rule: 'Profit >= 2R reached: Trailed Stop Loss locked at Target 1 (1R profit guaranteed).',
        };
      }
      if (currentProfitR >= 1.5) {
        return {
          trailedStopLoss: Number((entryPrice - atr * 0.5).toFixed(2)),
          rule: 'Profit >= 1.5R reached: Trailed Stop Loss moved to Breakeven - 0.5 ATR.',
        };
      }
      return {
        trailedStopLoss: initialSl,
        rule: 'Position below 1.5R threshold: Holding initial structural Stop Loss.',
      };
    }
  }

  /**
   * Strategy 31: Event-Risk Scheduled Filter
   */
  public static evaluateStrategy31_EventRiskFilter(istDate: Date = new Date()): {
    isEventActive: boolean;
    eventName?: string;
    cautionMinutes: number;
    action: 'NORMAL' | 'LOCKOUT';
  } {
    const yyyy = istDate.getFullYear();
    const mm = String(istDate.getMonth() + 1).padStart(2, '0');
    const dd = String(istDate.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;
    const hours = istDate.getHours();
    const minutes = istDate.getMinutes();
    const totalMinutes = hours * 60 + minutes;

    const scheduledEvents: Record<string, { name: string; eventMinute: number }> = {
      '2026-02-01': { name: 'Union Budget Announcement', eventMinute: 11 * 60 },
      '2026-02-06': { name: 'RBI Monetary Policy Decision', eventMinute: 10 * 60 },
      '2026-04-09': { name: 'RBI Monetary Policy Decision', eventMinute: 10 * 60 },
      '2026-06-05': { name: 'RBI Monetary Policy Decision', eventMinute: 10 * 60 },
      '2026-08-07': { name: 'RBI Monetary Policy Decision', eventMinute: 10 * 60 },
      '2026-10-09': { name: 'RBI Monetary Policy Decision', eventMinute: 10 * 60 },
      '2026-12-04': { name: 'RBI Monetary Policy Decision', eventMinute: 10 * 60 },
    };

    const todayEvent = scheduledEvents[dateStr];
    if (todayEvent) {
      const diff = Math.abs(totalMinutes - todayEvent.eventMinute);
      if (diff <= 30) {
        return {
          isEventActive: true,
          eventName: todayEvent.name,
          cautionMinutes: diff,
          action: 'LOCKOUT',
        };
      }
    }

    return { isEventActive: false, cautionMinutes: 0, action: 'NORMAL' };
  }

  /**
   * Strategy 32: Regime-Aware Strategy Selector
   */
  public static evaluateStrategy32_RegimeAwareSelector(
    candles: MarketCandle[],
    snap: IndicatorSnapshot,
    pivots: PivotLevels,
    pdh: number,
    pdl: number,
    vix?: number | null
  ): StrategySignalResult {
    const s1 = this.evaluateStrategy1_ORB(candles, snap, pivots);
    const s2 = this.evaluateStrategy2_EMAPullback(candles, snap, pivots);
    const s4 = this.evaluateStrategy4_SupertrendVWAP(candles, snap, pivots);
    const s20 = this.evaluateStrategy20_MasterCombination(candles, snap, pivots, pdh, pdl);
    const s21 = this.evaluateStrategy21_KeltnerBreakout(candles, snap, pivots);
    const s24 = this.evaluateStrategy24_LiquiditySweep(candles, snap, pivots);
    const s26 = this.evaluateStrategy26_VolumeBreakout(candles, snap, pivots);

    const latest = candles[candles.length - 1];

    const isTrendingBull = latest.close > snap.ema20 && snap.ema20 > snap.ema50 && snap.adx.adx >= 20;
    const isTrendingBear = latest.close < snap.ema20 && snap.ema20 < snap.ema50 && snap.adx.adx >= 20;

    if (isTrendingBull) {
      const candidates = [s1, s2, s4, s21, s26].filter(s => s.action === 'BUY_CE');
      if (candidates.length >= 2) {
        const best = candidates.reduce((prev, curr) => curr.confidence > prev.confidence ? curr : prev);
        return {
          strategyId: 32,
          strategyName: 'Regime-Aware Strategy Selector',
          category: 'Adaptive Regime Selector',
          action: 'BUY_CE',
          confidence: Math.min(95, best.confidence + 5),
          ruleTriggered: `Selected for TRENDING_BULL regime: ${best.strategyName} (${best.ruleTriggered}).`,
          target1_5R: best.target1_5R,
          target2R: best.target2R,
          levels: best.levels,
        };
      }
    }

    if (isTrendingBear) {
      const candidates = [s1, s2, s4, s21, s26].filter(s => s.action === 'BUY_PE');
      if (candidates.length >= 2) {
        const best = candidates.reduce((prev, curr) => curr.confidence > prev.confidence ? curr : prev);
        return {
          strategyId: 32,
          strategyName: 'Regime-Aware Strategy Selector',
          category: 'Adaptive Regime Selector',
          action: 'BUY_PE',
          confidence: Math.min(95, best.confidence + 5),
          ruleTriggered: `Selected for TRENDING_BEAR regime: ${best.strategyName} (${best.ruleTriggered}).`,
          target1_5R: best.target1_5R,
          target2R: best.target2R,
          levels: best.levels,
        };
      }
    }

    if (s24.action !== 'WAIT') {
      return {
        strategyId: 32,
        strategyName: 'Regime-Aware Strategy Selector',
        category: 'Adaptive Regime Selector',
        action: s24.action,
        confidence: s24.confidence,
        ruleTriggered: `Selected for SIDEWAYS_RANGE regime: Liquidity Sweep Reversal (${s24.ruleTriggered}).`,
        target1_5R: s24.target1_5R,
        target2R: s24.target2R,
        levels: s24.levels,
      };
    }

    return s20;
  }

  /**
   * Evaluate all 32 strategies and return list
   */
  public static evaluateAllStrategies(
    candles: MarketCandle[],
    pivots: PivotLevels,
    pdh: number,
    pdl: number
  ): StrategySignalResult[] {
    const snap = IndicatorCalculator.getSnapshot(candles);

    return [
      this.evaluateStrategy32_RegimeAwareSelector(candles, snap, pivots, pdh, pdl),
      this.evaluateStrategy20_MasterCombination(candles, snap, pivots, pdh, pdl),
      this.evaluateStrategy21_KeltnerBreakout(candles, snap, pivots),
      this.evaluateStrategy22_DonchianBreakout(candles, snap, pivots),
      this.evaluateStrategy23_ATRExpansion(candles, snap, pivots),
      this.evaluateStrategy24_LiquiditySweep(candles, snap, pivots),
      this.evaluateStrategy25_FairValueGap(candles, snap, pivots),
      this.evaluateStrategy26_VolumeBreakout(candles, snap, pivots),
      this.evaluateStrategy27_RelativeStrength(candles, snap, pivots, pdl),
      this.evaluateStrategy28_Divergence(candles, snap, pivots),
      this.evaluateStrategy29_GapPlay(candles, snap, pivots, pdl),
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
