import type { MarketCandle } from '../services/growwService';
import { SignalEngine, type EvaluatedSignal } from './signalEngine';

export interface BacktestTrade {
  signal: EvaluatedSignal;
  entryIndex: number;
  entryPrice: number;
  stopLoss: number;
  target1: number;
  target2: number;
  exitPrice?: number;
  exitTime?: string;
  pnlPoints: number;
  outcome: 'WIN_T1' | 'WIN_T2' | 'LOSS_SL' | 'OPEN';
  barsHeld: number;
}

export interface BacktestSummary {
  totalTrades: number;
  wins: number;
  losses: number;
  openTrades: number;
  winRate: number; // percentage (e.g. 65.5%)
  totalPnlPoints: number;
  averageRiskReward: number;
  profitFactor: number;
  trades: BacktestTrade[];
}

export class BacktestEngine {
  /**
   * Runs backtest on historical 5m closed candles avoiding look-ahead bias.
   * At each candle i, only candles[0...i] are visible to the signal engine.
   */
  public static runBacktest(
    instrument: 'NIFTY 50' | 'BANK NIFTY',
    candles: MarketCandle[],
    vix: number = 13.5
  ): BacktestSummary {
    if (candles.length < 15) {
      return {
        totalTrades: 0,
        wins: 0,
        losses: 0,
        openTrades: 0,
        winRate: 0,
        totalPnlPoints: 0,
        averageRiskReward: 0,
        profitFactor: 0,
        trades: [],
      };
    }

    const trades: BacktestTrade[] = [];
    const minBars = 5;

    for (let i = minBars; i < candles.length - 1; i++) {
      // Historical slice visible at step i
      const visibleCandles = candles.slice(0, i + 1);
      const currentCandle = candles[i];

      // Calculate prior day/session High/Low/Close for pivot levels
      const prevSlice = visibleCandles.slice(Math.max(0, i - 20), i);
      const prevHigh = Math.max(...prevSlice.map(c => c.high));
      const prevLow = Math.min(...prevSlice.map(c => c.low));
      const prevClose = prevSlice[prevSlice.length - 1]?.close || currentCandle.open;

      const signal = SignalEngine.evaluate(instrument, {
        candles: visibleCandles,
        vix,
        advances: 1400,
        declines: 800,
        prevDayHigh: prevHigh,
        prevDayLow: prevLow,
        prevDayClose: prevClose,
        activeConditions: [],
        forceMarketHoursCheck: false,
        minConfluenceRequired: 80,
      });

      if ((signal.signalType === 'BUY' || signal.signalType === 'SELL') && signal.levels) {
        // Avoid duplicate trades if last trade was opened in past 3 bars
        const lastTrade = trades[trades.length - 1];
        if (lastTrade && i - lastTrade.entryIndex < 4) {
          continue;
        }

        const isBuy = signal.signalType === 'BUY';
        const entryPrice = signal.levels.entryPrice;
        const stopLoss = signal.levels.stopLoss;
        const target1 = signal.levels.target1;
        const target2 = signal.levels.target2;

        let outcome: 'WIN_T1' | 'WIN_T2' | 'LOSS_SL' | 'OPEN' = 'OPEN';
        let exitPrice = entryPrice;
        let exitTime = currentCandle.datetime;
        let barsHeld = 0;

        // Simulate future candles forward to resolve outcome
        for (let j = i + 1; j < candles.length; j++) {
          const futureCandle = candles[j];
          barsHeld++;

          if (isBuy) {
            // Check Stop Loss hit
            if (futureCandle.low <= stopLoss) {
              outcome = 'LOSS_SL';
              exitPrice = stopLoss;
              exitTime = futureCandle.datetime;
              break;
            }
            // Check Target 2 hit
            if (futureCandle.high >= target2) {
              outcome = 'WIN_T2';
              exitPrice = target2;
              exitTime = futureCandle.datetime;
              break;
            }
            // Check Target 1 hit
            if (futureCandle.high >= target1) {
              outcome = 'WIN_T1';
              exitPrice = target1;
              exitTime = futureCandle.datetime;
              break;
            }
          } else {
            // SELL Trade
            // Check Stop Loss hit
            if (futureCandle.high >= stopLoss) {
              outcome = 'LOSS_SL';
              exitPrice = stopLoss;
              exitTime = futureCandle.datetime;
              break;
            }
            // Check Target 2 hit
            if (futureCandle.low <= target2) {
              outcome = 'WIN_T2';
              exitPrice = target2;
              exitTime = futureCandle.datetime;
              break;
            }
            // Check Target 1 hit
            if (futureCandle.low <= target1) {
              outcome = 'WIN_T1';
              exitPrice = target1;
              exitTime = futureCandle.datetime;
              break;
            }
          }
        }

        const pnlPoints = isBuy
          ? Number((exitPrice - entryPrice).toFixed(2))
          : Number((entryPrice - exitPrice).toFixed(2));

        trades.push({
          signal,
          entryIndex: i,
          entryPrice,
          stopLoss,
          target1,
          target2,
          exitPrice,
          exitTime,
          pnlPoints,
          outcome,
          barsHeld,
        });
      }
    }

    const wins = trades.filter(t => t.outcome === 'WIN_T1' || t.outcome === 'WIN_T2').length;
    const losses = trades.filter(t => t.outcome === 'LOSS_SL').length;
    const openTrades = trades.filter(t => t.outcome === 'OPEN').length;
    const closedCount = wins + losses;
    const winRate = closedCount > 0 ? Number(((wins / closedCount) * 100).toFixed(1)) : 0;

    const totalPnlPoints = trades.reduce((acc, t) => acc + t.pnlPoints, 0);
    const grossProfit = trades.filter(t => t.pnlPoints > 0).reduce((acc, t) => acc + t.pnlPoints, 0);
    const grossLoss = Math.abs(trades.filter(t => t.pnlPoints < 0).reduce((acc, t) => acc + t.pnlPoints, 0));
    const profitFactor = grossLoss > 0 ? Number((grossProfit / grossLoss).toFixed(2)) : grossProfit > 0 ? 99 : 0;
    const averageRiskReward = trades.length > 0
      ? Number((trades.reduce((acc, t) => acc + (t.signal.levels?.riskRewardRatio || 1.5), 0) / trades.length).toFixed(2))
      : 1.5;

    return {
      totalTrades: trades.length,
      wins,
      losses,
      openTrades,
      winRate,
      totalPnlPoints: Number(totalPnlPoints.toFixed(2)),
      averageRiskReward,
      profitFactor,
      trades,
    };
  }
}
