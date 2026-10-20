import type { MarketCandle } from '../services/growwService';
import type { EvaluatedSignal } from './signalEngine';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

export interface PaperTradeRecord {
  id?: string;
  signal_id?: string;
  instrument: string;
  contract_symbol: string;
  action: 'BUY_CE' | 'BUY_PE' | 'BUY' | 'SELL';
  entry_time: string; // ISO string
  entry_price: number;
  stop_loss: number;
  target_1: number;
  target_2: number;
  quantity: number;
  exit_time?: string | null;
  exit_price?: number | null;
  outcome: 'WIN_T1' | 'WIN_T2' | 'LOSS_SL' | 'EXPIRED_EOD' | 'INVALIDATED' | 'OPEN';
  pnl_points: number;
  gross_pnl_inr: number;
  net_pnl_inr: number;
  status: 'OPEN' | 'CLOSED' | 'CANCELLED';
  strategy_id?: number;
  strategy_name?: string;
  notes?: string;
}

export interface RiskSafeguards {
  maxDailyTrades: number; // e.g. 3
  maxDailyLossInr: number; // e.g. ₹5,000
  cooldownConsecutiveLosses: number; // e.g. pause after 2 consecutive losses
  lotSizeNifty: number; // 50
  lotSizeBankNifty: number; // 15
  brokeragePerOrder: number; // ₹20
  turnoverTaxesPct: number; // 0.05%
}

export const DEFAULT_RISK_SAFEGUARDS: RiskSafeguards = {
  maxDailyTrades: 3,
  maxDailyLossInr: 5000,
  cooldownConsecutiveLosses: 2,
  lotSizeNifty: 50,
  lotSizeBankNifty: 15,
  brokeragePerOrder: 20,
  turnoverTaxesPct: 0.0005,
};

export class PaperTradingEngine {
  /**
   * Evaluates all currently OPEN paper trades against the latest closed candle.
   * Checks Target 1, Target 2, Stop Loss, and 15:20 IST EOD auto-square off.
   */
  public static evaluateOpenTrades(
    openTrades: PaperTradeRecord[],
    latestCandle: MarketCandle,
    isEodSession: boolean = false,
    safeguards: RiskSafeguards = DEFAULT_RISK_SAFEGUARDS
  ): { updatedTrades: PaperTradeRecord[]; closedCount: number } {
    const updatedTrades: PaperTradeRecord[] = [];
    let closedCount = 0;

    for (const trade of openTrades) {
      if (trade.status !== 'OPEN') {
        updatedTrades.push(trade);
        continue;
      }

      const isLong = trade.action === 'BUY_CE' || trade.action === 'BUY';
      let outcome: 'WIN_T1' | 'WIN_T2' | 'LOSS_SL' | 'EXPIRED_EOD' | 'OPEN' = 'OPEN';
      let exitPrice = trade.entry_price;

      if (isLong) {
        // Stop Loss Check
        if (latestCandle.low <= trade.stop_loss) {
          outcome = 'LOSS_SL';
          exitPrice = trade.stop_loss;
        } else if (latestCandle.high >= trade.target_2) {
          outcome = 'WIN_T2';
          exitPrice = trade.target_2;
        } else if (latestCandle.high >= trade.target_1) {
          outcome = 'WIN_T1';
          exitPrice = trade.target_1;
        } else if (isEodSession) {
          outcome = 'EXPIRED_EOD';
          exitPrice = latestCandle.close;
        }
      } else {
        // Bearish / Put Trade
        if (latestCandle.high >= trade.stop_loss) {
          outcome = 'LOSS_SL';
          exitPrice = trade.stop_loss;
        } else if (latestCandle.low <= trade.target_2) {
          outcome = 'WIN_T2';
          exitPrice = trade.target_2;
        } else if (latestCandle.low <= trade.target_1) {
          outcome = 'WIN_T1';
          exitPrice = trade.target_1;
        } else if (isEodSession) {
          outcome = 'EXPIRED_EOD';
          exitPrice = latestCandle.close;
        }
      }

      if (outcome !== 'OPEN') {
        closedCount++;
        const pnlPoints = isLong
          ? Number((exitPrice - trade.entry_price).toFixed(2))
          : Number((trade.entry_price - exitPrice).toFixed(2));

        const grossPnlInr = Number((pnlPoints * trade.quantity).toFixed(2));
        const turnover = (trade.entry_price + exitPrice) * trade.quantity;
        const totalCosts = (safeguards.brokeragePerOrder * 2) + (turnover * safeguards.turnoverTaxesPct);
        const netPnlInr = Number((grossPnlInr - totalCosts).toFixed(2));

        updatedTrades.push({
          ...trade,
          status: 'CLOSED',
          outcome,
          exit_price: exitPrice,
          exit_time: new Date(latestCandle.timestamp * 1000).toISOString(),
          pnl_points: pnlPoints,
          gross_pnl_inr: grossPnlInr,
          net_pnl_inr: netPnlInr,
          notes: `Simulated forward exit via ${outcome} at ₹${exitPrice} on 5m bar (${latestCandle.datetime}).`,
        });
      } else {
        updatedTrades.push(trade);
      }
    }

    return { updatedTrades, closedCount };
  }

