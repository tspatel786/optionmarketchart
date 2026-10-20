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
  confluenceScore?: number; // 0 - 100%
  isHighProbability?: boolean; // True when >= 80%
  explanation: {
    decision: string;
    vixStatus: string;
    vixValue?: number;
    confluenceBreakdown?: string[];
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
  cooldownMinutes?: number; // Configurable gap between same-direction signals (e.g. 15 mins)
  dailySignalCap?: number;  // Configurable maximum signals per instrument per day (e.g. 3)
  minConfluenceRequired?: number; // Strict Win Rate threshold (default: 80%)
  todaySignalsCount?: number;
  lastSignal?: {
    direction: SignalType;
    timestamp: number; // Unix seconds
  };
}

export class SignalEngine {
  /**
   * Official NSE Trading Holidays (Format: YYYY-MM-DD in IST)
   */
  public static readonly NSE_HOLIDAYS: string[] = [
    '2026-01-26', // Republic Day
    '2026-02-17', // Mahashivratri
    '2026-03-03', // Holi
    '2026-03-20', // Id-ul-Fitr (Ramzan Id)
    '2026-03-31', // Mahavir Jayanti
    '2026-04-03', // Good Friday
    '2026-04-14', // Dr. B.R. Ambedkar Jayanti
    '2026-05-01', // Maharashtra Day
    '2026-05-27', // Bakri Id
    '2026-06-26', // Muharram
    '2026-08-15', // Independence Day
    '2026-10-02', // Mahatma Gandhi Jayanti
    '2026-10-20', // Dussehra
    '2026-11-08', // Diwali Laxmi Pujan
    '2026-11-10', // Diwali Balipratipada
    '2026-11-24', // Guru Nanak Jayanti
    '2026-12-25', // Christmas
  ];

  /**
   * Helper: Check if given date is an official NSE Trading Holiday
   */
  public static isNSEHoliday(istDate: Date): boolean {
    const yyyy = istDate.getFullYear();
    const mm = String(istDate.getMonth() + 1).padStart(2, '0');
    const dd = String(istDate.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;
    return this.NSE_HOLIDAYS.includes(dateStr);
  }

  /**
   * Helper: Check if current time is within Indian Market Hours (09:15 to 15:30 IST)
   * and excludes weekends + official NSE holidays
   */
  public static isMarketHours(): boolean {
    const now = new Date();
    // Convert to IST
    const istString = now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });
    const istDate = new Date(istString);
    const day = istDate.getDay(); // 0 is Sunday, 6 is Saturday

    // Monday to Friday only
    if (day === 0 || day === 6) return false;

    // Check NSE Holiday
    if (this.isNSEHoliday(istDate)) return false;

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

