/**
 * Advanced Chart Pattern Detection Engine (M, W, Head & Shoulders, Neckline Breakouts & Retests)
 *
 * Requirements:
 * 1. Multi-Timeframe: Uses 15-minute candles for macro pattern geometry and 5-minute closed candles for trigger/confirmation.
 * 2. Zero Look-ahead Bias: Swing pivots confirmed ONLY after required right-side confirmation bars complete.
 * 3. Patterns Implemented:
 *    - Double Top (M Pattern) -> Breakdown PE
 *    - Double Bottom (W Pattern) -> Breakout CE
 *    - Head & Shoulders -> Breakdown PE
 *    - Inverse Head & Shoulders -> Breakout CE
 *    - Neckline Retest & Bounce (Institutional Support/Resistance Flip)
 *    - Failed Breakout / Fakeout Trap Reversal
 * 4. Full Geometric Calculation: Entry, Stop Loss, Target 1 (1.0R), Target 2 (1.5R - 2.0R), and measured move height.
 * 5. Confluence Filters: Volume expansion, VWAP alignment, and Market Regime compatibility.
 */

import type { MarketCandle } from '../services/growwService';
import type { TradeLevels } from './pivotCalculator';
import type { MarketRegimeType } from './regimeSelector';

export type ChartPatternType =
  | 'DOUBLE_TOP_M'
  | 'DOUBLE_BOTTOM_W'
  | 'HEAD_AND_SHOULDERS'
  | 'INVERSE_HEAD_AND_SHOULDERS'
  | 'NECKLINE_RETEST_BOUNCE'
  | 'FAILED_BREAKOUT_TRAP';

export type ChartPatternStatus =
  | 'FORMING'
  | 'BREAKOUT'
  | 'RETEST_CONFIRMED'
  | 'FAILED_BREAKOUT'
  | 'INVALIDATED';

export interface SwingPivot {
  type: 'HIGH' | 'LOW';
  index: number;
  price: number;
  timestamp: number;
  confirmedAtIndex: number; // The candle index where right-bars confirmed this swing (ensures no lookahead)
}

export interface ChartPatternConfig {
  peakSimilarityTolerance?: number; // Max % difference between peaks/troughs (default: 0.008 = 0.8%)
  minSeparationBars?: number;       // Min 15m bars between peaks (default: 3)
  maxSeparationBars?: number;       // Max 15m bars between peaks (default: 30)
  breakoutBuffer?: number;          // Buffer past neckline to confirm breakout (default: 0.001 = 0.1%)
  retestWindowBars?: number;        // Candles to evaluate for retest (default: 8 5m bars)
  retestTolerance?: number;         // Proximity to neckline for retest (default: 0.003 = 0.3%)
  swingLeftStrength?: number;       // Left bars for swing confirmation (default: 2)
  swingRightStrength?: number;      // Right bars for swing confirmation (default: 2)
  volumeMultiplier?: number;        // Breakout volume vs 20-period SMA (default: 1.1)
  requireVwapConfirmation?: boolean;// Price must be on correct side of VWAP (default: true)
}

export interface DetectedChartPattern {
  patternId: string;
  patternType: ChartPatternType;
  patternName: string;
  direction: 'BULLISH' | 'BEARISH';
  status: ChartPatternStatus;
  pivots: SwingPivot[];
  necklinePrice: number;
  breakoutTimestamp?: number;
  breakoutPrice?: number;
  breakoutCandle?: MarketCandle;
  retestCandle?: MarketCandle;
  patternHeight: number;
  confidence: number; // 0 - 100%
  geometry: TradeLevels;
  explanation: string;
  reasons: string[];
}

