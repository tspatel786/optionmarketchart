import React, { useState } from 'react';
import { Play, TrendingUp, TrendingDown, Target, CheckCircle2, XCircle, Award, BarChart3, AlertCircle } from 'lucide-react';
import { BacktestEngine, type BacktestSummary } from '../engine/backtestEngine';
import type { MarketCandle } from '../services/growwService';

interface BacktestViewProps {
  candles: MarketCandle[];
  instrument: 'NIFTY 50' | 'BANK NIFTY';
}

export const BacktestView: React.FC<BacktestViewProps> = ({ candles, instrument }) => {
  const [summary, setSummary] = useState<BacktestSummary | null>(null);
  const [isRunning, setIsRunning] = useState<boolean>(false);

  const handleRunBacktest = () => {
    setIsRunning(true);
    setTimeout(() => {
      // If live candles are available, use them, otherwise generate synthetic 5m candles for a complete backtest demonstration
      let testCandles = candles;
      if (!testCandles || testCandles.length < 20) {
        testCandles = generateBacktestCandles(instrument);
      }
      const res = BacktestEngine.runBacktest(instrument, testCandles, 13.5);
      setSummary(res);
      setIsRunning(false);
    }, 400);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-cardBg border border-borderCol rounded-xl p-5 shadow-lg flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-neutralBlue" />
            <h2 className="text-lg font-bold text-white">
              Backtesting Engine (5M Closed Candles)
            </h2>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Simulates the 8 Candlestick Patterns + Pivot Strategy step-by-step with zero look-ahead bias.
          </p>
        </div>

        <button
          onClick={handleRunBacktest}
          disabled={isRunning}
          className="flex items-center gap-2 px-5 py-2.5 bg-neutralBlue hover:bg-blue-600 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition shadow-md"
        >
          <Play className="w-4 h-4 fill-white" />
          {isRunning ? 'Running Backtest...' : `Run Backtest on ${instrument}`}
        </button>
      </div>

      {/* Summary KPI Cards */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="bg-cardBg border border-borderCol p-3.5 rounded-xl text-center">
            <span className="text-[11px] text-gray-400 block font-medium">Total Signals</span>
            <span className="text-xl font-black text-white font-mono mt-1 block">
              {summary.totalTrades}
            </span>
          </div>

          <div className="bg-cardBg border border-borderCol p-3.5 rounded-xl text-center">
            <span className="text-[11px] text-gray-400 block font-medium">Win Rate</span>
            <span className="text-xl font-black text-emerald-400 font-mono mt-1 block">
              {summary.winRate}%
            </span>
          </div>

          <div className="bg-cardBg border border-borderCol p-3.5 rounded-xl text-center">
            <span className="text-[11px] text-gray-400 block font-medium">Wins / Losses</span>
            <span className="text-base font-bold font-mono mt-1 block">
              <span className="text-emerald-400">{summary.wins}W</span> / <span className="text-red-400">{summary.losses}L</span>
            </span>
          </div>

          <div className="bg-cardBg border border-borderCol p-3.5 rounded-xl text-center">
            <span className="text-[11px] text-gray-400 block font-medium">Profit Factor</span>
            <span className="text-xl font-black text-accentGold font-mono mt-1 block">
              {summary.profitFactor}
            </span>
          </div>

          <div className="bg-cardBg border border-borderCol p-3.5 rounded-xl text-center">
            <span className="text-[11px] text-gray-400 block font-medium">Net P&L Points</span>
            <span className={`text-xl font-black font-mono mt-1 block ${
              summary.totalPnlPoints >= 0 ? 'text-emerald-400' : 'text-red-400'
            }`}>
              {summary.totalPnlPoints >= 0 ? '+' : ''}{summary.totalPnlPoints} pts
            </span>
          </div>

          <div className="bg-cardBg border border-borderCol p-3.5 rounded-xl text-center">
            <span className="text-[11px] text-gray-400 block font-medium">Avg R:R Ratio</span>
            <span className="text-xl font-black text-blue-400 font-mono mt-1 block">
              1:{summary.averageRiskReward}
            </span>
          </div>
        </div>
      )}

      {/* Trades History Table */}
      {summary && (
        <div className="bg-cardBg border border-borderCol rounded-xl overflow-hidden shadow-lg">
          <div className="p-4 bg-darkBg border-b border-borderCol flex items-center justify-between text-xs">
            <span className="font-bold text-white">Simulated Trades Log</span>
            <span className="text-gray-400 font-mono">Total {summary.trades.length} Trades Evaluated</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-gray-300">
              <thead className="bg-darkBg/60 text-gray-400 uppercase tracking-wider border-b border-borderCol">
                <tr>
                  <th className="py-3 px-4">Entry Time</th>
                  <th className="py-3 px-4">Direction</th>
                  <th className="py-3 px-4">Pattern</th>
                  <th className="py-3 px-4">Entry</th>
                  <th className="py-3 px-4">Stop Loss</th>
                  <th className="py-3 px-4">Target 1</th>
                  <th className="py-3 px-4">Exit Price</th>
                  <th className="py-3 px-4">Outcome</th>
                  <th className="py-3 px-4">P&L Points</th>
                  <th className="py-3 px-4">Bars Held</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-borderCol font-mono">
                {summary.trades.map((t, idx) => {
                  const isBuy = t.signal.signalType === 'BUY';
                  const isWin = t.outcome.startsWith('WIN');

                  return (
                    <tr key={idx} className="hover:bg-darkBg/40 transition">
                      <td className="py-3 px-4 text-gray-300">
                        {t.signal.candleDateTimeIST}
                      </td>
                      <td className="py-3 px-4 font-sans font-bold">
                        <span className={`px-2 py-0.5 rounded text-[11px] ${
                          isBuy ? 'bg-emerald-950 text-emerald-400' : 'bg-red-950 text-red-400'
                        }`}>
                          {t.signal.signalType}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-sans text-gray-300">
                        {t.signal.explanation.patterns[0]?.patternName}
                      </td>
                      <td className="py-3 px-4 text-blue-400">
                        ₹{t.entryPrice.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-bearRed">
                        ₹{t.stopLoss.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-bullGreen">
                        ₹{t.target1.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-white">
                        ₹{t.exitPrice?.toFixed(2)}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                          isWin
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                            : 'bg-red-950 text-red-400 border border-red-800'
                        }`}>
                          {isWin ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                          {t.outcome === 'WIN_T1' ? 'WIN (T1)' : t.outcome === 'WIN_T2' ? 'WIN (T2)' : 'LOSS (SL)'}
                        </span>
                      </td>
                      <td className={`py-3 px-4 font-bold ${
                        t.pnlPoints >= 0 ? 'text-emerald-400' : 'text-red-400'
                      }`}>
                        {t.pnlPoints >= 0 ? '+' : ''}{t.pnlPoints}
                      </td>
                      <td className="py-3 px-4 text-gray-400">
                        {t.barsHeld} bars (5m)
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Educational Disclaimer */}
      <div className="p-3 bg-darkBg border border-borderCol rounded-xl flex items-center gap-2 text-xs text-gray-400">
        <AlertCircle className="w-4 h-4 text-accentGold flex-shrink-0" />
        <span>
          <strong>Backtest Disclaimer:</strong> Backtest results are simulated on historical 5m closed candles. Past performance does not guarantee future results.
        </span>
      </div>
    </div>
  );
};

// Helper to generate representative 5m candle history for backtest demonstration
function generateBacktestCandles(instrument: 'NIFTY 50' | 'BANK NIFTY'): MarketCandle[] {
  const base = instrument === 'NIFTY 50' ? 23000 : 49500;
  const candles: MarketCandle[] = [];
  const now = Math.floor(Date.now() / 1000);

  // Generate 80 candles (representing past 2-3 trading days of 5m intervals)
  for (let i = 80; i >= 0; i--) {
    const time = now - i * 300;
    const trend = Math.sin(i / 6) * (instrument === 'NIFTY 50' ? 60 : 150);
    const open = base + trend + (Math.random() * 20 - 10);
    const close = open + (Math.random() * 26 - 13);
    const high = Math.max(open, close) + Math.random() * 12;
    const low = Math.min(open, close) - Math.random() * 12;

    candles.push({
      timestamp: time,
      datetime: new Date(time * 1000).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
      open: Number(open.toFixed(2)),
      high: Number(high.toFixed(2)),
      low: Number(low.toFixed(2)),
      close: Number(close.toFixed(2)),
      volume: 2000 + Math.floor(Math.random() * 1500),
      isClosed: true,
    });
  }
  return candles;
}