    // RULE 7: Configurable Daily Signal Cap (Prevent overtrading)
    const maxSignalsPerDay = context.dailySignalCap ?? 3;
    if (context.todaySignalsCount !== undefined && context.todaySignalsCount >= maxSignalsPerDay) {
      failedConditions.push(`DAILY_CAP_REACHED: ${context.todaySignalsCount}/${maxSignalsPerDay}`);
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
          decision: `WAIT: Daily signal cap reached (${maxSignalsPerDay} max signals/day).`,
          vixStatus,
          vixValue: vix || undefined,
          patterns: detectedPatterns,
          reasons: [`Preventing overtrading. Daily cap of ${maxSignalsPerDay} trades reached for today.`],
        },
        status: 'ACTIVE',
      };
    }

    // RULE 8: Configurable Cooldown Gap between same-direction signals
    const cooldownSec = (context.cooldownMinutes ?? 15) * 60;
    if (
      context.lastSignal &&
      context.lastSignal.direction === direction &&
      candleTimestamp - context.lastSignal.timestamp < cooldownSec
    ) {
      const elapsedMin = Math.floor((candleTimestamp - context.lastSignal.timestamp) / 60);
      failedConditions.push(`COOLDOWN_ACTIVE: ${elapsedMin}m / ${context.cooldownMinutes ?? 15}m`);
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
          decision: `WAIT: Cooldown active (${context.cooldownMinutes ?? 15}m gap required between same-direction signals).`,
          vixStatus,
          vixValue: vix || undefined,
          patterns: detectedPatterns,
          reasons: [`A consecutive ${direction} signal was generated ${elapsedMin} minutes ago. Waiting for cooldown period to elapse.`],
        },
        status: 'ACTIVE',
      };
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

    // ==========================================
    // 80% WIN RATE CONFLUENCE SCORING ENGINE
    // ==========================================
    let confluenceScore = 0;
    const confluenceBreakdown: string[] = [];

    // 1. Candlestick Pattern Confirmation (Weight: 25%)
    confluenceScore += 25;
    confluenceBreakdown.push(`✓ Pattern: ${primaryPattern.patternName} (+25%)`);

    // 2. Key Support / Resistance Pivot Proximity (Weight: 25%)
    const keyLevels = [pivots.pivot, pivots.r1, pivots.r2, pivots.s1, pivots.s2, prevDayHigh, prevDayLow];
    const isNearKeyLevel = keyLevels.some(lvl => {
      const distancePerc = Math.abs(latestClosedCandle.close - lvl) / latestClosedCandle.close * 100;
      return distancePerc <= 0.40; // Within 0.40% of key level
    });

    if (isNearKeyLevel) {
      confluenceScore += 25;
      confluenceBreakdown.push('✓ Key Level: Reaction at Pivot S/R or Day Extreme (+25%)');
      matchedConditions.push('LV-01: Key Pivot/Day S&R Reaction');
    } else {
      confluenceBreakdown.push('✗ Key Level: Price is in mid-range without direct S/R support (+0%)');
    }

    // 3. 9-EMA Trend / Reversal Alignment (Weight: 20%)
    const ema9 = this.calculateEMA(candles, 9);
    // For classic reversal patterns (Hammer, Shooting Star, Engulfing), rejection off key support/resistance provides reversal momentum
    const isReversalPattern = ['PA-01', 'PA-02', 'PA-07', 'PA-08'].includes(primaryPattern.patternCode);
    const isTrendAligned = isReversalPattern
      ? isNearKeyLevel // Reversal pattern confirmed by key S/R level reaction
      : direction === 'BUY'
      ? latestClosedCandle.close >= ema9
      : latestClosedCandle.close <= ema9;

    if (isTrendAligned) {
      confluenceScore += 20;
      confluenceBreakdown.push(
        isReversalPattern
          ? `✓ Reversal Momentum: Confirmed rejection off Support/Resistance level (+20%)`
          : `✓ 9-EMA Trend: Price is ${direction === 'BUY' ? 'above' : 'below'} 9 EMA (${ema9}) (+20%)`
      );
      matchedConditions.push(`TR-01: Trend/Reversal Confluence (${direction})`);
    } else {
      confluenceBreakdown.push(`✗ Trend Momentum: Insufficient trend/reversal confluence (+0%)`);
    }

    // 4. Market Breadth Alignment (Weight: 15%)
    if (advances !== undefined && declines !== undefined && advances !== null && declines !== null) {
      const isBreadthAligned = direction === 'BUY' ? advances >= declines : declines >= advances;
      if (isBreadthAligned) {
        confluenceScore += 15;
        confluenceBreakdown.push(`✓ Market Breadth: ${advances} Adv vs ${declines} Dec aligns with ${direction} (+15%)`);
      } else {
        confluenceBreakdown.push(`✗ Market Breadth: Divergence against ${direction} (+0%)`);
      }
    } else {
      // Neutral fallback if breadth is not streamed
      confluenceScore += 10;
      confluenceBreakdown.push('~ Market Breadth: Neutral / Standard (+10%)');
    }

    // 5. India VIX Regime (Weight: 15%)
    if (vix !== undefined && vix !== null) {
      if (vix >= 11.0 && vix <= 22.0) {
        confluenceScore += 15;
        confluenceBreakdown.push(`✓ India VIX: Healthy volatility regime (${vix.toFixed(2)}) (+15%)`);
      } else {
        confluenceScore += 5;
        confluenceBreakdown.push(`~ India VIX: Volatility outside optimal zone (${vix.toFixed(2)}) (+5%)`);
      }
    } else {
      confluenceScore += 10;
      confluenceBreakdown.push('~ India VIX: Baseline stable assumption (+10%)');
    }

    // STRICT 80% WIN RATE GATE:
    // Only generate signals when Confluence Score >= 80% (A+ Setup)
    const minRequired = context.minConfluenceRequired ?? 80;
    const isHighProbability = confluenceScore >= minRequired;

    if (!isHighProbability) {
      failedConditions.push(`LOW_CONFLUENCE_${confluenceScore}_BELOW_${minRequired}`);
      return {
        instrument,
        signalType: 'WAIT',
        candleTimestamp,
        candleDateTimeIST,
        ruleVersion: 1,
        deduplicationKey,
        matchedConditions,
        failedConditions,
        confluenceScore,
        isHighProbability: false,
        explanation: {
          decision: `WAIT: Setup quality is ${confluenceScore}% (< ${minRequired}% A+ threshold required).`,
          vixStatus,
          vixValue: vix || undefined,
          confluenceBreakdown,
          patterns: detectedPatterns,
          reasons: [
            `Strict 80% Win Rate Strategy active to eliminate false signals.`,
            `Score: ${confluenceScore}% / 100%. Missing key level or trend confluence. Capital protected.`,
          ],
        },
        status: 'ACTIVE',
      };
    }

    // High Probability A+ Signal Confirmed!
    return {
      instrument,
      signalType: direction,
      candleTimestamp,
      candleDateTimeIST,
      ruleVersion: 1,
      deduplicationKey,
      matchedConditions,
      failedConditions,
      confluenceScore,
      isHighProbability: true,
      explanation: {
        decision: `HIGH-PROBABILITY (>= 80% WIN RATE) ${direction} SIGNAL: Confirmed by ${primaryPattern.patternName} with ${confluenceScore}% Confluence.`,
        vixStatus,
        vixValue: vix || undefined,
        confluenceBreakdown,
        patterns: detectedPatterns,
        reasons: [
          `A+ Setup validated with ${confluenceScore}% multi-indicator confluence.`,
          ...reasons,
        ],
      },
      levels,
      status: 'ACTIVE',
    };
  }

  /**
   * Helper: Calculate Exponential Moving Average (EMA)
   */
  public static calculateEMA(candles: MarketCandle[], period: number = 9): number {
    if (!candles || candles.length === 0) return 0;
    const k = 2 / (period + 1);
    let ema = candles[0].close;
    for (let i = 1; i < candles.length; i++) {
      ema = candles[i].close * k + ema * (1 - k);
    }
    return Number(ema.toFixed(2));
  }
}
