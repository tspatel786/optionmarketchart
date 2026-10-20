import type { MarketCandle } from '../services/growwService';
import { SignalEngine, type EvaluatedSignal } from './signalEngine';

export interface CostModel {
  brokeragePerOrder: number; // ₹20 flat broker fee
  slippagePoints: number;    // e.g. 0.5 index points each on entry and exit
  turnoverTaxesPct: number;  // STT, Exchange fee, GST, SEBI (approx 0.05% of notional)
  lotSize: number;           // 50 for NIFTY, 15 for BANKNIFTY
}

export const DEFAULT_COST_MODEL_NIFTY: CostModel = {
  brokeragePerOrder: 20,
  slippagePoints: 0.5,
  turnoverTaxesPct: 0.0005, // 0.05%
  lotSize: 50,
};

export const DEFAULT_COST_MODEL_BANKNIFTY: CostModel = {
  brokeragePerOrder: 20,
  slippagePoints: 1.0,
  turnoverTaxesPct: 0.0005,
  lotSize: 15,
};

export interface BacktestTrade {
  signal: EvaluatedSignal;
  entryIndex: number;
  entryPrice: number;
  stopLoss: number;
  target1: number;
  target2: number;
  exitPrice?: number;
  exitTime?: string;
  grossPnlPoints: number;
  netPnlPoints: number;
  grossPnlInr: number;
  netPnlInr: number;
  totalCostInr: number;
  outcome: 'WIN_T1' | 'WIN_T2' | 'LOSS_SL' | 'OPEN';
  barsHeld: number;
}

export interface BacktestSummary {
  instrument: string;
  totalTrades: number;
  closedTrades: number;
  wins: number;
  losses: number;
  openTrades: number;
  grossWinRate: number; // percentage (e.g. 75.0%)
  netWinRate: number;   // percentage after costs
  totalGrossPnlInr: number;
  totalNetPnlInr: number;
  totalCostsInr: number;
  averageRiskReward: number;
  profitFactor: number;
  maxDrawdownPercent: number;
  maxDrawdownPoints: number;
  maxConsecutiveLosses: number;
  expectancyPerTradeInr: number;
  validationStatus: 'VERIFIED' | 'UNVERIFIED' | 'DISABLED';
  validationReason: string;
  trades: BacktestTrade[];
}

export interface WalkForwardResult {
  inSample: BacktestSummary;
  outOfSample: BacktestSummary;
  isOverfit: boolean;
  performanceDropPct: number;
  overallStatus: 'VERIFIED' | 'UNVERIFIED' | 'DISABLED';
}

export class BacktestEngine {
  /**
   * Runs backtest on historical 5m closed candles avoiding look-ahead bias.
   * At each candle i, only candles[0...i] are visible to the signal engine.
   * Applies realistic brokerage, taxes, and slippage.
   */
  public static runBacktest(
    instrument: 'NIFTY 50' | 'BANK NIFTY',
    candles: MarketCandle[],
    vix: number = 13.5,
    customCostModel?: Partial<CostModel>,
    minConfluenceRequired: number = 70
  ): BacktestSummary {
    const costModel: CostModel = {
      ...(instrument === 'BANK NIFTY' ? DEFAULT_COST_MODEL_BANKNIFTY : DEFAULT_COST_MODEL_NIFTY),
      ...customCostModel,
    };

    if (candles.length < 15) {
      return {
        instrument,
        totalTrades: 0,
        closedTrades: 0,
        wins: 0,
        losses: 0,
        openTrades: 0,
        grossWinRate: 0,
        netWinRate: 0,
        totalGrossPnlInr: 0,
        totalNetPnlInr: 0,
        totalCostsInr: 0,
        averageRiskReward: 0,
        profitFactor: 0,
        maxDrawdownPercent: 0,
        maxDrawdownPoints: 0,
        maxConsecutiveLosses: 0,
        expectancyPerTradeInr: 0,
        validationStatus: 'UNVERIFIED',
        validationReason: 'Insufficient candles (minimum 15 required for statistical backtest).',
        trades: [],
      };
    }

    const trades: BacktestTrade[] = [];
    const minBars = 4;

    for (let i = minBars; i < candles.length - 1; i++) {
      // Historical slice visible at step i - 0 look-ahead bias
      const visibleCandles = candles.slice(0, i + 1);
      const currentCandle = candles[i];

      // Calculate prior session High/Low/Close for pivot levels
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
        minConfluenceRequired,
      });