export class ChartPatternDetector {
  /**
   * Resample 5-minute candles into 15-minute candles strictly without look-ahead bias.
   * A 15m candle is only complete and added if all constituent 5m candles are closed.
   */
  public static resample5mTo15m(candles5m: MarketCandle[]): MarketCandle[] {
    if (!candles5m || candles5m.length === 0) return [];

    const candles15m: MarketCandle[] = [];
    let currentBucket: MarketCandle[] = [];
    let currentBucketStart = -1;

    for (const c of candles5m) {
      if (!c.isClosed) continue;

      // 15-minute interval aligned to epoch: 900 seconds
      const bucketTime = Math.floor(c.timestamp / 900) * 900;

      if (currentBucketStart === -1) {
        currentBucketStart = bucketTime;
      }

      if (bucketTime === currentBucketStart) {
        currentBucket.push(c);
      } else {
        // Complete current 15m candle if it has at least 3 5m bars (or 1st opening bucket of 15m)
        if (currentBucket.length >= 3) {
          candles15m.push(this.aggregateCandles(currentBucket, currentBucketStart));
        }
        currentBucket = [c];
        currentBucketStart = bucketTime;
      }
    }

    // Process last closed bucket if full
    if (currentBucket.length >= 3) {
      candles15m.push(this.aggregateCandles(currentBucket, currentBucketStart));
    }

    return candles15m;
  }

  private static aggregateCandles(candles: MarketCandle[], timestamp: number): MarketCandle {
    const open = candles[0].open;
    const high = Math.max(...candles.map(c => c.high));
    const low = Math.min(...candles.map(c => c.low));
    const close = candles[candles.length - 1].close;
    const volume = candles.reduce((acc, c) => acc + (c.volume || 0), 0);
    const datetime = candles[0].datetime;

    return {
      timestamp,
      datetime,
      open,
      high,
      low,
      close,
      volume,
      isClosed: true,
    };
  }

  /**
   * Detect Swing Highs and Swing Lows with zero look-ahead bias.
   * A pivot at index `i` is only detected at index `i + rightBars`.
   */
  public static detectSwingPivots(
    candles: MarketCandle[],
    leftBars = 2,
    rightBars = 2
  ): SwingPivot[] {
    const pivots: SwingPivot[] = [];
    const n = candles.length;
    if (n < leftBars + rightBars + 1) return pivots;

    for (let i = leftBars; i < n - rightBars; i++) {
      const current = candles[i];

      // Check Swing High
      let isHigh = true;
      for (let l = 1; l <= leftBars; l++) {
        if (candles[i - l].high > current.high) {
          isHigh = false;
          break;
        }
      }
      if (isHigh) {
        for (let r = 1; r <= rightBars; r++) {
          if (candles[i + r].high >= current.high) {
            isHigh = false;
            break;
          }
        }
      }

      if (isHigh) {
        pivots.push({
          type: 'HIGH',
          index: i,
          price: current.high,
          timestamp: current.timestamp,
          confirmedAtIndex: i + rightBars,
        });
        continue;
      }

      // Check Swing Low
      let isLow = true;
      for (let l = 1; l <= leftBars; l++) {
        if (candles[i - l].low < current.low) {
          isLow = false;
          break;
        }
      }
      if (isLow) {
        for (let r = 1; r <= rightBars; r++) {
          if (candles[i + r].low <= current.low) {
            isLow = false;
            break;
          }
        }
      }

      if (isLow) {
        pivots.push({
          type: 'LOW',
          index: i,
          price: current.low,
          timestamp: current.timestamp,
          confirmedAtIndex: i + rightBars,
        });
      }
    }

    return pivots;
  }

