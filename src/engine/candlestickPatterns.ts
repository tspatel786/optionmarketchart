import type { MarketCandle } from '../services/growwService';

export type PatternDirection = 'BUY' | 'SELL';

export interface PatternMatchResult {
  patternCode: string;
  patternName: string;
  direction: PatternDirection;
  confidence: number;
  matchedCandleTimestamp: number;
  explanation: string;
}

/**
 * 8 Candlestick Patterns Evaluator (Strictly on 5m Closed Candles)
 * Input: Array of closed candles sorted oldest to newest (latest closed candle at candles[candles.length - 1])
 */
export class CandlestickPatternEvaluator {
  /**
   * Helper: check if a prior price swing was downward
   */
  private static isPriorDowntrend(candles: MarketCandle[], lookback: number = 3): boolean {
    if (candles.length < lookback + 1) return false;
    const endIdx = candles.length - 2; // Before the pattern candle
    const startIdx = Math.max(0, endIdx - lookback);
    return candles[endIdx].close < candles[startIdx].close;
  }

  /**
   * Helper: check if a prior price swing was upward
   */
  private static isPriorUptrend(candles: MarketCandle[], lookback: number = 3): boolean {
    if (candles.length < lookback + 1) return false;
    const endIdx = candles.length - 2;
    const startIdx = Math.max(0, endIdx - lookback);
    return candles[endIdx].close > candles[startIdx].close;
  }

  /**
   * 1. Hammer Pattern (Bullish Reversal on 5m)
   */
  public static checkHammer(candles: MarketCandle[]): PatternMatchResult | null {
    if (candles.length < 3) return null;
    const c = candles[candles.length - 1];
    const body = Math.abs(c.close - c.open);
    const range = c.high - c.low;
    if (range === 0 || body === 0) return null;

    const lowerWick = Math.min(c.open, c.close) - c.low;
    const upperWick = c.high - Math.max(c.open, c.close);

    // Lower wick must be >= 2x body, upper wick <= 10% of range
    const isHammerShape = lowerWick >= 2 * body && upperWick <= range * 0.15;
    const isDowntrend = this.isPriorDowntrend(candles, 3);

    if (isHammerShape && isDowntrend) {
      return {
        patternCode: 'PA-01',
        patternName: 'Hammer (5m Bullish Reversal)',
        direction: 'BUY',
        confidence: 0.85,
        matchedCandleTimestamp: c.timestamp,
        explanation: `5m Hammer detected: Lower wick (${lowerWick.toFixed(1)}) is >= 2x body (${body.toFixed(1)}) following downward swing.`,
      };
    }
    return null;
  }

  /**
   * 2. Shooting Star Pattern (Bearish Reversal on 5m)
   */
  public static checkShootingStar(candles: MarketCandle[]): PatternMatchResult | null {
    if (candles.length < 3) return null;
    const c = candles[candles.length - 1];
    const body = Math.abs(c.close - c.open);
    const range = c.high - c.low;
    if (range === 0 || body === 0) return null;

    const upperWick = c.high - Math.max(c.open, c.close);
    const lowerWick = Math.min(c.open, c.close) - c.low;

    // Upper wick must be >= 2x body, lower wick <= 15% of range
    const isShootingStarShape = upperWick >= 2 * body && lowerWick <= range * 0.15;
    const isUptrend = this.isPriorUptrend(candles, 3);

    if (isShootingStarShape && isUptrend) {
      return {
        patternCode: 'PA-02',
        patternName: 'Shooting Star (5m Bearish Reversal)',
        direction: 'SELL',
        confidence: 0.85,
        matchedCandleTimestamp: c.timestamp,
        explanation: `5m Shooting Star detected: Upper wick (${upperWick.toFixed(1)}) is >= 2x body (${body.toFixed(1)}) following upward swing.`,
      };
    }
    return null;
  }

  /**
   * 3. Three White Soldiers (Bullish on 5m)
   */
  public static checkThreeWhiteSoldiers(candles: MarketCandle[]): PatternMatchResult | null {
    if (candles.length < 5) return null;
    const c0 = candles[candles.length - 1];
    const c1 = candles[candles.length - 2];
    const c2 = candles[candles.length - 3];

    const allGreen = c0.close > c0.open && c1.close > c1.open && c2.close > c2.open;
    const higherCloses = c0.close > c1.close && c1.close > c2.close;
    const opensInside = c0.open > c1.open && c0.open < c1.close && c1.open > c2.open && c1.open < c2.close;

    if (allGreen && higherCloses && opensInside) {
      return {
        patternCode: 'PA-03',
        patternName: 'Three White Soldiers (5m Bullish)',
        direction: 'BUY',
        confidence: 0.90,
        matchedCandleTimestamp: c0.timestamp,
        explanation: 'Three consecutive bullish 5m candles closing with strong higher highs.',
      };
    }
    return null;
  }