  /**
   * Helper: Determine ATM Option Contract Symbol dynamically
   */
  public static deriveOptionContractSymbol(
    instrument: string,
    action: 'BUY_CE' | 'BUY_PE',
    underlyingPrice: number,
    dateIST: Date = new Date()
  ): string {
    const isNifty = instrument.includes('NIFTY') && !instrument.includes('BANK');
    const strikeInterval = isNifty ? 50 : 100;
    const atmStrike = Math.round(underlyingPrice / strikeInterval) * strikeInterval;
    const type = action === 'BUY_CE' ? 'CE' : 'PE';

    // Format: NIFTY 24500 CE or BANKNIFTY 52000 PE
    const prefix = isNifty ? 'NIFTY' : 'BANKNIFTY';
    return `${prefix} ${atmStrike} ${type} (Weekly)`;
  }

  /**
   * Evaluates risk checks before opening a new paper trade.
   */
  public static canOpenNewTrade(
    todayTrades: PaperTradeRecord[],
    instrument: string,
    safeguards: RiskSafeguards = DEFAULT_RISK_SAFEGUARDS
  ): { allowed: boolean; reason: string } {
    const instTrades = todayTrades.filter(t => t.instrument === instrument);

    // 1. Max daily trades cap
    if (instTrades.length >= safeguards.maxDailyTrades) {
      return {
        allowed: false,
        reason: `Daily trade limit reached (${instTrades.length}/${safeguards.maxDailyTrades}) for ${instrument}.`,
      };
    }

    // 2. Max daily loss limit
    const totalDailyNetPnl = todayTrades.reduce((acc, t) => acc + (t.net_pnl_inr || 0), 0);
    if (totalDailyNetPnl <= -safeguards.maxDailyLossInr) {
      return {
        allowed: false,
        reason: `Circuit Breaker: Daily loss limit reached (₹${Math.abs(totalDailyNetPnl)} / max ₹${safeguards.maxDailyLossInr}). Trading suspended for today.`,
      };
    }

    // 3. Consecutive losses cooldown
    const closed = instTrades.filter(t => t.status === 'CLOSED');
    if (closed.length >= safeguards.cooldownConsecutiveLosses) {
      const lastN = closed.slice(-safeguards.cooldownConsecutiveLosses);
      const allLosses = lastN.every(t => t.outcome === 'LOSS_SL' || (t.net_pnl_inr || 0) < 0);
      if (allLosses) {
        return {
          allowed: false,
          reason: `Cool-off active: ${safeguards.cooldownConsecutiveLosses} consecutive losses on ${instrument}. Pausing entries for risk preservation.`,
        };
      }
    }

    // 4. Any currently open trade on this instrument
    const hasOpenTrade = instTrades.some(t => t.status === 'OPEN');
    if (hasOpenTrade) {
      return {
        allowed: false,
        reason: `A simulated position is already OPEN on ${instrument}. Duplicate entries prohibited.`,
      };
    }

    return { allowed: true, reason: 'Risk checks passed.' };
  }

  /**
   * Persists an updated paper trade to Supabase
   */
  public static async persistPaperTrade(trade: PaperTradeRecord): Promise<void> {
    if (!isSupabaseConfigured || !supabase || !trade.signal_id) return;

    try {
      if (trade.id) {
        await supabase
          .from('paper_trades')
          .update({
            exit_time: trade.exit_time,
            exit_price: trade.exit_price,
            outcome: trade.outcome,
            pnl_points: trade.pnl_points,
            gross_pnl_inr: trade.gross_pnl_inr,
            net_pnl_inr: trade.net_pnl_inr,
            status: trade.status,
            notes: trade.notes,
            updated_at: new Date().toISOString(),
          })
          .eq('id', trade.id);
      } else {
        await supabase.from('paper_trades').insert({
          signal_id: trade.signal_id,
          instrument: trade.instrument,
          contract_symbol: trade.contract_symbol,
          action: trade.action,
          entry_time: trade.entry_time,
          entry_price: trade.entry_price,
          stop_loss: trade.stop_loss,
          target_1: trade.target_1,
          target_2: trade.target_2,
          quantity: trade.quantity,
          outcome: trade.outcome,
          status: trade.status,
          strategy_id: trade.strategy_id,
          strategy_name: trade.strategy_name,
          notes: trade.notes,
        });
      }
    } catch (err) {
      console.error('[PaperTrading] Failed to persist trade to Supabase:', err);
    }
  }
}
