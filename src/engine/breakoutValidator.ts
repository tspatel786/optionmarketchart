/**
 * Strong vs. Weak Breakout Validation Engine
 * Based on Price Action Breakout Geometry:
 *
 * Rules:
 * 1. Weak Bullish Breakout (DO NOT ENTER):
 *    - Candle body penetration beyond level is < 50% (e.g., 25% above, 75% below).
 *    - Or follow-through candle is a red rejection bar failing to hold the breakout level.
 * 2. Strong Bullish Breakout (ENTER):
 *    - Candle body penetration is >= 60% (e.g., 62% above, 38% below).
 *    - Or completed 5m follow-through candle retests the level with rejection wick and closes green.
 * 3. Weak Bearish Breakout (DO NOT ENTER):
 *    - Candle body penetration below level is < 50% (e.g., 25% below, 75% above).
 *    - Or follow-through candle is a green reversal candle back above support.
 * 4. Strong Bearish Breakout (ENTER):
 *    - Candle body penetration below level is >= 60% (e.g., 62% below, 38% above).
 *    - Or completed 5m follow-through candle retests the level from below and closes red.
 */

import type { MarketCandle } from '../services/growwService';

export type BreakoutClassification =
  | 'STRONG_BULLISH_BREAKOUT'
  | 'STRONG_BEARISH_BREAKOUT'
  | 'STRONG_RETEST_BOUNCE'
  | 'WEAK_BULLISH_BREAKOUT'
  | 'WEAK_BEARISH_BREAKOUT'
  | 'WEAK_BREAKOUT_REJECTED'
  | 'NEUTRAL_CONSOLIDATION';

export interface BreakoutValidationResult {
  classification: BreakoutClassification;
  isQualified: boolean; // True when Strong (Enter), False when Weak (Do Not Enter)
  penetrationPct: number; // e.g. 62%
  levelPrice: number;
  direction: 'BULLISH' | 'BEARISH';
  confidenceScore: number; // 0 - 100
  reason: string;
  recommendation: 'ENTER' | 'DO_NOT_ENTER' | 'WAIT_FOR_RETEST';
}