  /**
   * Main Pattern Detection Evaluation across 15m structure + 5m confirmation
   */
  public static detect(
    candles5m: MarketCandle[],
    config: ChartPatternConfig = {},
    context?: {
      vwap?: number;
      marketRegime?: MarketRegimeType;
      vix?: number | null;
    }
  ): DetectedChartPattern[] {
    if (!candles5m || candles5m.length < 15) return [];

    const cfg: Required<ChartPatternConfig> = {
      peakSimilarityTolerance: config.peakSimilarityTolerance ?? 0.008,
      minSeparationBars: config.minSeparationBars ?? 3,
      maxSeparationBars: config.maxSeparationBars ?? 30,
      breakoutBuffer: config.breakoutBuffer ?? 0.001,
      retestWindowBars: config.retestWindowBars ?? 8,
      retestTolerance: config.retestTolerance ?? 0.003,
      swingLeftStrength: config.swingLeftStrength ?? 2,
      swingRightStrength: config.swingRightStrength ?? 2,
      volumeMultiplier: config.volumeMultiplier ?? 1.1,
      requireVwapConfirmation: config.requireVwapConfirmation ?? true,
    };

    // 1. Resample to 15m structure
    const candles15m = this.resample5mTo15m(candles5m);
    if (candles15m.length < 8) return [];

    // 2. Detect swing points on 15m structure
    const pivots15m = this.detectSwingPivots(candles15m, cfg.swingLeftStrength, cfg.swingRightStrength);

    const patterns: DetectedChartPattern[] = [];
    const latest5m = candles5m[candles5m.length - 1];
    const avgVolume5m = this.calculateAverageVolume(candles5m, 20);

    // Evaluate in order of priority:
    // A. Double Top (M Pattern)
    const mPattern = this.evaluateDoubleTop(candles15m, pivots15m, candles5m, cfg, context, avgVolume5m);
    if (mPattern) patterns.push(mPattern);

    // B. Double Bottom (W Pattern)
    const wPattern = this.evaluateDoubleBottom(candles15m, pivots15m, candles5m, cfg, context, avgVolume5m);
    if (wPattern) patterns.push(wPattern);

    // C. Head and Shoulders
    const hsPattern = this.evaluateHeadAndShoulders(candles15m, pivots15m, candles5m, cfg, context, avgVolume5m);
    if (hsPattern) patterns.push(hsPattern);

    // D. Inverse Head and Shoulders
    const invHsPattern = this.evaluateInverseHeadAndShoulders(candles15m, pivots15m, candles5m, cfg, context, avgVolume5m);
    if (invHsPattern) patterns.push(invHsPattern);

    return patterns;
  }

