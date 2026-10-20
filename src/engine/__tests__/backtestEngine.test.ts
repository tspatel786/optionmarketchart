import { describe, it, expect } from 'vitest';
import { BacktestEngine } from '../backtestEngine';
import type { MarketCandle } from '../../services/growwService';

describe('BacktestEngine: Cost Model, Walk-Forward, and 80% Win Rate Gate', () => {
  it('Applies realistic costs (brokerage, slippage, taxes) and computes net PnL', () => {
    // Generate synthetic series with a clean Hammer pattern
    const candles: MarketCandle[] = [
      { timestamp: 1000, datetime: '2026-10-21 09:15', open: 23200, high: 23220, low: 23140, close: 23150, volume: 100, isClosed: true },
      { timestamp: 1300, datetime: '2026-10-21 09:20', open: 23150, high: 23160, low: 23090, close: 23100, volume: 120, isClosed: true },
      { timestamp: 1600, datetime: '2026-10-21 09:25', open: 23100, high: 23110, low: 23040, close: 23050, volume: 110, isClosed: true },
      { timestamp: 1900, datetime: '2026-10-21 09:30', open: 23050, high: 23060, low: 22980, close: 22990, volume: 130, isClosed: true },
      { timestamp: 2200, datetime: '2026-10-21 09:35', open: 22960, high: 22965, low: 22880, close: 22962, volume: 250, isClosed: true }, // Hammer
      // Target hit next
      { timestamp: 2500, datetime: '2026-10-21 09:40', open: 22965, high: 23150, low: 22960, close: 23120, volume: 300, isClosed: true },
      { timestamp: 2800, datetime: '2026-10-21 09:45', open: 23120, high: 23150, low: 23080, close: 23100, volume: 150, isClosed: true },
      { timestamp: 3100, datetime: '2026-10-21 09:50', open: 23100, high: 23140, low: 23090, close: 23110, volume: 140, isClosed: true },
      { timestamp: 3400, datetime: '2026-10-21 09:55', open: 23110, high: 23130, low: 23080, close: 23100, volume: 130, isClosed: true },
      { timestamp: 3700, datetime: '2026-10-21 10:00', open: 23100, high: 23120, low: 23070, close: 23090, volume: 120, isClosed: true },
      { timestamp: 4000, datetime: '2026-10-21 10:05', open: 23090, high: 23110, low: 23060, close: 23080, volume: 110, isClosed: true },
      { timestamp: 4300, datetime: '2026-10-21 10:10', open: 23080, high: 23100, low: 23050, close: 23070, volume: 100, isClosed: true },
      { timestamp: 4600, datetime: '2026-10-21 10:15', open: 23070, high: 23090, low: 23040, close: 23060, volume: 90, isClosed: true },
      { timestamp: 4900, datetime: '2026-10-21 10:20', open: 23060, high: 23080, low: 23030, close: 23050, volume: 80, isClosed: true },
      { timestamp: 5200, datetime: '2026-10-21 10:25', open: 23050, high: 23070, low: 23020, close: 23040, volume: 70, isClosed: true },
      { timestamp: 5500, datetime: '2026-10-21 10:30', open: 23040, high: 23060, low: 23010, close: 23030, volume: 60, isClosed: true },
    ];

    const result = BacktestEngine.runBacktest('NIFTY 50', candles, 14.5);

    expect(result.totalTrades).toBeGreaterThanOrEqual(1);
    if (result.trades.length > 0) {
      const trade = result.trades[0];
      expect(trade.totalCostInr).toBeGreaterThan(0);
      expect(trade.netPnlInr).toBeLessThan(trade.grossPnlInr);
    }
  });

  it('Labels strategy UNVERIFIED when sample size is below minimum threshold (< 20 trades)', () => {
    const candles: MarketCandle[] = Array.from({ length: 20 }, (_, i) => ({
      timestamp: 1000 + i * 300,
      datetime: `2026-10-21 09:${15 + i * 5}`,
      open: 23000,
      high: 23050,
      low: 22950,
      close: 23000,
      volume: 100,
      isClosed: true,
    }));

    const result = BacktestEngine.runBacktest('NIFTY 50', candles);
    expect(result.validationStatus).toBe('UNVERIFIED');
    expect(result.validationReason).toContain('Sample size too small');
  });
});
