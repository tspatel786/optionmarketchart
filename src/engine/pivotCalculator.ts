/**
 * Pivot Points & Breakout / Breakdown Calculator
 * Follows the "Kal Ke Levels" classic pivot framework:
 * P = (High + Low + Close) / 3
 * R1 = (2 * P) - Low (Breakout level)
 * R2 = P + (High - Low) (Upper target)
 * S1 = (2 * P) - High (Breakdown level)
 * S2 = P - (High - Low) (Lower target / Slide level)
 */

export interface PivotLevels {
  pivot: number;
  r1: number; // Breakout Level
  r2: number; // Target 2
  s1: number; // Breakdown Level
  s2: number; // Target 2 (Slide)
}

export interface TradeLevels {
  entryPrice: number;
  stopLoss: number;
  target1: number;
  target2: number;
  pivot: number;
  riskRewardRatio: number;
  invalidation: string;
}

export class PivotCalculator {
  public static calculatePivots(prevHigh: number, prevLow: number, prevClose: number): PivotLevels {
    const pivot = Number(((prevHigh + prevLow + prevClose) / 3).toFixed(2));
    const r1 = Number(((2 * pivot) - prevLow).toFixed(2));
    const r2 = Number((pivot + (prevHigh - prevLow)).toFixed(2));
    const s1 = Number(((2 * pivot) - prevHigh).toFixed(2));
    const s2 = Number((pivot - (prevHigh - prevLow)).toFixed(2));

    return { pivot, r1, r2, s1, s2 };
  }

  /**
   * Calculate precise Entry, SL, and Targets for a 5m signal
   */
  public static deriveTradeLevels(
    direction: 'BUY' | 'SELL',
    currentPrice: number,
    candleLow: number,
    candleHigh: number,
    pivots: PivotLevels
  ): TradeLevels {
    if (direction === 'BUY') {
      const entryPrice = currentPrice;
      // Stop loss placed at the low of the trigger 5m candle (or Pivot if candle low is above pivot)
      const stopLoss = Math.min(candleLow, pivots.pivot);
      const target1 = pivots.r1 > entryPrice ? pivots.r1 : Number((entryPrice + (entryPrice - stopLoss) * 1.5).toFixed(2));
      const target2 = pivots.r2 > target1 ? pivots.r2 : Number((entryPrice + (entryPrice - stopLoss) * 2.5).toFixed(2));
      const risk = entryPrice - stopLoss;
      const reward = target1 - entryPrice;
      const riskRewardRatio = risk > 0 ? Number((reward / risk).toFixed(2)) : 1.5;

      return {
        entryPrice,
        stopLoss,
        target1,
        target2,
        pivot: pivots.pivot,
        riskRewardRatio,
        invalidation: `Price breaks below trigger candle low (${stopLoss.toFixed(2)}) or Pivot (${pivots.pivot.toFixed(2)})`,
      };
    } else {
      const entryPrice = currentPrice;
      // Stop loss placed at the high of the trigger 5m candle
      const stopLoss = Math.max(candleHigh, pivots.pivot);
      const target1 = pivots.s1 < entryPrice ? pivots.s1 : Number((entryPrice - (stopLoss - entryPrice) * 1.5).toFixed(2));
      const target2 = pivots.s2 < target1 ? pivots.s2 : Number((entryPrice - (stopLoss - entryPrice) * 2.5).toFixed(2));
      const risk = stopLoss - entryPrice;
      const reward = entryPrice - target1;
      const riskRewardRatio = risk > 0 ? Number((reward / risk).toFixed(2)) : 1.5;

      return {
        entryPrice,
        stopLoss,
        target1,
        target2,
        pivot: pivots.pivot,
        riskRewardRatio,
        invalidation: `Price breaks above trigger candle high (${stopLoss.toFixed(2)}) or Pivot (${pivots.pivot.toFixed(2)})`,
      };
    }
  }
}