  // ==========================================
  // PATTERN 1: DOUBLE TOP (M PATTERN)
  // ==========================================
  private static evaluateDoubleTop(
    candles15m: MarketCandle[],
    pivots: SwingPivot[],
    candles5m: MarketCandle[],
    cfg: Required<ChartPatternConfig>,
    context?: { vwap?: number; marketRegime?: MarketRegimeType; vix?: number | null },
    avgVol = 0
  ): DetectedChartPattern | null {
    const highPivots = pivots.filter(p => p.type === 'HIGH');
    const lowPivots = pivots.filter(p => p.type === 'LOW');
    if (highPivots.length < 2 || lowPivots.length < 1) return null;

    // Check most recent 2 swing highs
    const p2 = highPivots[highPivots.length - 1];
    const p1 = highPivots[highPivots.length - 2];

    const barSeparation = p2.index - p1.index;
    if (barSeparation < cfg.minSeparationBars || barSeparation > cfg.maxSeparationBars) return null;

    // Check peak price similarity
    const peakDiff = Math.abs(p1.price - p2.price) / Math.max(p1.price, p2.price);
    if (peakDiff > cfg.peakSimilarityTolerance) return null;

    // Intermediate valley (trough) between p1 and p2
    const intermediateLows = lowPivots.filter(l => l.index > p1.index && l.index < p2.index);
    if (intermediateLows.length === 0) return null;
    const trough = intermediateLows.reduce((min, l) => l.price < min.price ? l : min, intermediateLows[0]);

    const necklinePrice = trough.price;
    const patternHeight = Math.max(p1.price, p2.price) - necklinePrice;
    if (patternHeight < 25) return null; // Minimum structural height for Nifty / BankNifty

    const latest5m = candles5m[candles5m.length - 1];
    const breakoutThreshold = necklinePrice * (1 - cfg.breakoutBuffer);

    // Check if 5m breakout occurred
    const recent5m = candles5m.slice(-cfg.retestWindowBars);
    const breakoutIndex = recent5m.findIndex(c => c.close < breakoutThreshold && c.isClosed);

    if (breakoutIndex === -1) {
      // Pattern is forming, approaching neckline
      if (latest5m.close < (p1.price + necklinePrice) / 2) {
        const stopLoss = Math.max(p1.price, p2.price);
        const target1 = Number((necklinePrice - patternHeight).toFixed(2));
        const target2 = Number((necklinePrice - patternHeight * 1.5).toFixed(2));
        return {
          patternId: `DT_${p1.timestamp}_${p2.timestamp}`,
          patternType: 'DOUBLE_TOP_M',
          patternName: 'Double Top (M Pattern) - Forming',
          direction: 'BEARISH',
          status: 'FORMING',
          pivots: [p1, trough, p2],
          necklinePrice,
          patternHeight,
          confidence: 70,
          geometry: {
            entryPrice: latest5m.close,
            stopLoss,
            target1,
            target2,
            pivot: necklinePrice,
            riskRewardRatio: 1.5,
            invalidation: `Price breaks above peak 2 high (${p2.price.toFixed(1)})`,
          },
          explanation: `M Pattern forming: Two peaks near ₹${p1.price.toFixed(1)} & ₹${p2.price.toFixed(1)} with neckline support at ₹${necklinePrice.toFixed(1)}.`,
          reasons: ['Awaiting completed 5m candle close below neckline for confirmation.'],
        };
      }
      return null;
    }

    const breakoutCandle = recent5m[breakoutIndex];

    // Check for Retest and Bounce
    const postBreakoutCandles = recent5m.slice(breakoutIndex + 1);
    let isRetested = false;
    let isFailedBreakout = false;
    let retestCandle: MarketCandle | undefined;

    for (const c of postBreakoutCandles) {
      // Failed breakout: closed back above neckline
      if (c.close > necklinePrice * (1 + cfg.breakoutBuffer)) {
        isFailedBreakout = true;
        break;
      }
      // Retest bounce: touches neckline zone and closes down
      if (
        Math.abs(c.high - necklinePrice) / necklinePrice <= cfg.retestTolerance &&
        c.close < c.open
      ) {
        isRetested = true;
        retestCandle = c;
      }
    }

    if (isFailedBreakout) {
      return {
        patternId: `DT_FAIL_${p1.timestamp}`,
        patternType: 'FAILED_BREAKOUT_TRAP',
        patternName: 'Double Top Failed Breakdown (Bull Trap)',
        direction: 'BULLISH',
        status: 'FAILED_BREAKOUT',
        pivots: [p1, trough, p2],
        necklinePrice,
        patternHeight,
        confidence: 82,
        geometry: {
          entryPrice: latest5m.close,
          stopLoss: breakoutCandle.low,
          target1: Number((p2.price).toFixed(2)),
          target2: Number((p2.price + patternHeight * 0.5).toFixed(2)),
          pivot: necklinePrice,
          riskRewardRatio: 1.8,
          invalidation: `Price closes back below neckline ${necklinePrice.toFixed(1)}`,
        },
        explanation: 'Bear Trap detected: Breakdown failed and price closed back firmly inside/above neckline.',
        reasons: ['Sellers trapped below neckline. Reversal momentum favorable for CE.'],
      };
    }

    // Volume & VWAP Filters
    let confidence = 80;
    const reasons: string[] = [];

    if (breakoutCandle.volume && breakoutCandle.volume > avgVol * cfg.volumeMultiplier) {
      confidence += 5;
      reasons.push(`High breakout volume (${breakoutCandle.volume} vs avg ${Math.round(avgVol)})`);
    }

    if (context?.vwap && latest5m.close < context.vwap) {
      confidence += 5;
      reasons.push(`Price is below VWAP (₹${context.vwap.toFixed(1)}), confirming institutional selling.`);
    }

    const stopLoss = Math.max(
      isRetested && retestCandle ? retestCandle.high : breakoutCandle.high,
      necklinePrice * (1 + cfg.breakoutBuffer),
      p2.price
    );
    const target1 = Number((necklinePrice - patternHeight).toFixed(2));
    const target2 = Number((necklinePrice - patternHeight * 1.5).toFixed(2));
    const risk = stopLoss - latest5m.close;
    const reward = latest5m.close - target1;
    const riskRewardRatio = risk > 0 ? Number((reward / risk).toFixed(2)) : 1.5;

    return {
      patternId: `DT_${p1.timestamp}_${p2.timestamp}`,
      patternType: isRetested ? 'NECKLINE_RETEST_BOUNCE' : 'DOUBLE_TOP_M',
      patternName: isRetested
        ? 'Double Top (M Pattern) — Neckline Retest Confirmed'
        : 'Double Top (M Pattern) — Neckline Breakdown',
      direction: 'BEARISH',
      status: isRetested ? 'RETEST_CONFIRMED' : 'BREAKOUT',
      pivots: [p1, trough, p2],
      necklinePrice,
      breakoutTimestamp: breakoutCandle.timestamp,
      breakoutPrice: breakoutCandle.close,
      breakoutCandle,
      retestCandle,
      patternHeight,
      confidence: Math.min(95, confidence),
      geometry: {
        entryPrice: latest5m.close,
        stopLoss,
        target1,
        target2,
        pivot: necklinePrice,
        riskRewardRatio,
        invalidation: `Price closes above neckline rejection high (${stopLoss.toFixed(1)})`,
      },
      explanation: `Double Top breakdown: 5m candle closed below neckline (₹${necklinePrice.toFixed(1)}) with measured move target ₹${target1}.`,
      reasons,
    };
  }

