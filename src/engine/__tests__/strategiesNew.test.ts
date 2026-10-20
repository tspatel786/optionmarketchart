import { describe, it, expect } from 'vitest';
import { StrategyRegistry } from '../strategyRegistry';
import { IndicatorCalculator } from '../indicators';
import { PivotCalculator } from '../pivotCalculator';
import type { MarketCandle } from '../../services/growwService';

describe('12 Additional Strategies (21 through 32)', () => {
  const dummyPivots = PivotCalculator.calculatePivots(23200, 22800, 23000);

  it('Strategy 21: Generates BUY_CE on solid candle closing above Upper Keltner Channel with Bullish Supertrend', () => {
    const candles: MarketCandle[] = Array.from({ length: 25 }, (_, i) => ({
      timestamp: 1000 + i * 300,
      datetime: `2026-10-21 09:${15 + i * 5}`,
      open: 23000 + i * 20,
      high: 23010 + i * 20,
      low: 22995 + i * 20,
      close: 23008 + i * 20,
      volume: 1000,
      isClosed: true,
    }));

    // Solid breakout candle closing well above upper band
    candles.push({
      timestamp: 1000 + 25 * 300,
      datetime: '2026-10-21 11:20',
      open: 23510,
      high: 23580,
      low: 23505,
      close: 23575,
      volume: 2500,
      isClosed: true,
    });

    const snap = IndicatorCalculator.getSnapshot(candles);
    const result = StrategyRegistry.evaluateStrategy21_KeltnerBreakout(candles, snap, dummyPivots);

    expect(result.strategyId).toBe(21);
    expect(result.action).toBe('BUY_CE');
    expect(result.ruleTriggered).toContain('Keltner Channel');
    expect(result.target1_5R).toBeGreaterThan(23575);
  });

  it('Strategy 24: Detects Bullish Liquidity Sweep (Swept below prior low, closed back inside)', () => {
    const candles: MarketCandle[] = [
      { timestamp: 1000, datetime: '09:15', open: 23100, high: 23120, low: 23050, close: 23080, volume: 500, isClosed: true },
      { timestamp: 1300, datetime: '09:20', open: 23080, high: 23090, low: 23000, close: 23020, volume: 500, isClosed: true }, // prior low 23000
      { timestamp: 1600, datetime: '09:25', open: 23020, high: 23060, low: 23010, close: 23050, volume: 500, isClosed: true },
      { timestamp: 1900, datetime: '09:30', open: 23050, high: 23070, low: 23030, close: 23060, volume: 500, isClosed: true },
      // Sweep candle: Pierces 23000 down to 22960, but closes back firmly at 23035!
      { timestamp: 2200, datetime: '09:35', open: 23030, high: 23040, low: 22960, close: 23035, volume: 1500, isClosed: true },
    ];

    const snap = IndicatorCalculator.getSnapshot(candles);
    const result = StrategyRegistry.evaluateStrategy24_LiquiditySweep(candles, snap, dummyPivots);

    expect(result.strategyId).toBe(24);
    expect(result.action).toBe('BUY_CE');
    expect(result.ruleTriggered).toContain('Bullish Liquidity Sweep');
  });

  it('Strategy 26: Disables when volume data is zero/missing', () => {
    const candles: MarketCandle[] = [
      { timestamp: 1000, datetime: '09:15', open: 23000, high: 23050, low: 22980, close: 23020, volume: 0, isClosed: true },
      { timestamp: 1300, datetime: '09:20', open: 23020, high: 23060, low: 23010, close: 23050, volume: 0, isClosed: true },
    ];

    const snap = IndicatorCalculator.getSnapshot(candles);
    const result = StrategyRegistry.evaluateStrategy26_VolumeBreakout(candles, snap, dummyPivots);

    expect(result.strategyId).toBe(26);
    expect(result.action).toBe('WAIT');
    expect(result.ruleTriggered).toContain('Volume data unavailable or zero');
  });

  it('Strategy 30: Adaptive Trailing Stop trails to Target 1 (1R profit guaranteed) at 2R', () => {
    const result = StrategyRegistry.evaluateStrategy30_AdaptiveTrailingStop(
      2.1, // 2.1R profit reached
      23000, // Entry
      22950, // Initial SL (50 pts risk)
      25,    // ATR
      'BUY'
    );

    expect(result.trailedStopLoss).toBe(23050); // Locked at +1R (23000 + 50)
    expect(result.rule).toContain('Target 1 (1R profit guaranteed)');
  });

  it('Strategy 31: Event-Risk Filter locks out trading around RBI Policy announcement', () => {
    // 2026-02-06 at 10:05 IST (5 mins after 10:00 AM RBI MPC)
    const policyDate = new Date('2026-02-06T10:05:00+05:30');
    const check = StrategyRegistry.evaluateStrategy31_EventRiskFilter(policyDate);

    expect(check.isEventActive).toBe(true);
    expect(check.eventName).toContain('RBI Monetary Policy');
    expect(check.action).toBe('LOCKOUT');
  });

  it('Strategy 32: Regime-Aware Selector selects proven trend strategy in Bullish Regime', () => {
    const candles: MarketCandle[] = Array.from({ length: 25 }, (_, i) => ({
      timestamp: 1000 + i * 300,
      datetime: `2026-10-21 09:${15 + i * 5}`,
      open: 23000 + i * 25,
      high: 23020 + i * 25,
      low: 22995 + i * 25,
      close: 23018 + i * 25,
      volume: 1200 + i * 50,
      isClosed: true,
    }));

    const snap = IndicatorCalculator.getSnapshot(candles);
    const result = StrategyRegistry.evaluateStrategy32_RegimeAwareSelector(
      candles,
      snap,
      dummyPivots,
      23650,
      23000,
      14.0
    );

    expect(result.strategyId).toBe(32);
    expect(result.action).toBe('BUY_CE');
    expect(result.confidence).toBeGreaterThanOrEqual(80);
    expect(result.ruleTriggered).toContain('TRENDING_BULL');
  });
});
