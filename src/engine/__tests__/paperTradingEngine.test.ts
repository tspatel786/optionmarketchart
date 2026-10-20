import { describe, it, expect } from 'vitest';
import { PaperTradingEngine, type PaperTradeRecord } from '../paperTradingEngine';
import type { MarketCandle } from '../../services/growwService';

describe('PaperTradingEngine: Forward Paper Trading Lifecycle & Risk Management', () => {
  const dummyTrade: PaperTradeRecord = {
    instrument: 'NIFTY 50',
    contract_symbol: 'NIFTY 23000 CE (Weekly)',
    action: 'BUY_CE',
    entry_time: '2026-10-21T09:30:00.000Z',
    entry_price: 23000,
    stop_loss: 22950,
    target_1: 23075,
    target_2: 23150,
    quantity: 50,
    outcome: 'OPEN',
    pnl_points: 0,
    gross_pnl_inr: 0,
    net_pnl_inr: 0,
    status: 'OPEN',
  };

  it('Exits trade via WIN_T1 when high touches or exceeds Target 1', () => {
    const candle: MarketCandle = {
      timestamp: 1700,
      datetime: '2026-10-21 09:35',
      open: 23010,
      high: 23080, // Exceeds target_1 (23075)
      low: 22990,
      close: 23070,
      volume: 500,
      isClosed: true,
    };

    const { updatedTrades, closedCount } = PaperTradingEngine.evaluateOpenTrades([dummyTrade], candle);

    expect(closedCount).toBe(1);
    expect(updatedTrades[0].status).toBe('CLOSED');
    expect(updatedTrades[0].outcome).toBe('WIN_T1');
    expect(updatedTrades[0].exit_price).toBe(23075);
    expect(updatedTrades[0].pnl_points).toBe(75);
    expect(updatedTrades[0].gross_pnl_inr).toBe(3750); // 75 * 50
    expect(updatedTrades[0].net_pnl_inr).toBeLessThan(3750); // Deducted brokerage & taxes
    expect(updatedTrades[0].net_pnl_inr).toBeGreaterThan(2500);
  });

  it('Exits trade via LOSS_SL when low breaches Stop Loss', () => {
    const candle: MarketCandle = {
      timestamp: 1700,
      datetime: '2026-10-21 09:35',
      open: 22990,
      high: 23010,
      low: 22940, // Drops below stop_loss (22950)
      close: 22945,
      volume: 600,
      isClosed: true,
    };

    const { updatedTrades, closedCount } = PaperTradingEngine.evaluateOpenTrades([dummyTrade], candle);

    expect(closedCount).toBe(1);
    expect(updatedTrades[0].status).toBe('CLOSED');
    expect(updatedTrades[0].outcome).toBe('LOSS_SL');
    expect(updatedTrades[0].pnl_points).toBe(-50);
    expect(updatedTrades[0].gross_pnl_inr).toBe(-2500);
    expect(updatedTrades[0].net_pnl_inr).toBeLessThan(-2500); // Cost makes loss slightly deeper
  });

  it('Auto-squares off at market close (EOD) if still open', () => {
    const candle: MarketCandle = {
      timestamp: 1700,
      datetime: '2026-10-21 15:20',
      open: 23020,
      high: 23040,
      low: 23010,
      close: 23030,
      volume: 300,
      isClosed: true,
    };

    const { updatedTrades, closedCount } = PaperTradingEngine.evaluateOpenTrades([dummyTrade], candle, true);

    expect(closedCount).toBe(1);
    expect(updatedTrades[0].status).toBe('CLOSED');
    expect(updatedTrades[0].outcome).toBe('EXPIRED_EOD');
    expect(updatedTrades[0].exit_price).toBe(23030);
  });

  it('Blocks new trade when daily trade limit (max 3) is reached', () => {
    const todayTrades: PaperTradeRecord[] = [
      { ...dummyTrade, status: 'CLOSED', outcome: 'WIN_T1' },
      { ...dummyTrade, status: 'CLOSED', outcome: 'LOSS_SL' },
      { ...dummyTrade, status: 'CLOSED', outcome: 'WIN_T1' },
    ];

    const check = PaperTradingEngine.canOpenNewTrade(todayTrades, 'NIFTY 50');
    expect(check.allowed).toBe(false);
    expect(check.reason).toContain('Daily trade limit reached');
  });

  it('Blocks new trade when consecutive losses cool-off circuit breaker triggers', () => {
    const todayTrades: PaperTradeRecord[] = [
      { ...dummyTrade, status: 'CLOSED', outcome: 'LOSS_SL', net_pnl_inr: -1500 },
      { ...dummyTrade, status: 'CLOSED', outcome: 'LOSS_SL', net_pnl_inr: -1500 },
    ];

    const check = PaperTradingEngine.canOpenNewTrade(todayTrades, 'NIFTY 50');
    expect(check.allowed).toBe(false);
    expect(check.reason).toContain('Cool-off active');
  });
});