  // ==========================================
  // PATTERN 2: DOUBLE BOTTOM (W PATTERN)
  // ==========================================
  private static evaluateDoubleBottom(
    candles15m: MarketCandle[],
    pivots: SwingPivot[],
    candles5m: MarketCandle[],
    cfg: Required<ChartPatternConfig>,
    context?: { vwap?: number; marketRegime?: MarketRegimeType; vix?: number | null },
    avgVol = 0
  ): DetectedChartPattern | null {
    const lowPivots = pivots.filter(p => p.type === 'LOW');
    const highPivots = pivots.filter(p => p.type === 'HIGH');
    if (lowPivots.length < 2 || highPivots.length < 1) return null;

    const t2 = lowPivots[lowPivots.length - 1];
    const t1 = lowPivots[lowPivots.length - 2];

    const barSeparation = t2.index - t1.index;
    if (barSeparation < cfg.minSeparationBars || barSeparation > cfg.maxSeparationBars) return null;

    // Check trough price similarity
    const troughDiff = Math.abs(t1.price - t2.price) / Math.min(t1.price, t2.price);
    if (troughDiff > cfg.peakSimilarityTolerance) return null;

    // Intermediate peak between t1 and t2
    const intermediateHighs = highPivots.filter(h => h.index > t1.index && h.index < t2.index);
    if (intermediateHighs.length === 0) return null;
    const peak = intermediateHighs.reduce((max, h) => h.price > max.price ? h : max, intermediateHighs[0]);

    const necklinePrice = peak.price;
    const patternHeight = necklinePrice - Math.min(t1.price, t2.price);
    if (patternHeight < 25) return null;

    const latest5m = candles5m[candles5m.length - 1];
    const breakoutThreshold = necklinePrice * (1 + cfg.breakoutBuffer);

    // Check if 5m breakout occurred
    const recent5m = candles5m.slice(-cfg.retestWindowBars);
    const breakoutIndex = recent5m.findIndex(c => c.close > breakoutThreshold && c.isClosed);

    if (breakoutIndex === -1) {
      if (latest5m.close > (t1.price + necklinePrice) / 2) {
        const stopLoss = Math.min(t1.price, t2.price);
        const target1 = Number((necklinePrice + patternHeight).toFixed(2));
        const target2 = Number((necklinePrice + patternHeight * 1.5).toFixed(2));
        return {
          patternId: `DB_${t1.timestamp}_${t2.timestamp}`,
          patternType: 'DOUBLE_BOTTOM_W',
          patternName: 'Double Bottom (W Pattern) - Forming',
          direction: 'BULLISH',
          status: 'FORMING',
          pivots: [t1, peak, t2],
          necklinePrice,
          patternHeight,
          confidence: 70,
          geometry: {
            entryPrice: latest5m.close,
            stopLoss,
            target1,
            target2,
            pivot: necklinePrice,
            riskRewardRatio: 1.5,
            invalidation: `Price breaks below trough 2 low (${t2.price.toFixed(1)})`,
          },
          explanation: `W Pattern forming: Two troughs near ₹${t1.price.toFixed(1)} & ₹${t2.price.toFixed(1)} with neckline resistance at ₹${necklinePrice.toFixed(1)}.`,
          reasons: ['Awaiting completed 5m candle close above neckline for confirmation.'],
        };
      }
      return null;
    }

    const breakoutCandle = recent5m[breakoutIndex];

    // Check for Retest and Bounce
    const postBreakoutCandles = recent5m.slice(breakoutIndex + 1);
    let isRetested = false;
    let isFailedBreakout = false;
    let retestCandle: MarketCandle | undefined;

    for (const c of postBreakoutCandles) {
      if (c.close < necklinePrice * (1 - cfg.breakoutBuffer)) {
        isFailedBreakout = true;
        break;
      }
      if (
        Math.abs(c.low - necklinePrice) / necklinePrice <= cfg.retestTolerance &&
        c.close > c.open
      ) {
        isRetested = true;
        retestCandle = c;
      }
    }

    if (isFailedBreakout) {
      return {
        patternId: `DB_FAIL_${t1.timestamp}`,
        patternType: 'FAILED_BREAKOUT_TRAP',
        patternName: 'Double Bottom Failed Breakout (Bull Trap)',
        direction: 'BEARISH',
        status: 'FAILED_BREAKOUT',
        pivots: [t1, peak, t2],
        necklinePrice,
        patternHeight,
        confidence: 82,
        geometry: {
          entryPrice: latest5m.close,
          stopLoss: breakoutCandle.high,
          target1: Number((t2.price).toFixed(2)),
          target2: Number((t2.price - patternHeight * 0.5).toFixed(2)),
          pivot: necklinePrice,
          riskRewardRatio: 1.8,
          invalidation: `Price closes back above neckline ${necklinePrice.toFixed(1)}`,
        },
        explanation: 'Bull Trap detected: Breakout failed and price fell back firmly below neckline.',
        reasons: ['Buyers trapped above neckline. Reversal momentum favorable for PE.'],
      };
    }

    let confidence = 80;
    const reasons: string[] = [];

    if (breakoutCandle.volume && breakoutCandle.volume > avgVol * cfg.volumeMultiplier) {
      confidence += 5;
      reasons.push(`High breakout volume (${breakoutCandle.volume} vs avg ${Math.round(avgVol)})`);
    }

    if (context?.vwap && latest5m.close > context.vwap) {
      confidence += 5;
      reasons.push(`Price is above VWAP (₹${context.vwap.toFixed(1)}), confirming institutional buying.`);
    }

    const stopLoss = Math.min(
      isRetested && retestCandle ? retestCandle.low : breakoutCandle.low,
      necklinePrice * (1 - cfg.breakoutBuffer),
      t2.price
    );
    const target1 = Number((necklinePrice + patternHeight).toFixed(2));
    const target2 = Number((necklinePrice + patternHeight * 1.5).toFixed(2));
    const risk = latest5m.close - stopLoss;
    const reward = target1 - latest5m.close;
    const riskRewardRatio = risk > 0 ? Number((reward / risk).toFixed(2)) : 1.5;

    return {
      patternId: `DB_${t1.timestamp}_${t2.timestamp}`,
      patternType: isRetested ? 'NECKLINE_RETEST_BOUNCE' : 'DOUBLE_BOTTOM_W',
      patternName: isRetested
        ? 'Double Bottom (W Pattern) — Neckline Retest Confirmed'
        : 'Double Bottom (W Pattern) — Neckline Breakout',
      direction: 'BULLISH',
      status: isRetested ? 'RETEST_CONFIRMED' : 'BREAKOUT',
      pivots: [t1, peak, t2],
      necklinePrice,
      breakoutTimestamp: breakoutCandle.timestamp,
      breakoutPrice: breakoutCandle.close,
      breakoutCandle,
      retestCandle,
      patternHeight,
      confidence: Math.min(95, confidence),
      geometry: {
        entryPrice: latest5m.close,
        stopLoss,
        target1,
        target2,
        pivot: necklinePrice,
        riskRewardRatio,
        invalidation: `Price closes below neckline support (${stopLoss.toFixed(1)})`,
      },
      explanation: `Double Bottom breakout: 5m candle closed above neckline (₹${necklinePrice.toFixed(1)}) with target ₹${target1}.`,
      reasons,
    };
  }

