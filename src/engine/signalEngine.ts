import type { MarketCandle } from '../services/growwService';
import { CandlestickPatternEvaluator, type PatternMatchResult } from './candlestickPatterns';
import { PivotCalculator, type PivotLevels, type TradeLevels } from './pivotCalculator';
import type { TradingCondition } from '../types/rules';

export type SignalType = 'BUY' | 'SELL' | 'WAIT' | 'NO_DATA';

export interface EvaluatedSignal {
  instrument: 'NIFTY 50' | 'BANK NIFTY';
  signalType: SignalType;
  candleTimestamp: number;
  candleDateTimeIST: string;
  ruleVersion: number;
  deduplicationKey: string;
  matchedConditions: string[];
  failedConditions: string[];
  explanation: {
    decision: string;
    vixStatus: string;
    vixValue?: number;
    patterns: PatternMatchResult[];
    reasons: string[];
  };
  levels?: TradeLevels;
  status: 'ACTIVE' | 'INVALIDATED' | 'COMPLETED';
}

export interface EngineContext {
  candles: MarketCandle[];
  vix?: number | null;
  advances?: number | null;
  declines?: number | null;
  prevDayHigh: number;
  prevDayLow: number;
  prevDayClose: number;
  activeConditions: TradingCondition[];
  riskPauseActive?: boolean; // 1-2 day cool-off pause toggle
  forceMarketHoursCheck?: boolean;
}