      if ((signal.signalType === 'BUY' || signal.signalType === 'SELL') && signal.levels) {
        // Enforce trade spacing cooldown (min 4 candles between entries)
        const lastTrade = trades[trades.length - 1];
        if (lastTrade && i - lastTrade.entryIndex < 4) {
          continue;
        }

        const isBuy = signal.signalType === 'BUY';
        // Apply entry slippage
        const rawEntry = signal.levels.entryPrice;
        const entryPrice = isBuy ? rawEntry + costModel.slippagePoints : rawEntry - costModel.slippagePoints;
        const stopLoss = signal.levels.stopLoss;
        const target1 = signal.levels.target1;
        const target2 = signal.levels.target2;

        let outcome: 'WIN_T1' | 'WIN_T2' | 'LOSS_SL' | 'OPEN' = 'OPEN';
        let rawExitPrice = entryPrice;
        let exitTime = currentCandle.datetime;
        let barsHeld = 0;

        // Simulate future candles forward strictly step-by-step
        for (let j = i + 1; j < candles.length; j++) {
          const futureCandle = candles[j];
          barsHeld++;

          if (isBuy) {
            if (futureCandle.low <= stopLoss) {
              outcome = 'LOSS_SL';
              rawExitPrice = stopLoss;
              exitTime = futureCandle.datetime;
              break;
            }
            if (futureCandle.high >= target2) {
              outcome = 'WIN_T2';
              rawExitPrice = target2;
              exitTime = futureCandle.datetime;
              break;
            }
            if (futureCandle.high >= target1) {
              outcome = 'WIN_T1';
              rawExitPrice = target1;
              exitTime = futureCandle.datetime;
              break;
            }
          } else {
            if (futureCandle.high >= stopLoss) {
              outcome = 'LOSS_SL';
              rawExitPrice = stopLoss;
              exitTime = futureCandle.datetime;
              break;
            }
            if (futureCandle.low <= target2) {
              outcome = 'WIN_T2';
              rawExitPrice = target2;
              exitTime = futureCandle.datetime;
              break;
            }
            if (futureCandle.low <= target1) {
              outcome = 'WIN_T1';
              rawExitPrice = target1;
              exitTime = futureCandle.datetime;
              break;
            }
          }
        }

        // Apply exit slippage
        const exitPrice = outcome === 'OPEN'
          ? rawExitPrice
          : isBuy ? rawExitPrice - costModel.slippagePoints : rawExitPrice + costModel.slippagePoints;

        // Gross points PnL
        const grossPnlPoints = isBuy
          ? Number((exitPrice - entryPrice).toFixed(2))
          : Number((entryPrice - exitPrice).toFixed(2));

        const grossPnlInr = Number((grossPnlPoints * costModel.lotSize).toFixed(2));

        // Realistic Cost Calculation:
        // 2 orders (entry + exit) * brokeragePerOrder (₹40 round-trip)
        // Turnover taxes = (entry + exit) * lotSize * turnoverTaxesPct
        const turnover = (entryPrice + exitPrice) * costModel.lotSize;
        const totalCostInr = outcome === 'OPEN' 
          ? 0 
          : Number(((costModel.brokeragePerOrder * 2) + (turnover * costModel.turnoverTaxesPct)).toFixed(2));

        const netPnlInr = Number((grossPnlInr - totalCostInr).toFixed(2));
        const netPnlPoints = Number((netPnlInr / costModel.lotSize).toFixed(2));

        trades.push({
          signal,
          entryIndex: i,
          entryPrice,
          stopLoss,
          target1,
          target2,
          exitPrice,
          exitTime,
          grossPnlPoints,
          netPnlPoints,
          grossPnlInr,
          netPnlInr,
          totalCostInr,
          outcome,
          barsHeld,
        });
      }
    }

    const closedTradesList = trades.filter(t => t.outcome !== 'OPEN');
    const wins = closedTradesList.filter(t => t.outcome === 'WIN_T1' || t.outcome === 'WIN_T2').length;
    const losses = closedTradesList.filter(t => t.outcome === 'LOSS_SL').length;
    const openTrades = trades.filter(t => t.outcome === 'OPEN').length;
    const closedTrades = closedTradesList.length;

    const grossWinRate = closedTrades > 0 ? Number(((wins / closedTrades) * 100).toFixed(1)) : 0;
    
    // Net win rate considers trades where net PnL after costs is positive
    const netWins = closedTradesList.filter(t => t.netPnlInr > 0).length;
    const netWinRate = closedTrades > 0 ? Number(((netWins / closedTrades) * 100).toFixed(1)) : 0;

    const totalGrossPnlInr = Number(trades.reduce((acc, t) => acc + t.grossPnlInr, 0).toFixed(2));
    const totalNetPnlInr = Number(trades.reduce((acc, t) => acc + t.netPnlInr, 0).toFixed(2));
    const totalCostsInr = Number(trades.reduce((acc, t) => acc + t.totalCostInr, 0).toFixed(2));

    const grossProfitInr = closedTradesList.filter(t => t.netPnlInr > 0).reduce((acc, t) => acc + t.netPnlInr, 0);
    const grossLossInr = Math.abs(closedTradesList.filter(t => t.netPnlInr < 0).reduce((acc, t) => acc + t.netPnlInr, 0));
    const profitFactor = grossLossInr > 0 ? Number((grossProfitInr / grossLossInr).toFixed(2)) : grossProfitInr > 0 ? 99 : 0;

    const averageRiskReward = trades.length > 0
      ? Number((trades.reduce((acc, t) => acc + (t.signal.levels?.riskRewardRatio || 1.5), 0) / trades.length).toFixed(2))
      : 1.5;

    // Maximum drawdown calculation (Peak to Trough on Net Equity Curve)
    let peakNetInr = 0;
    let runningNetInr = 0;
    let maxDdInr = 0;
    let maxDdPoints = 0;
    let consecutiveLosses = 0;
    let maxConsecutiveLosses = 0;

    for (const t of closedTradesList) {
      runningNetInr += t.netPnlInr;
      if (runningNetInr > peakNetInr) {
        peakNetInr = runningNetInr;
      }
      const dd = peakNetInr - runningNetInr;
      if (dd > maxDdInr) {
        maxDdInr = dd;
        maxDdPoints = Number((dd / costModel.lotSize).toFixed(2));
      }

      if (t.netPnlInr <= 0) {
        consecutiveLosses++;
        if (consecutiveLosses > maxConsecutiveLosses) {
          maxConsecutiveLosses = consecutiveLosses;
        }
      } else {
        consecutiveLosses = 0;
      }
    }

    const maxDrawdownPercent = peakNetInr > 0 ? Number(((maxDdInr / peakNetInr) * 100).toFixed(1)) : 0;
    const expectancyPerTradeInr = closedTrades > 0 ? Number((totalNetPnlInr / closedTrades).toFixed(2)) : 0;

    // Strict 80% Win-Rate Validation Gate:
    // 1. Must have minimum sample size (e.g. 20 closed trades)
    // 2. Net win rate >= 80%
    // 3. Positive profit factor >= 1.8
    // 4. Positive net expectancy after costs
    let validationStatus: 'VERIFIED' | 'UNVERIFIED' | 'DISABLED' = 'UNVERIFIED';
    let validationReason = '';

    if (closedTrades < 20) {
      validationStatus = 'UNVERIFIED';
      validationReason = `Sample size too small (${closedTrades}/20 minimum closed trades). Labeled UNVERIFIED to avoid curve-fitting.`;
    } else if (totalNetPnlInr <= 0 || profitFactor < 1.0) {
      validationStatus = 'DISABLED';
      validationReason = `Negative expectancy after realistic transaction costs (Net PnL ₹${totalNetPnlInr}, PF: ${profitFactor}).`;
    } else if (netWinRate >= 80 && profitFactor >= 1.8 && maxConsecutiveLosses <= 3) {
      validationStatus = 'VERIFIED';
      validationReason = `Fully Verified! Net Win Rate (${netWinRate}%) >= 80% target over ${closedTrades} closed trades with PF ${profitFactor}.`;
    } else {
      validationStatus = 'UNVERIFIED';
      validationReason = `Profitable (Net PnL: ₹${totalNetPnlInr}, PF: ${profitFactor}), but measured Net Win Rate (${netWinRate}%) is below 80% research target.`;
    }

    return {
      instrument,
      totalTrades: trades.length,
      closedTrades,
      wins,
      losses,
      openTrades,
      grossWinRate,
      netWinRate,
      totalGrossPnlInr,
      totalNetPnlInr,
      totalCostsInr,
      averageRiskReward,
      profitFactor,
      maxDrawdownPercent,
      maxDrawdownPoints: maxDdPoints,
      maxConsecutiveLosses,
      expectancyPerTradeInr,
      validationStatus,
      validationReason,
      trades,
    };
  }

  /**
   * Walk-Forward Out-of-Sample Validation
   * Splits candles chronologically into In-Sample (Train) and Out-of-Sample (Unseen Test).
   */
  public static runWalkForwardValidation(
    instrument: 'NIFTY 50' | 'BANK NIFTY',
    candles: MarketCandle[],
    splitRatio: number = 0.7,
    vix: number = 13.5
  ): WalkForwardResult {
    const splitIndex = Math.floor(candles.length * splitRatio);
    const inSampleCandles = candles.slice(0, splitIndex);
    const outOfSampleCandles = candles.slice(splitIndex);

    const inSample = this.runBacktest(instrument, inSampleCandles, vix);
    const outOfSample = this.runBacktest(instrument, outOfSampleCandles, vix);

    const performanceDropPct = inSample.netWinRate > 0
      ? Number(((inSample.netWinRate - outOfSample.netWinRate) / inSample.netWinRate * 100).toFixed(1))
      : 0;

    const isOverfit = performanceDropPct > 20 || (inSample.totalNetPnlInr > 0 && outOfSample.totalNetPnlInr < 0);

    let overallStatus: 'VERIFIED' | 'UNVERIFIED' | 'DISABLED' = 'UNVERIFIED';
    if (isOverfit) {
      overallStatus = 'DISABLED';
    } else if (outOfSample.validationStatus === 'VERIFIED') {
      overallStatus = 'VERIFIED';
    } else {
      overallStatus = 'UNVERIFIED';
    }

    return {
      inSample,
      outOfSample,
      isOverfit,
      performanceDropPct,
      overallStatus,
    };
  }
}
