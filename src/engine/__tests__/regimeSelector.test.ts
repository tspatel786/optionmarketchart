import { describe, it, expect } from 'vitest';
import { RegimeSelector } from '../regimeSelector';
import { IndicatorCalculator } from '../indicators';
import { PivotCalculator } from '../pivotCalculator';
import type { MarketCandle } from '../../services/growwService';

describe('RegimeSelector: Market Regime Classification', () => {
  const dummyPivots = PivotCalculator.calculatePivots(23200, 22800, 23000);

  it('Classifies VOLATILE_CHOP when India VIX is in extreme territory (> 22)', () => {
    // 15 flat candles
    const candles: MarketCandle[] = Array.from({ length: 15 }, (_, i) => ({
      timestamp: 1000 + i * 300,
      datetime: `2026-10-21 09:${15 + i * 5}`,
      open: 23000,
      high: 23050,
      low: 22950,
      close: 23000,
      volume: 500,
      isClosed: true,
    }));

    const snap = IndicatorCalculator.getSnapshot(candles);
    const result = RegimeSelector.classify(candles, snap, dummyPivots, 24.5);

    expect(result.regime).toBe('VOLATILE_CHOP');
    expect(result.volatilityLevel).toBe('EXTREME');
    expect(result.favoredStrategies).toContain(20);
    expect(result.prohibitedStrategies).toContain(1); // Standard breakouts disabled
  });

  it('Classifies TRENDING_BULL when price, EMAs, Supertrend, and ADX are aligned', () => {
    // 25 steadily rising candles
    const candles: MarketCandle[] = Array.from({ length: 25 }, (_, i) => {
      const base = 23000 + i * 15;
      return {
        timestamp: 1000 + i * 300,
        datetime: `2026-10-21 09:${15 + i * 5}`,
        open: base - 5,
        high: base + 20,
        low: base - 10,
        close: base + 15,
        volume: 1000 + i * 50,
        isClosed: true,
      };
    });

    const snap = IndicatorCalculator.getSnapshot(candles);
    const result = RegimeSelector.classify(candles, snap, dummyPivots, 14.2);

    expect(result.regime).toBe('TRENDING_BULL');
    expect(result.favoredStrategies).toContain(1); // ORB
    expect(result.favoredStrategies).toContain(2); // EMA Pullback
    expect(result.confidence).toBeGreaterThanOrEqual(70);
  });

  it('Classifies SIDEWAYS_RANGE when market has low ADX and oscillates around pivots', () => {
    // 15 oscillating candles
    const candles: MarketCandle[] = Array.from({ length: 15 }, (_, i) => {
      const offset = (i % 2 === 0 ? 10 : -10);
      return {
        timestamp: 1000 + i * 300,
        datetime: `2026-10-21 09:${15 + i * 5}`,
        open: 23000,
        high: 23015,
        low: 22985,
        close: 23000 + offset,
        volume: 300,
        isClosed: true,
      };
    });

    const snap = IndicatorCalculator.getSnapshot(candles);
    const result = RegimeSelector.classify(candles, snap, dummyPivots, 12.0);

    expect(result.regime).toBe('SIDEWAYS_RANGE');
    expect(result.favoredStrategies).toContain(7); // BB Squeeze
    expect(result.favoredStrategies).toContain(12); // Pivots
  });
});