export class BreakoutValidator {
  /**
   * Evaluate Breakout Candle Quality against a key structural level
   */
  public static evaluateBreakout(
    breakoutCandle: MarketCandle,
    levelPrice: number,
    direction: 'BULLISH' | 'BEARISH',
    followThroughCandle?: MarketCandle
  ): BreakoutValidationResult {
    const c = breakoutCandle;
    const body = Math.abs(c.close - c.open);
    const range = c.high - c.low;

    if (body === 0 || range === 0) {
      return {
        classification: 'NEUTRAL_CONSOLIDATION',
        isQualified: false,
        penetrationPct: 0,
        levelPrice,
        direction,
        confidenceScore: 30,
        reason: 'Candle has zero body (Doji) at breakout level. Indecision.',
        recommendation: 'DO_NOT_ENTER',
      };
    }

    if (direction === 'BULLISH') {
      // Bullish Breakout: Candle must be green and closing above levelPrice
      const isGreen = c.close > c.open;
      const closedAbove = c.close > levelPrice;

      if (!closedAbove) {
        return {
          classification: 'WEAK_BULLISH_BREAKOUT',
          isQualified: false,
          penetrationPct: 0,
          levelPrice,
          direction: 'BULLISH',
          confidenceScore: 20,
          reason: `Candle close (₹${c.close.toFixed(1)}) failed to close above resistance (₹${levelPrice.toFixed(1)}).`,
          recommendation: 'DO_NOT_ENTER',
        };
      }

      // Calculate percentage of body situated ABOVE the breakout level
      const bodyTop = Math.max(c.open, c.close);
      const bodyBottom = Math.min(c.open, c.close);
      const bodyAbove = Math.max(0, bodyTop - Math.max(bodyBottom, levelPrice));
      const penetrationPct = Number(((bodyAbove / body) * 100).toFixed(1));

      // Case 1: Weak Penetration (< 50% above level)
      if (penetrationPct < 50.0) {
        return {
          classification: 'WEAK_BULLISH_BREAKOUT',
          isQualified: false,
          penetrationPct,
          levelPrice,
          direction: 'BULLISH',
          confidenceScore: 40,
          reason: `Weak Bullish Breakout: Only ${penetrationPct}% of candle body is above resistance ₹${levelPrice.toFixed(1)} (Min 60% required). High fakeout risk.`,
          recommendation: 'DO_NOT_ENTER',
        };
      }

      // Check Follow-Through Candle (if available)
      if (followThroughCandle && followThroughCandle.isClosed) {
        const fc = followThroughCandle;
        const isFollowThroughRed = fc.close < fc.open;
        const closedBelowNeckline = fc.close <= levelPrice;

        if (closedBelowNeckline || (isFollowThroughRed && fc.close < c.open)) {
          return {
            classification: 'WEAK_BREAKOUT_REJECTED',
            isQualified: false,
            penetrationPct,
            levelPrice,
            direction: 'BULLISH',
            confidenceScore: 25,
            reason: `Breakout Rejected: Next 5m candle turned red and closed back at or below resistance (₹${fc.close.toFixed(1)}). Bull trap.`,
            recommendation: 'DO_NOT_ENTER',
          };
        }

        // Clean Retest & Bounce: Lower wick touches near levelPrice and closes green
        const touchedLevel = Math.abs(fc.low - levelPrice) / levelPrice <= 0.003;
        if (touchedLevel && fc.close > fc.open && fc.close > levelPrice) {
          return {
            classification: 'STRONG_RETEST_BOUNCE',
            isQualified: true,
            penetrationPct,
            levelPrice,
            direction: 'BULLISH',
            confidenceScore: 92,
            reason: `Strong Retest & Bounce: Breakout candle (${penetrationPct}% body above) followed by rejection wick test of ₹${levelPrice.toFixed(1)} and green close.`,
            recommendation: 'ENTER',
          };
        }
      }

      // Strong Bullish Breakout (>= 60% penetration)
      const isStrong = penetrationPct >= 60.0 && isGreen;
      return {
        classification: isStrong ? 'STRONG_BULLISH_BREAKOUT' : 'WEAK_BULLISH_BREAKOUT',
        isQualified: isStrong,
        penetrationPct,
        levelPrice,
        direction: 'BULLISH',
        confidenceScore: isStrong ? 86 : 48,
        reason: isStrong
          ? `Strong Bullish Breakout: Decisive ${penetrationPct}% of candle body closed firmly above resistance (₹${levelPrice.toFixed(1)}). Institutional momentum confirmed.`
          : `Marginal Breakout: ${penetrationPct}% penetration is between 50-60%. Awaiting retest.`,
        recommendation: isStrong ? 'ENTER' : 'WAIT_FOR_RETEST',
      };
    } else {
      // Bearish Breakdown: Candle must be red and closing below levelPrice
      const isRed = c.close < c.open;
      const closedBelow = c.close < levelPrice;

      if (!closedBelow) {
        return {
          classification: 'WEAK_BEARISH_BREAKOUT',
          isQualified: false,
          penetrationPct: 0,
          levelPrice,
          direction: 'BEARISH',
          confidenceScore: 20,
          reason: `Candle close (₹${c.close.toFixed(1)}) failed to close below support (₹${levelPrice.toFixed(1)}).`,
          recommendation: 'DO_NOT_ENTER',
        };
      }

      // Calculate percentage of body situated BELOW the breakdown level
      const bodyTop = Math.max(c.open, c.close);
      const bodyBottom = Math.min(c.open, c.close);
      const bodyBelow = Math.max(0, Math.min(bodyTop, levelPrice) - bodyBottom);
      const penetrationPct = Number(((bodyBelow / body) * 100).toFixed(1));

      // Weak Penetration (< 50% below level)
      if (penetrationPct < 50.0) {
        return {
          classification: 'WEAK_BEARISH_BREAKOUT',
          isQualified: false,
          penetrationPct,
          levelPrice,
          direction: 'BEARISH',
          confidenceScore: 40,
          reason: `Weak Bearish Breakdown: Only ${penetrationPct}% of candle body is below support ₹${levelPrice.toFixed(1)} (Min 60% required). High bear trap risk.`,
          recommendation: 'DO_NOT_ENTER',
        };
      }

      // Check Follow-Through Candle
      if (followThroughCandle && followThroughCandle.isClosed) {
        const fc = followThroughCandle;
        const isFollowThroughGreen = fc.close > fc.open;
        const closedAboveSupport = fc.close >= levelPrice;

        if (closedAboveSupport || (isFollowThroughGreen && fc.close > c.open)) {
          return {
            classification: 'WEAK_BREAKOUT_REJECTED',
            isQualified: false,
            penetrationPct,
            levelPrice,
            direction: 'BEARISH',
            confidenceScore: 25,
            reason: `Breakdown Rejected: Next 5m candle turned green and reclaimed support (₹${fc.close.toFixed(1)}). Bear trap.`,
            recommendation: 'DO_NOT_ENTER',
          };
        }

        // Clean Retest & Rejection: Upper wick touches near levelPrice and closes red
        const touchedLevel = Math.abs(fc.high - levelPrice) / levelPrice <= 0.003;
        if (touchedLevel && fc.close < fc.open && fc.close < levelPrice) {
          return {
            classification: 'STRONG_RETEST_BOUNCE',
            isQualified: true,
            penetrationPct,
            levelPrice,
            direction: 'BEARISH',
            confidenceScore: 92,
            reason: `Strong Retest & Rejection: Breakdown candle (${penetrationPct}% body below) followed by rejection wick test of ₹${levelPrice.toFixed(1)} and red close.`,
            recommendation: 'ENTER',
          };
        }
      }

      const isStrong = penetrationPct >= 60.0 && isRed;
      return {
        classification: isStrong ? 'STRONG_BEARISH_BREAKOUT' : 'WEAK_BEARISH_BREAKOUT',
        isQualified: isStrong,
        penetrationPct,
        levelPrice,
        direction: 'BEARISH',
        confidenceScore: isStrong ? 86 : 48,
        reason: isStrong
          ? `Strong Bearish Breakdown: Decisive ${penetrationPct}% of candle body closed firmly below support (₹${levelPrice.toFixed(1)}). Institutional selling pressure confirmed.`
          : `Marginal Breakdown: ${penetrationPct}% penetration is between 50-60%. Awaiting retest.`,
        recommendation: isStrong ? 'ENTER' : 'WAIT_FOR_RETEST',
      };
    }
  }
}