export class SignalEngine {
  /**
   * Helper: Check if current time is within Indian Market Hours (09:15 to 15:30 IST)
   */
  public static isMarketHours(): boolean {
    const now = new Date();
    // Convert to IST
    const istString = now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });
    const istDate = new Date(istString);
    const day = istDate.getDay(); // 0 is Sunday, 6 is Saturday

    // Monday to Friday only
    if (day === 0 || day === 6) return false;

    const hours = istDate.getHours();
    const minutes = istDate.getMinutes();
    const totalMinutes = hours * 60 + minutes;

    const marketOpen = 9 * 60 + 15;  // 09:15 IST
    const marketClose = 15 * 60 + 30; // 15:30 IST

    return totalMinutes >= marketOpen && totalMinutes <= marketClose;
  }

  /**
   * Main Evaluation Pipeline: 5m Closed Candles -> Rules -> Decision
   */
  public static evaluate(
    instrument: 'NIFTY 50' | 'BANK NIFTY',
    context: EngineContext
  ): EvaluatedSignal {
    const {
      candles,
      vix,
      advances,
      declines,
      prevDayHigh,
      prevDayLow,
      prevDayClose,
      riskPauseActive = false,
      forceMarketHoursCheck = true,
    } = context;

    // RULE 1: If data is missing or empty -> NO DATA (Never fake or mock data)
    if (!candles || candles.length < 5) {
      return {
        instrument,
        signalType: 'NO_DATA',
        candleTimestamp: Math.floor(Date.now() / 1000),
        candleDateTimeIST: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
        ruleVersion: 1,
        deduplicationKey: `${instrument}_NO_DATA_${Date.now()}`,
        matchedConditions: [],
        failedConditions: ['SUFFICIENT_5M_CANDLES_REQUIRED'],
        explanation: {
          decision: 'NO DATA: Insufficient 5-minute closed candles available.',
          vixStatus: 'UNKNOWN',
          patterns: [],
          reasons: ['Waiting for real-time 5m candle feed from broker API.'],
        },
        status: 'ACTIVE',
      };
    }

    const latestClosedCandle = candles[candles.length - 1];
    const candleTimestamp = latestClosedCandle.timestamp;
    const candleDateTimeIST = latestClosedCandle.datetime;
    const deduplicationKey = `${instrument}_5M_${candleTimestamp}_V1`;

    const matchedConditions: string[] = [];
    const failedConditions: string[] = [];
    const reasons: string[] = [];

    // RULE 2: Market hours check (if enabled)
    if (forceMarketHoursCheck && !this.isMarketHours()) {
      return {
        instrument,
        signalType: 'WAIT',
        candleTimestamp,
        candleDateTimeIST,
        ruleVersion: 1,
        deduplicationKey,
        matchedConditions,
        failedConditions: ['OUTSIDE_MARKET_HOURS'],
        explanation: {
          decision: 'WAIT: Outside NSE market hours (09:15 - 15:30 IST).',
          vixStatus: vix ? `${vix.toFixed(2)}` : 'N/A',
          patterns: [],
          reasons: ['Signals are evaluated exclusively during 09:15 - 15:30 IST.'],
        },
        status: 'ACTIVE',
      };
    }

    // RULE 3: Cool-off Pause (Post-Loss / Post-Profit Gap from Screenshot 2)
    if (riskPauseActive) {
      return {
        instrument,
        signalType: 'WAIT',
        candleTimestamp,
        candleDateTimeIST,
        ruleVersion: 1,
        deduplicationKey,
        matchedConditions,
        failedConditions: ['RF-03/RF-04: Cool-off Pause Active'],
        explanation: {
          decision: 'WAIT: Risk cool-off pause is currently active.',
          vixStatus: vix ? `${vix.toFixed(2)}` : 'N/A',
          patterns: [],
          reasons: ['Cool-off pause active following recent trading rule.'],
        },
        status: 'ACTIVE',
      };
    }

    // RULE 4: India VIX Filters (Screenshot 2: VIX < 10 -> Sideways -> No Trade)
    let vixStatus = 'NORMAL';
    if (vix !== undefined && vix !== null) {
      if (vix < 10.0) {
        failedConditions.push('VX-01: India VIX Below 10');
        return {
          instrument,
          signalType: 'WAIT',
          candleTimestamp,
          candleDateTimeIST,
          ruleVersion: 1,
          deduplicationKey,
          matchedConditions,
          failedConditions,
          explanation: {
            decision: 'WAIT: India VIX < 10 indicates range-bound sideways market.',
            vixStatus: 'SIDEWAYS (< 10)',
            vixValue: vix,
            patterns: [],
            reasons: ['Rule from whiteboard: When VIX is below 10, market is sideways. Avoid trading.'],
          },
          status: 'ACTIVE',
        };
      } else if (vix >= 14.5) {
        vixStatus = 'HIGH_VOLATILITY (>= 14-15)';
        matchedConditions.push('VX-03: Big Moves Expected');
      } else {
        vixStatus = 'STABLE (10 - 14)';
        matchedConditions.push('VX-02: Stable Market Regime');
      }
    }

    // RULE 5: Market Breadth (Advances vs Declines from Screenshot 1)
    let breadthBias: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
    if (advances !== undefined && declines !== undefined && advances !== null && declines !== null) {
      if (advances > declines) {
        breadthBias = 'BULLISH';
        matchedConditions.push('MB-01: Advances > Declines');
      } else if (declines > advances) {
        breadthBias = 'BEARISH';
        matchedConditions.push('MB-02: Declines > Advances');
      }
    }

    // RULE 6: 8 Candlestick Patterns on 5m Closed Candles
    const detectedPatterns = CandlestickPatternEvaluator.evaluateAll(candles);

    if (detectedPatterns.length === 0) {
      return {
        instrument,
        signalType: 'WAIT',
        candleTimestamp,
        candleDateTimeIST,
        ruleVersion: 1,
        deduplicationKey,
        matchedConditions,
        failedConditions: ['NO_PATTERN_MATCHED'],
        explanation: {
          decision: 'WAIT: No valid 5m price action candlestick pattern formed.',
          vixStatus,
          vixValue: vix || undefined,
          patterns: [],
          reasons: ['Awaiting confirmation pattern on closed 5m candle.'],
        },
        status: 'ACTIVE',
      };
    }

    // Determine direction from pattern
    const primaryPattern = detectedPatterns[0];
    const direction = primaryPattern.direction;
    matchedConditions.push(`${primaryPattern.patternCode}: ${primaryPattern.patternName}`);
    reasons.push(primaryPattern.explanation);

    // Filter check: If breadth contradicts pattern, record caution
    if (breadthBias === 'BEARISH' && direction === 'BUY') {
      reasons.push('Note: Market breadth is currently net-negative (Declines > Advances).');
    } else if (breadthBias === 'BULLISH' && direction === 'SELL') {
      reasons.push('Note: Market breadth is currently net-positive (Advances > Declines).');
    }

    // Calculate Trade Levels using Pivot Framework
    const pivots: PivotLevels = PivotCalculator.calculatePivots(prevDayHigh, prevDayLow, prevDayClose);
    const levels = PivotCalculator.deriveTradeLevels(
      direction,
      latestClosedCandle.close,
      latestClosedCandle.low,
      latestClosedCandle.high,
      pivots
    );

    return {
      instrument,
      signalType: direction,
      candleTimestamp,
      candleDateTimeIST,
      ruleVersion: 1,
      deduplicationKey,
      matchedConditions,
      failedConditions,
      explanation: {
        decision: `${direction} signal confirmed by ${primaryPattern.patternName}.`,
        vixStatus,
        vixValue: vix || undefined,
        patterns: detectedPatterns,
        reasons,
      },
      levels,
      status: 'ACTIVE',
    };
  }
}