  /**
   * 4. Three Black Crows (Bearish on 5m)
   */
  public static checkThreeBlackCrows(candles: MarketCandle[]): PatternMatchResult | null {
    if (candles.length < 5) return null;
    const c0 = candles[candles.length - 1];
    const c1 = candles[candles.length - 2];
    const c2 = candles[candles.length - 3];

    const allRed = c0.close < c0.open && c1.close < c1.open && c2.close < c2.open;
    const lowerCloses = c0.close < c1.close && c1.close < c2.close;
    const opensInside = c0.open < c1.open && c0.open > c1.close && c1.open < c2.open && c1.open > c2.close;

    if (allRed && lowerCloses && opensInside) {
      return {
        patternCode: 'PA-04',
        patternName: 'Three Black Crows (5m Bearish)',
        direction: 'SELL',
        confidence: 0.90,
        matchedCandleTimestamp: c0.timestamp,
        explanation: 'Three consecutive bearish 5m candles closing with lower lows.',
      };
    }
    return null;
  }

  /**
   * 5. Bullish Marubozu (Bullish on 5m)
   */
  public static checkBullishMarubozu(candles: MarketCandle[]): PatternMatchResult | null {
    if (candles.length < 2) return null;
    const c = candles[candles.length - 1];
    const range = c.high - c.low;
    const body = c.close - c.open;
    if (body <= 0 || range <= 0) return null;

    const upperWick = c.high - c.close;
    const lowerWick = c.open - c.low;

    // Negligible shadows (< 5% of range each) and body >= 90% of range
    const isMarubozu = body >= range * 0.90 && upperWick <= range * 0.05 && lowerWick <= range * 0.05;

    if (isMarubozu) {
      return {
        patternCode: 'PA-05',
        patternName: 'Bullish Marubozu (5m Strong Bullish)',
        direction: 'BUY',
        confidence: 0.88,
        matchedCandleTimestamp: c.timestamp,
        explanation: 'Full-bodied 5m bullish candle with negligible wicks, indicating decisive buyer dominance.',
      };
    }
    return null;
  }

  /**
   * 6. Bearish Marubozu (Bearish on 5m)
   */
  public static checkBearishMarubozu(candles: MarketCandle[]): PatternMatchResult | null {
    if (candles.length < 2) return null;
    const c = candles[candles.length - 1];
    const range = c.high - c.low;
    const body = c.open - c.close;
    if (body <= 0 || range <= 0) return null;

    const upperWick = c.high - c.open;
    const lowerWick = c.close - c.low;

    // Negligible shadows (< 5% of range each) and body >= 90% of range
    const isMarubozu = body >= range * 0.90 && upperWick <= range * 0.05 && lowerWick <= range * 0.05;

    if (isMarubozu) {
      return {
        patternCode: 'PA-06',
        patternName: 'Bearish Marubozu (5m Strong Bearish)',
        direction: 'SELL',
        confidence: 0.88,
        matchedCandleTimestamp: c.timestamp,
        explanation: 'Full-bodied 5m bearish candle with negligible wicks, indicating decisive seller dominance.',
      };
    }
    return null;
  }

  /**
   * 7. Bullish Engulfing (Bullish on 5m)
   */
  public static checkBullishEngulfing(candles: MarketCandle[]): PatternMatchResult | null {
    if (candles.length < 3) return null;
    const curr = candles[candles.length - 1];
    const prev = candles[candles.length - 2];

    const prevBearish = prev.close < prev.open;
    const currBullish = curr.close > curr.open;

    // Current body engulfs prior body
    const bodyEngulfed = curr.open <= prev.close && curr.close >= prev.open;
    const isDowntrend = this.isPriorDowntrend(candles, 2);

    if (prevBearish && currBullish && bodyEngulfed && isDowntrend) {
      return {
        patternCode: 'PA-07',
        patternName: 'Bullish Engulfing (5m Bullish Reversal)',
        direction: 'BUY',
        confidence: 0.88,
        matchedCandleTimestamp: curr.timestamp,
        explanation: '5m green candle body completely engulfs prior red candle body after a downtrend.',
      };
    }
    return null;
  }

  /**
   * 8. Bearish Engulfing (Bearish on 5m)
   */
  public static checkBearishEngulfing(candles: MarketCandle[]): PatternMatchResult | null {
    if (candles.length < 3) return null;
    const curr = candles[candles.length - 1];
    const prev = candles[candles.length - 2];

    const prevBullish = prev.close > prev.open;
    const currBearish = curr.close < curr.open;

    // Current body engulfs prior body
    const bodyEngulfed = curr.open >= prev.close && curr.close <= prev.open;
    const isUptrend = this.isPriorUptrend(candles, 2);

    if (prevBullish && currBearish && bodyEngulfed && isUptrend) {
      return {
        patternCode: 'PA-08',
        patternName: 'Bearish Engulfing (5m Bearish Reversal)',
        direction: 'SELL',
        confidence: 0.88,
        matchedCandleTimestamp: curr.timestamp,
        explanation: '5m red candle body completely engulfs prior green candle body after an uptrend.',
      };
    }
    return null;
  }

  /**
   * Evaluate all 8 patterns on the given 5m closed candles
   */
  public static evaluateAll(candles: MarketCandle[]): PatternMatchResult[] {
    const results: PatternMatchResult[] = [];
    const checks = [
      this.checkHammer(candles),
      this.checkShootingStar(candles),
      this.checkThreeWhiteSoldiers(candles),
      this.checkThreeBlackCrows(candles),
      this.checkBullishMarubozu(candles),
      this.checkBearishMarubozu(candles),
      this.checkBullishEngulfing(candles),
      this.checkBearishEngulfing(candles),
    ];

    for (const match of checks) {
      if (match) results.push(match);
    }
    return results;
  }
}
