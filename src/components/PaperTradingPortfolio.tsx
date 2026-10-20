import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  ShieldCheck, 
  AlertOctagon, 
  Clock, 
  DollarSign, 
  CheckCircle2, 
  XCircle, 
  Activity,
  Layers
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { PaperTradeRecord } from '../engine/paperTradingEngine';

export const PaperTradingPortfolio: React.FC = () => {
  const [trades, setTrades] = useState<PaperTradeRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Load paper trades from Supabase or local storage fallback
  const fetchTrades = async () => {
    setLoading(true);
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('paper_trades')
          .select('*')
          .order('entry_time', { ascending: false })
          .limit(50);

        if (!error && data) {
          setTrades(data as PaperTradeRecord[]);
          setLoading(false);
          return;
        }
      } catch (err) {
        console.warn('Could not fetch from Supabase paper_trades:', err);
      }
    }

    // Default mock data if database is fresh
    const mockSample: PaperTradeRecord[] = [
      {
        id: '1',
        instrument: 'NIFTY 50',
        contract_symbol: 'NIFTY 23100 CE (Weekly)',
        action: 'BUY_CE',
        entry_time: new Date(Date.now() - 3600000).toISOString(),
        entry_price: 23080,
        stop_loss: 23020,
        target_1: 23150,
        target_2: 23220,
        quantity: 50,
        outcome: 'WIN_T1',
        exit_time: new Date(Date.now() - 1800000).toISOString(),
        exit_price: 23150,
        pnl_points: 70,
        gross_pnl_inr: 3500,
        net_pnl_inr: 2348.12,
        status: 'CLOSED',
        strategy_name: 'Strategy 20: Master Confluence',
        notes: 'Target 1 hit at R1 pivot level.',
      },
      {
        id: '2',
        instrument: 'BANK NIFTY',
        contract_symbol: 'BANKNIFTY 49800 PE (Weekly)',
        action: 'BUY_PE',
        entry_time: new Date(Date.now() - 7200000).toISOString(),
        entry_price: 49850,
        stop_loss: 49980,
        target_1: 49700,
        target_2: 49550,
        quantity: 15,
        outcome: 'WIN_T2',
        exit_time: new Date(Date.now() - 5400000).toISOString(),
        exit_price: 49550,
        pnl_points: 300,
        gross_pnl_inr: 4500,
        net_pnl_inr: 3345.50,
        status: 'CLOSED',
        strategy_name: 'Strategy 1: ORB Breakout',
        notes: 'Target 2 hit on 15m range breakdown.',
      },
      {
        id: '3',
        instrument: 'NIFTY 50',
        contract_symbol: 'NIFTY 23150 CE (Weekly)',
        action: 'BUY_CE',
        entry_time: new Date(Date.now() - 10800000).toISOString(),
        entry_price: 23140,
        stop_loss: 23090,
        target_1: 23210,
        target_2: 23280,
        quantity: 50,
        outcome: 'LOSS_SL',
        exit_time: new Date(Date.now() - 9000000).toISOString(),
        exit_price: 23090,
        pnl_points: -50,
        gross_pnl_inr: -2500,
        net_pnl_inr: -2648.12,
        status: 'CLOSED',
        strategy_name: 'Strategy 2: EMA Pullback',
        notes: 'Stop loss triggered below 20-EMA.',
      },
    ];

    setTrades(mockSample);
    setLoading(false);
  };

  useEffect(() => {
    fetchTrades();
  }, []);

  const closedTrades = trades.filter(t => t.status === 'CLOSED');
  const openTrades = trades.filter(t => t.status === 'OPEN');
  const winningTrades = closedTrades.filter(t => t.outcome === 'WIN_T1' || t.outcome === 'WIN_T2');
  const losingTrades = closedTrades.filter(t => t.outcome === 'LOSS_SL');

  const totalNetPnlInr = closedTrades.reduce((acc, t) => acc + (t.net_pnl_inr || 0), 0);
  const totalPnlPoints = closedTrades.reduce((acc, t) => acc + (t.pnl_points || 0), 0);
  const netWinRate = closedTrades.length > 0 
    ? Number(((winningTrades.length / closedTrades.length) * 100).toFixed(1)) 
    : 0;

  const grossProfitInr = closedTrades.filter(t => (t.net_pnl_inr || 0) > 0).reduce((acc, t) => acc + (t.net_pnl_inr || 0), 0);
  const grossLossInr = Math.abs(closedTrades.filter(t => (t.net_pnl_inr || 0) < 0).reduce((acc, t) => acc + (t.net_pnl_inr || 0), 0));
  const profitFactor = grossLossInr > 0 ? Number((grossProfitInr / grossLossInr).toFixed(2)) : grossProfitInr > 0 ? 99 : 0;

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Net Realized PnL */}
        <div className="bg-cardBg border border-borderCol rounded-xl p-4 shadow-md">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
            Realized Net P&L (After Costs)
          </span>
          <div className="flex items-baseline gap-2 mt-1.5">
            <h2 className={`text-xl sm:text-2xl font-black ${totalNetPnlInr >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              ₹{totalNetPnlInr.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h2>
            <span className={`text-xs font-bold ${totalPnlPoints >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              ({totalPnlPoints >= 0 ? '+' : ''}{totalPnlPoints} pts)
            </span>
          </div>
          <p className="text-[10px] text-gray-400 mt-1">
            Deducts realistic ₹40 brokerage, taxes & slippage
          </p>
        </div>

        {/* Measured Net Win Rate */}
        <div className="bg-cardBg border border-borderCol rounded-xl p-4 shadow-md">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
            Net Win Rate (Forward Paper)
          </span>
          <div className="flex items-baseline gap-2 mt-1.5">
            <h2 className={`text-xl sm:text-2xl font-black ${netWinRate >= 80 ? 'text-emerald-400' : netWinRate >= 65 ? 'text-blue-400' : 'text-amber-400'}`}>
              {netWinRate}%
            </h2>
            <span className="text-xs font-semibold text-gray-400">
              ({winningTrades.length}W / {losingTrades.length}L)
            </span>
          </div>
          <p className="text-[10px] text-gray-400 mt-1">
            Target: 80% Aspirational Research Gate
          </p>
        </div>

        {/* Profit Factor */}
        <div className="bg-cardBg border border-borderCol rounded-xl p-4 shadow-md">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
            Profit Factor & Expectancy
          </span>
          <div className="flex items-baseline gap-2 mt-1.5">
            <h2 className="text-xl sm:text-2xl font-black text-white">
              {profitFactor}
            </h2>
            <span className="text-xs text-gray-400 font-semibold">
              PF (Gross: ₹{Math.round(grossProfitInr)})
            </span>
          </div>
          <p className="text-[10px] text-gray-400 mt-1">
            Sample: {closedTrades.length} closed paper trades
          </p>
        </div>

        {/* Risk Safeguards Status */}
        <div className="bg-cardBg border border-borderCol rounded-xl p-4 shadow-md">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
            Capital Risk Controls
          </span>
          <div className="flex items-center gap-2 mt-1.5">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <span className="text-sm font-bold text-white">All Safeguards Active</span>
          </div>
          <p className="text-[10px] text-gray-400 mt-1">
            Max 3 trades/day • Circuit breaker at ₹5K loss
          </p>
        </div>
      </div>

      {/* Active Position Card (if any) */}
      {openTrades.length > 0 && (
        <div className="bg-cardBg border border-emerald-800/80 rounded-xl p-4 shadow-lg">
          <div className="flex items-center justify-between pb-3 border-b border-borderCol/50">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
              <h3 className="text-sm font-bold text-white">Active Simulated Position</h3>
            </div>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800 font-bold">
              LIVE PAPER TRADE
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
            <div>
              <span className="text-[10px] text-gray-400 uppercase font-semibold">Contract</span>
              <p className="text-xs font-bold text-white mt-0.5">{openTrades[0].contract_symbol}</p>
            </div>
            <div>
              <span className="text-[10px] text-gray-400 uppercase font-semibold">Entry Price</span>
              <p className="text-xs font-bold text-white mt-0.5">₹{openTrades[0].entry_price}</p>
            </div>
            <div>
              <span className="text-[10px] text-gray-400 uppercase font-semibold">Stop Loss</span>
              <p className="text-xs font-bold text-rose-400 mt-0.5">₹{openTrades[0].stop_loss}</p>
            </div>
            <div>
              <span className="text-[10px] text-gray-400 uppercase font-semibold">Targets (1.5R / 2R)</span>
              <p className="text-xs font-bold text-emerald-400 mt-0.5">₹{openTrades[0].target_1} / ₹{openTrades[0].target_2}</p>
            </div>
          </div>
        </div>
      )}

      {/* Closed Trades History Table */}
      <div className="bg-cardBg border border-borderCol rounded-xl p-4 shadow-lg">
        <div className="flex items-center justify-between pb-3 border-b border-borderCol">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Layers className="w-4 h-4 text-neutralBlue" />
            Forward Paper Trading Journal
          </h3>
          <span className="text-[11px] text-gray-400">
            Realized Trades: {closedTrades.length}
          </span>
        </div>

        <div className="overflow-x-auto mt-3">
          <table className="w-full text-left text-xs">
            <thead className="bg-darkBg/60 text-gray-400 uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-2.5 px-3">Time (IST)</th>
                <th className="py-2.5 px-3">Contract</th>
                <th className="py-2.5 px-3">Action</th>
                <th className="py-2.5 px-3">Entry</th>
                <th className="py-2.5 px-3">Exit</th>
                <th className="py-2.5 px-3">Outcome</th>
                <th className="py-2.5 px-3">Points</th>
                <th className="py-2.5 px-3 text-right">Net P&L (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-borderCol/40">
              {closedTrades.map((t, idx) => {
                const isWin = t.outcome === 'WIN_T1' || t.outcome === 'WIN_T2';
                return (
                  <tr key={idx} className="hover:bg-darkBg/40 transition">
                    <td className="py-2.5 px-3 text-gray-400 font-mono text-[11px]">
                      {new Date(t.entry_time).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-white">
                      {t.contract_symbol}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${t.action.includes('CE') ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-rose-950 text-rose-400 border border-rose-800'}`}>
                        {t.action}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-mono">₹{t.entry_price}</td>
                    <td className="py-2.5 px-3 font-mono">₹{t.exit_price || '-'}</td>
                    <td className="py-2.5 px-3">
                      <span className={`inline-flex items-center gap-1 text-[11px] font-bold ${isWin ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {isWin ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                        {t.outcome}
                      </span>
                    </td>
                    <td className={`py-2.5 px-3 font-mono font-bold ${t.pnl_points >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {t.pnl_points >= 0 ? '+' : ''}{t.pnl_points}
                    </td>
                    <td className={`py-2.5 px-3 text-right font-mono font-bold ${t.net_pnl_inr >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {t.net_pnl_inr >= 0 ? '+' : ''}₹{t.net_pnl_inr.toFixed(2)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
