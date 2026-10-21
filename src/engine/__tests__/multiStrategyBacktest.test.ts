import { describe, it, expect } from 'vitest';
import { HistoricalDataService } from '../historicalCandles';
import { MultiStrategyBacktester, isStrategyAuthorizedForSignals } from '../multiStrategyBacktester';
import { StrategyRegistry } from '../strategyRegistry';
import { PivotCalculator } from '../pivotCalculator';

describe('Multi-Strategy Historical Backtest Engine & Qualification Gate', () => {
  it('should generate multi-session historical candles across various regimes', () => {
    const niftyCandles = HistoricalDataService.getHistoricalCandles('NIFTY 50');
    expect(niftyCandles.length).toBeGreaterThanOrEqual(375); // 5 sessions * 75 bars
    expect(niftyCandles[0].close).toBeGreaterThan(20000);

    const bnCandles = HistoricalDataService.getHistoricalCandles('BANK NIFTY');
    expect(bnCandles.length).toBeGreaterThanOrEqual(375);
    expect(bnCandles[0].close).toBeGreaterThan(45000);
  });

  it('should evaluate all 38 intraday strategies on historical candles and generate ranked leaderboard', () => {
    const candles = HistoricalDataService.getHistoricalCandles('NIFTY 50');
    const summary = MultiStrategyBacktester.runAllStrategiesBacktest('NIFTY 50', candles, 75);

    expect(summary.leaderboard.length).toBe(38);
    expect(summary.qualifiedStrategiesCount).toBeGreaterThan(0);
    expect(summary.mutedStrategiesCount).toBeGreaterThan(0);
    expect(summary.topStrategy.netWinRate).toBeGreaterThanOrEqual(75);

    // Verify ranking order (rank 1 must have >= rank 2 net win rate)
    expect(summary.leaderboard[0].rank).toBe(1);
    expect(summary.leaderboard[0].netWinRate).toBeGreaterThanOrEqual(summary.leaderboard[1].netWinRate);
  });

  it('should evaluate all 38 strategies through StrategyRegistry.evaluateAllStrategies', () => {
    const candles = HistoricalDataService.getHistoricalCandles('NIFTY 50').slice(0, 50);
    const pdh = 24650;
    const pdl = 24450;
    const pdc = 24550;
    const pivots = PivotCalculator.calculatePivots(pdh, pdl, pdc);

    const allEvals = StrategyRegistry.evaluateAllStrategies(candles, pivots, pdh, pdl, pdc);
    expect(allEvals.length).toBe(38);

    const strategyIds = allEvals.map(s => s.strategyId);
    for (let id = 1; id <= 38; id++) {
      expect(strategyIds).toContain(id);
    }
  });

  it('should filter signals so only high win-rate strategies are authorized', () => {
    expect(isStrategyAuthorizedForSignals(4)).toBe(true);  // Supertrend + VWAP
    expect(isStrategyAuthorizedForSignals(9)).toBe(true);  // PDH/PDL Breakout
    expect(isStrategyAuthorizedForSignals(17)).toBe(true); // 9-EMA Scalp
    expect(isStrategyAuthorizedForSignals(20)).toBe(true); // Master Confluence
    expect(isStrategyAuthorizedForSignals(22)).toBe(true); // Donchian Breakout
    expect(isStrategyAuthorizedForSignals(23)).toBe(true); // ATR Expansion
    expect(isStrategyAuthorizedForSignals(26)).toBe(true); // Volume Breakout
    expect(isStrategyAuthorizedForSignals(32)).toBe(true); // Regime-Aware Selector
    expect(isStrategyAuthorizedForSignals(33)).toBe(true); // Double Top M Pattern
    expect(isStrategyAuthorizedForSignals(34)).toBe(true); // Double Bottom W Pattern
    expect(isStrategyAuthorizedForSignals(37)).toBe(true); // Neckline Retest S/R Flip
    expect(isStrategyAuthorizedForSignals(38)).toBe(true); // Failed Breakout Trap

    // Low win rate / unverified strategies are muted
    expect(isStrategyAuthorizedForSignals(999)).toBe(false);
  });
});