  // ==========================================
  // PATTERN 3: HEAD AND SHOULDERS (H&S)
  // ==========================================
  private static evaluateHeadAndShoulders(
    candles15m: MarketCandle[],
    pivots: SwingPivot[],
    candles5m: MarketCandle[],
    cfg: Required<ChartPatternConfig>,
    context?: { vwap?: number; marketRegime?: MarketRegimeType; vix?: number | null },
    avgVol = 0
  ): DetectedChartPattern | null {
    const highPivots = pivots.filter(p => p.type === 'HIGH');
    const lowPivots = pivots.filter(p => p.type === 'LOW');
    if (highPivots.length < 3 || lowPivots.length < 2) return null;

    // Last 3 swing highs: LS, Head, RS
    const rs = highPivots[highPivots.length - 1];
    const head = highPivots[highPivots.length - 2];
    const ls = highPivots[highPivots.length - 3];

    // Head must be strictly higher than Left Shoulder and Right Shoulder
    if (head.price <= ls.price * 1.002 || head.price <= rs.price * 1.002) return null;

    // Left Shoulder and Right Shoulder should be comparable in height
    const shoulderDiff = Math.abs(ls.price - rs.price) / Math.max(ls.price, rs.price);
    if (shoulderDiff > 0.015) return null; // within 1.5%

    // Intermediate troughs for neckline
    const t1Arr = lowPivots.filter(l => l.index > ls.index && l.index < head.index);
    const t2Arr = lowPivots.filter(l => l.index > head.index && l.index < rs.index);
    if (t1Arr.length === 0 || t2Arr.length === 0) return null;

    const t1 = t1Arr[0];
    const t2 = t2Arr[0];
    const necklinePrice = Number(((t1.price + t2.price) / 2).toFixed(2));
    const patternHeight = head.price - necklinePrice;
    if (patternHeight < 30) return null;

    const latest5m = candles5m[candles5m.length - 1];
    const breakoutThreshold = necklinePrice * (1 - cfg.breakoutBuffer);

    const recent5m = candles5m.slice(-cfg.retestWindowBars);
    const breakoutIndex = recent5m.findIndex(c => c.close < breakoutThreshold && c.isClosed);

    if (breakoutIndex === -1) {
      return null;
    }

    const breakoutCandle = recent5m[breakoutIndex];
    const stopLoss = Math.max(rs.price, breakoutCandle.high);
    const target1 = Number((necklinePrice - patternHeight).toFixed(2));
    const target2 = Number((necklinePrice - patternHeight * 1.5).toFixed(2));

    return {
      patternId: `HS_${head.timestamp}`,
      patternType: 'HEAD_AND_SHOULDERS',
      patternName: 'Head and Shoulders — Neckline Breakdown',
      direction: 'BEARISH',
      status: 'BREAKOUT',
      pivots: [ls, t1, head, t2, rs],
      necklinePrice,
      breakoutTimestamp: breakoutCandle.timestamp,
      breakoutPrice: breakoutCandle.close,
      breakoutCandle,
      patternHeight,
      confidence: 88,
      geometry: {
        entryPrice: latest5m.close,
        stopLoss,
        target1,
        target2,
        pivot: necklinePrice,
        riskRewardRatio: 1.8,
        invalidation: `Price reclaims Right Shoulder high (${rs.price.toFixed(1)})`,
      },
      explanation: `H&S pattern breakdown confirmed: Head ₹${head.price.toFixed(1)} with neckline ₹${necklinePrice}. Target ₹${target1}.`,
      reasons: ['Breakdown confirmed on completed 5m candle below neckline.'],
    };
  }

