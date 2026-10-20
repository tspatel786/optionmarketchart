import { describe, it, expect } from 'vitest';
import { SignalEngine, type EngineContext } from '../signalEngine';
import { PivotCalculator } from '../pivotCalculator';
import type { MarketCandle } from '../../services/growwService';

describe('SignalEngine & Rules Evaluation (5m Closed Candles)', () => {
  const baseContext: EngineContext = {
    candles: [],
    vix: 13.5,
    advances: 1400,
    declines: 600,
    prevDayHigh: 23200,
    prevDayLow: 22800,
    prevDayClose: 23000,
    activeConditions: [],
    riskPauseActive: false,
    forceMarketHoursCheck: false, // Disabled for synthetic deterministic unit tests
  };

  it('RULE: Returns NO_DATA when candles are missing or insufficient (Never fake data)', () => {
    const result = SignalEngine.evaluate('NIFTY 50', {
      ...baseContext,
      candles: [],
    });

    expect(result.signalType).toBe('NO_DATA');
    expect(result.explanation.decision).toContain('NO DATA');
  });

  it('RULE: Returns WAIT when India VIX < 10.0 (Sideways Market Filter)', () => {
    const dummyCandles: MarketCandle[] = [
      { timestamp: 1000, datetime: '2026-10-20 09:15', open: 23000, high: 23050, low: 22980, close: 23020, volume: 100, isClosed: true },
      { timestamp: 1300, datetime: '2026-10-20 09:20', open: 23020, high: 23060, low: 23010, close: 23050, volume: 120, isClosed: true },
      { timestamp: 1600, datetime: '2026-10-20 09:25', open: 23050, high: 23070, low: 23040, close: 23060, volume: 110, isClosed: true },
      { timestamp: 1900, datetime: '2026-10-20 09:30', open: 23060, high: 23080, low: 23050, close: 23070, volume: 130, isClosed: true },
      { timestamp: 2200, datetime: '2026-10-20 09:35', open: 23070, high: 23090, low: 23060, close: 23080, volume: 140, isClosed: true },
    ];

    const result = SignalEngine.evaluate('NIFTY 50', {
      ...baseContext,
      candles: dummyCandles,
      vix: 9.4, // Below 10
    });

    expect(result.signalType).toBe('WAIT');
    expect(result.explanation.vixStatus).toContain('SIDEWAYS (< 10)');
    expect(result.failedConditions).toContain('VX-01: India VIX Below 10');
  });

  it('RULE: Returns WAIT when Post-Loss / Post-Profit Cool-off Pause is Active', () => {
    const dummyCandles: MarketCandle[] = [
      { timestamp: 1000, datetime: '2026-10-20 09:15', open: 23000, high: 23050, low: 22980, close: 23020, volume: 100, isClosed: true },
      { timestamp: 1300, datetime: '2026-10-20 09:20', open: 23020, high: 23060, low: 23010, close: 23050, volume: 120, isClosed: true },
      { timestamp: 1600, datetime: '2026-10-20 09:25', open: 23050, high: 23070, low: 23040, close: 23060, volume: 110, isClosed: true },
      { timestamp: 1900, datetime: '2026-10-20 09:30', open: 23060, high: 23080, low: 23050, close: 23070, volume: 130, isClosed: true },
      { timestamp: 2200, datetime: '2026-10-20 09:35', open: 23070, high: 23090, low: 23060, close: 23080, volume: 140, isClosed: true },
    ];

    const result = SignalEngine.evaluate('NIFTY 50', {
      ...baseContext,
      candles: dummyCandles,
      vix: 13.0,
      riskPauseActive: true, // Cool-off pause enabled
    });

    expect(result.signalType).toBe('WAIT');
    expect(result.failedConditions).toContain('RF-03/RF-04: Cool-off Pause Active');
  });

  it('RULE: Generates BUY signal on 5m Hammer with Pivot Levels & Stop Loss', () => {
    // Synthetic candles leading to a Hammer:
    // Downtrend: 23150 -> 23100 -> 23050 -> 23000
    // Hammer candle: open: 22960, high: 22965, low: 22880, close: 22962 (body: 2, lower wick: 80 >= 2*body)
    const hammerCandles: MarketCandle[] = [
      { timestamp: 1000, datetime: '09:15', open: 23200, high: 23220, low: 23140, close: 23150, volume: 100, isClosed: true },
      { timestamp: 1300, datetime: '09:20', open: 23150, high: 23160, low: 23090, close: 23100, volume: 120, isClosed: true },
      { timestamp: 1600, datetime: '09:25', open: 23100, high: 23110, low: 23040, close: 23050, volume: 110, isClosed: true },
      { timestamp: 1900, datetime: '09:30', open: 23050, high: 23060, low: 22980, close: 22990, volume: 130, isClosed: true },
      { timestamp: 2200, datetime: '09:35', open: 22960, high: 22965, low: 22880, close: 22962, volume: 250, isClosed: true },
    ];

    const result = SignalEngine.evaluate('NIFTY 50', {
      ...baseContext,
      candles: hammerCandles,
      vix: 14.8,
      minConfluenceRequired: 70,
    });

    expect(result.signalType).toBe('BUY');
    expect(result.explanation.decision).toContain('BUY');
    expect(result.matchedConditions.some(c => c.includes('PA-01'))).toBe(true);
    expect(result.levels).toBeDefined();
    if (result.levels) {
      expect(result.levels.entryPrice).toBe(22962);
      expect(result.levels.stopLoss).toBeLessThanOrEqual(22880); // At or below candle low
      expect(result.levels.target1).toBeGreaterThan(result.levels.entryPrice);
    }
  });

  it('RULE: Generates SELL signal on 5m Shooting Star with Stop Loss', () => {
    // Uptrend: 22900 -> 22950 -> 23000 -> 23050
    // Shooting Star candle: open: 23050, high: 23150, low: 23045, close: 23048 (upper wick: 100 >= 2*body)
    const shootingStarCandles: MarketCandle[] = [
      { timestamp: 1000, datetime: '09:15', open: 22900, high: 22960, low: 22890, close: 22950, volume: 100, isClosed: true },
      { timestamp: 1300, datetime: '09:20', open: 22950, high: 23010, low: 22940, close: 23000, volume: 120, isClosed: true },
      { timestamp: 1600, datetime: '09:25', open: 23000, high: 23060, low: 22990, close: 23050, volume: 110, isClosed: true },
      { timestamp: 1900, datetime: '09:30', open: 23050, high: 23070, low: 23030, close: 23060, volume: 130, isClosed: true },
      { timestamp: 2200, datetime: '09:35', open: 23050, high: 23150, low: 23045, close: 23048, volume: 220, isClosed: true },
    ];

    const result = SignalEngine.evaluate('BANK NIFTY', {
      ...baseContext,
      candles: shootingStarCandles,
      vix: 13.2,
      minConfluenceRequired: 70,
    });

    expect(result.signalType).toBe('SELL');
    expect(result.explanation.decision).toContain('SELL');
    expect(result.matchedConditions.some(c => c.includes('PA-02'))).toBe(true);
    expect(result.levels).toBeDefined();
    if (result.levels) {
      expect(result.levels.entryPrice).toBe(23048);
      expect(result.levels.stopLoss).toBeGreaterThanOrEqual(23150); // At or above candle high
      expect(result.levels.target1).toBeLessThan(result.levels.entryPrice);
    }
  });

  it('RULE: Strict 80% Win Rate Filter blocks marginal setups (< 80% confluence)', () => {
    const candles: MarketCandle[] = [
      { timestamp: 1000, datetime: '09:15', open: 23200, high: 23220, low: 23140, close: 23150, volume: 100, isClosed: true },
      { timestamp: 1300, datetime: '09:20', open: 23150, high: 23160, low: 23090, close: 23100, volume: 120, isClosed: true },
      { timestamp: 1600, datetime: '09:25', open: 23100, high: 23110, low: 23040, close: 23050, volume: 110, isClosed: true },
      { timestamp: 1900, datetime: '09:30', open: 23050, high: 23060, low: 22980, close: 22990, volume: 130, isClosed: true },
      { timestamp: 2200, datetime: '09:35', open: 22960, high: 22965, low: 22880, close: 22962, volume: 250, isClosed: true },
    ];

    // Evaluate with contradictory breadth and no S/R level nearby (marginal low-quality setup)
    const result = SignalEngine.evaluate('NIFTY 50', {
      ...baseContext,
      candles,
      vix: 14.8,
      advances: 400, // Negative breadth
      declines: 1600,
      prevDayHigh: 25000, // Far away from price 22962
      prevDayLow: 24000,
      prevDayClose: 24500,
      minConfluenceRequired: 80,
    });

    // Score is below 80%, so engine must return WAIT to protect capital
    expect(result.signalType).toBe('WAIT');
    expect(result.isHighProbability).toBe(false);
    expect(result.explanation.decision).toContain('WAIT: Setup quality is');
  });

  it('RULE: Deduplication key is deterministic and identical for same candle', () => {
    const candles: MarketCandle[] = [
      { timestamp: 1000, datetime: '09:15', open: 23000, high: 23050, low: 22980, close: 23020, volume: 100, isClosed: true },
      { timestamp: 1300, datetime: '09:20', open: 23020, high: 23060, low: 23010, close: 23050, volume: 120, isClosed: true },
      { timestamp: 1600, datetime: '09:25', open: 23050, high: 23070, low: 23040, close: 23060, volume: 110, isClosed: true },
      { timestamp: 1900, datetime: '09:30', open: 23060, high: 23080, low: 23050, close: 23070, volume: 130, isClosed: true },
      { timestamp: 2200, datetime: '09:35', open: 23070, high: 23090, low: 23060, close: 23080, volume: 140, isClosed: true },
    ];

    const res1 = SignalEngine.evaluate('NIFTY 50', { ...baseContext, candles });
    const res2 = SignalEngine.evaluate('NIFTY 50', { ...baseContext, candles });

    expect(res1.deduplicationKey).toBe(res2.deduplicationKey);
    expect(res1.deduplicationKey).toBe('NIFTY 50_5M_2200_V1');
  });

  it('CALCULATION: Pivot points accurately compute P, R1, R2, S1, S2', () => {
    // Example: H = 23160, L = 22700, C = 22997 (from user "Kal Ke Levels" sheet)
    const p = PivotCalculator.calculatePivots(23160, 22700, 22997);
    // P = (23160 + 22700 + 22997) / 3 = 68857 / 3 = 22952.33
    expect(p.pivot).toBe(22952.33);
    // R1 = 2 * 22952.33 - 22700 = 45904.66 - 22700 = 23204.66
    expect(p.r1).toBe(23204.66);
    // S1 = 2 * 22952.33 - 23160 = 45904.66 - 23160 = 22744.66
    expect(p.s1).toBe(22744.66);
  });
});