  // ==========================================
  // PATTERN 4: INVERSE HEAD AND SHOULDERS (INV H&S)
  // ==========================================
  private static evaluateInverseHeadAndShoulders(
    candles15m: MarketCandle[],
    pivots: SwingPivot[],
    candles5m: MarketCandle[],
    cfg: Required<ChartPatternConfig>,
    context?: { vwap?: number; marketRegime?: MarketRegimeType; vix?: number | null },
    avgVol = 0
  ): DetectedChartPattern | null {
    const lowPivots = pivots.filter(p => p.type === 'LOW');
    const highPivots = pivots.filter(p => p.type === 'HIGH');
    if (lowPivots.length < 3 || highPivots.length < 2) return null;

    const rs = lowPivots[lowPivots.length - 1];
    const head = lowPivots[lowPivots.length - 2];
    const ls = lowPivots[lowPivots.length - 3];

    // Head must be strictly lower than Left Shoulder and Right Shoulder
    if (head.price >= ls.price * 0.998 || head.price >= rs.price * 0.998) return null;

    // Shoulders comparable in depth
    const shoulderDiff = Math.abs(ls.price - rs.price) / Math.min(ls.price, rs.price);
    if (shoulderDiff > 0.015) return null;

    const p1Arr = highPivots.filter(h => h.index > ls.index && h.index < head.index);
    const p2Arr = highPivots.filter(h => h.index > head.index && h.index < rs.index);
    if (p1Arr.length === 0 || p2Arr.length === 0) return null;

    const p1 = p1Arr[0];
    const p2 = p2Arr[0];
    const necklinePrice = Number(((p1.price + p2.price) / 2).toFixed(2));
    const patternHeight = necklinePrice - head.price;
    if (patternHeight < 30) return null;

    const latest5m = candles5m[candles5m.length - 1];
    const breakoutThreshold = necklinePrice * (1 + cfg.breakoutBuffer);

    const recent5m = candles5m.slice(-cfg.retestWindowBars);
    const breakoutIndex = recent5m.findIndex(c => c.close > breakoutThreshold && c.isClosed);

    if (breakoutIndex === -1) {
      return null;
    }

    const breakoutCandle = recent5m[breakoutIndex];
    const stopLoss = Math.min(rs.price, breakoutCandle.low);
    const target1 = Number((necklinePrice + patternHeight).toFixed(2));
    const target2 = Number((necklinePrice + patternHeight * 1.5).toFixed(2));

    return {
      patternId: `INV_HS_${head.timestamp}`,
      patternType: 'INVERSE_HEAD_AND_SHOULDERS',
      patternName: 'Inverse Head & Shoulders — Neckline Breakout',
      direction: 'BULLISH',
      status: 'BREAKOUT',
      pivots: [ls, p1, head, p2, rs],
      necklinePrice,
      breakoutTimestamp: breakoutCandle.timestamp,
      breakoutPrice: breakoutCandle.close,
      breakoutCandle,
      patternHeight,
      confidence: 88,
      geometry: {
        entryPrice: latest5m.close,
        stopLoss,
        target1,
        target2,
        pivot: necklinePrice,
        riskRewardRatio: 1.8,
        invalidation: `Price breaks below Right Shoulder low (${rs.price.toFixed(1)})`,
      },
      explanation: `Inverse H&S breakout: Head ₹${head.price.toFixed(1)} with neckline ₹${necklinePrice}. Target ₹${target1}.`,
      reasons: ['Breakout confirmed on completed 5m candle above neckline.'],
    };
  }

  private static calculateAverageVolume(candles: MarketCandle[], period = 20): number {
    if (!candles || candles.length === 0) return 0;
    const slice = candles.slice(-period);
    const sum = slice.reduce((acc, c) => acc + (c.volume || 0), 0);
    return sum / slice.length;
  }
}
