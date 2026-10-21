import React, { useState, useEffect, useMemo } from 'react';
import {
  Play,
  TrendingUp,
  TrendingDown,
  Target,
  CheckCircle2,
  XCircle,
  Award,
  BarChart3,
  AlertCircle,
  ShieldCheck,
  ShieldAlert,
  Filter,
  Flame,
  ArrowUpDown
} from 'lucide-react';
import {
  MultiStrategyBacktester,
  type MultiStrategyBacktestSummary,
  type StrategyPerformanceMetrics,
  type SimulatedTrade
} from '../engine/multiStrategyBacktester';
import { HistoricalDataService } from '../engine/historicalCandles';
import type { MarketCandle } from '../services/growwService';

interface BacktestViewProps {
  candles: MarketCandle[];
  instrument: 'NIFTY 50' | 'BANK NIFTY';
}

export const BacktestView: React.FC<BacktestViewProps> = ({ candles, instrument }) => {
  const [summary, setSummary] = useState<MultiStrategyBacktestSummary | null>(null);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [filterQualifiedOnly, setFilterQualifiedOnly] = useState<boolean>(false);
  const [selectedStrategyId, setSelectedStrategyId] = useState<number | 'ALL'>('ALL');

  // Auto-run on mount or when instrument changes to provide instant historical insights
  useEffect(() => {
    runHistoricalBacktest();
  }, [instrument]);

  const runHistoricalBacktest = () => {
    setIsRunning(true);
    setTimeout(() => {
      // Use historical multi-session dataset (375+ candles covering 5 complete trading days)
      const historicalCandles = HistoricalDataService.getHistoricalCandles(instrument);
      const res = MultiStrategyBacktester.runAllStrategiesBacktest(instrument, historicalCandles, 75);
      setSummary(res);
      setIsRunning(false);
    }, 300);
  };

  // Filtered leaderboard
  const displayedLeaderboard = useMemo(() => {
    if (!summary) return [];
    if (filterQualifiedOnly) {
      return summary.leaderboard.filter(s => s.isQualifiedForSignals);
    }
    return summary.leaderboard;
  }, [summary, filterQualifiedOnly]);

  // Filtered trades
  const displayedTrades = useMemo(() => {
    if (!summary) return [];
    if (selectedStrategyId === 'ALL') {
      return summary.allTrades.slice(0, 50); // Show top 50 recent
    }
    return summary.allTrades.filter(t => t.strategyId === selectedStrategyId).slice(0, 50);
  }, [summary, selectedStrategyId]);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-cardBg border border-borderCol rounded-xl p-5 shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-accentGold" />
            <h2 className="text-lg font-bold text-white">
              Historical Multi-Strategy Backtesting Engine
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-950 text-amber-300 border border-amber-800 flex items-center gap-1">
              <Flame className="w-3 h-3 text-amber-400" />
              Strict 75%+ Win Rate Gate
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-1 max-w-2xl">
            जुन्या ऐतिहासिक डेटा वरून सर्व 32 स्ट्रॅटेजीज टेस्ट केल्या जातात. 
            <strong className="text-emerald-400"> ज्यांचा Net Win Rate 75%+ आहे, तेच सिग्नल्ससाठी सक्रिय राहतात</strong>; 
            कमी विन-रेट असणाऱ्या स्ट्रॅटेजीज ऑटोमॅटिक म्यूट (ब्लॉक) केल्या जातात.
          </p>
        </div>

        <button
          onClick={runHistoricalBacktest}
          disabled={isRunning}
          className="flex items-center gap-2 px-5 py-2.5 bg-neutralBlue hover:bg-blue-600 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition shadow-md self-stretch sm:self-auto justify-center"
        >
          <Play className="w-4 h-4 fill-white" />
          {isRunning ? 'Analyzing Historical Data...' : `Run Historical Backtest (${instrument})`}
        </button>
      </div>

      {/* Summary KPI Cards */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="bg-cardBg border border-borderCol p-3.5 rounded-xl text-center">
            <span className="text-[11px] text-gray-400 block font-medium">Historical Dataset</span>
            <span className="text-lg font-black text-white font-mono mt-1 block">
              {summary.candlesCount} Bars
            </span>
            <span className="text-[10px] text-gray-400 block mt-0.5">{summary.sessionsTested} Full Sessions</span>
          </div>

          <div className="bg-cardBg border border-emerald-900/60 bg-emerald-950/20 p-3.5 rounded-xl text-center">
            <span className="text-[11px] text-emerald-400 block font-medium">Qualified Strategies</span>
            <span className="text-2xl font-black text-emerald-400 font-mono mt-1 block">
              {summary.qualifiedStrategiesCount} / 32
            </span>
            <span className="text-[10px] text-emerald-300/70 block mt-0.5">Win Rate ≥ 75%</span>
          </div>

          <div className="bg-cardBg border border-red-900/40 p-3.5 rounded-xl text-center">
            <span className="text-[11px] text-gray-400 block font-medium">Muted / Filtered Out</span>
            <span className="text-xl font-black text-red-400 font-mono mt-1 block">
              {summary.mutedStrategiesCount} Strategies
            </span>
            <span className="text-[10px] text-gray-400 block mt-0.5">Blocked from Signals</span>
          </div>

          <div className="bg-cardBg border border-borderCol p-3.5 rounded-xl text-center">
            <span className="text-[11px] text-gray-400 block font-medium">Top Performer</span>
            <span className="text-sm font-bold text-accentGold font-mono mt-1 block truncate" title={summary.topStrategy?.strategyName}>
              #{summary.topStrategy?.rank} {summary.topStrategy?.strategyName?.split('(')[0]}
            </span>
            <span className="text-[11px] text-emerald-400 font-bold block mt-0.5 font-mono">
              {summary.topStrategy?.netWinRate}% Net Win
            </span>
          </div>

          <div className="bg-cardBg border border-borderCol p-3.5 rounded-xl text-center">
            <span className="text-[11px] text-gray-400 block font-medium">Total Signals Tested</span>
            <span className="text-xl font-black text-blue-400 font-mono mt-1 block">
              {summary.totalTradesAcrossAll}
            </span>
            <span className="text-[10px] text-gray-400 block mt-0.5">0 Look-ahead Bias</span>
          </div>

          <div className="bg-cardBg border border-borderCol p-3.5 rounded-xl text-center">
            <span className="text-[11px] text-gray-400 block font-medium">Deducted Costs</span>
            <span className="text-base font-bold text-gray-300 font-mono mt-1 block">
              ₹40 Brokerage
            </span>
            <span className="text-[10px] text-gray-400 block mt-0.5">+ Taxes & Slippage</span>
          </div>
        </div>
      )}

      {/* Strategies Leaderboard Section */}
      {summary && (
        <div className="bg-cardBg border border-borderCol rounded-xl overflow-hidden shadow-lg">
          <div className="p-4 bg-darkBg border-b border-borderCol flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <span>32 Intraday Strategies Leaderboard</span>
                <span className="text-xs text-gray-400 font-normal">
                  (Ranked by Net Historical Win Rate)
                </span>
              </h3>
            </div>

            {/* Filter Toggle */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setFilterQualifiedOnly(!filterQualifiedOnly)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition border ${
                  filterQualifiedOnly
                    ? 'bg-emerald-950 text-emerald-400 border-emerald-700'
                    : 'bg-cardBg text-gray-300 border-borderCol hover:border-gray-600'
                }`}
              >
                <Filter className="w-3.5 h-3.5" />
                {filterQualifiedOnly ? 'Showing Qualified Only (≥75%)' : 'Show All 32 Strategies'}
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-gray-300">
              <thead className="bg-darkBg/60 text-gray-400 uppercase tracking-wider border-b border-borderCol">
                <tr>
                  <th className="py-3 px-4">Rank</th>
                  <th className="py-3 px-4">Strategy</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Total Trades</th>
                  <th className="py-3 px-4">Net Win Rate %</th>
                  <th className="py-3 px-4">Net Realized P&L</th>
                  <th className="py-3 px-4">Profit Factor</th>
                  <th className="py-3 px-4 text-right">Signal Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-borderCol font-mono">
                {displayedLeaderboard.map((strat) => {
                  const isQualified = strat.isQualifiedForSignals;

                  return (
                    <tr
                      key={strat.strategyId}
                      className={`hover:bg-darkBg/40 transition ${
                        isQualified ? 'bg-emerald-950/10' : ''
                      }`}
                    >
                      <td className="py-3 px-4 font-bold">
                        <span className={`inline-block w-6 text-center rounded px-1 py-0.5 text-[11px] ${
                          strat.rank <= 3
                            ? 'bg-amber-950 text-accentGold border border-amber-800'
                            : 'text-gray-400'
                        }`}>
                          #{strat.rank}
                        </span>
                      </td>

                      <td className="py-3 px-4 font-sans font-medium text-white">
                        <div className="flex items-center gap-2">
                          <span className="text-gray-400 text-[11px] font-mono">ID {strat.strategyId}</span>
                          <span className="font-semibold">{strat.strategyName}</span>
                        </div>
                      </td>

                      <td className="py-3 px-4 font-sans text-gray-400 text-[11px]">
                        {strat.category}
                      </td>

                      <td className="py-3 px-4 text-gray-300 font-mono">
                        {strat.totalTrades}
                        <span className="text-[10px] text-gray-400 ml-1">
                          ({strat.wins}W / {strat.losses}L)
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className={`font-bold font-mono text-sm ${
                            strat.netWinRate >= 75
                              ? 'text-emerald-400'
                              : strat.netWinRate >= 60
                              ? 'text-amber-400'
                              : 'text-red-400'
                          }`}>
                            {strat.netWinRate}%
                          </span>
                          <div className="w-16 bg-gray-800 rounded-full h-1.5 hidden sm:block">
                            <div
                              className={`h-1.5 rounded-full ${
                                strat.netWinRate >= 75
                                  ? 'bg-emerald-400'
                                  : strat.netWinRate >= 60
                                  ? 'bg-amber-400'
                                  : 'bg-red-400'
                              }`}
                              style={{ width: `${Math.min(100, strat.netWinRate)}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      <td className={`py-3 px-4 font-bold font-mono ${
                        strat.totalNetPnlInr >= 0 ? 'text-emerald-400' : 'text-red-400'
                      }`}>
                        {strat.totalNetPnlInr >= 0 ? '+' : ''}₹{strat.totalNetPnlInr.toLocaleString('en-IN')}
                      </td>

                      <td className="py-3 px-4 font-mono text-gray-300">
                        {strat.profitFactor.toFixed(2)}
                      </td>

                      <td className="py-3 px-4 text-right">
                        {isQualified ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-800">
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                            ACTIVE FOR SIGNALS
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-bold bg-red-950/60 text-red-400 border border-red-900/80">
                            <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
                            MUTED (&lt; 75%)
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Simulated Trades History Table */}
      {summary && summary.allTrades.length > 0 && (
        <div className="bg-cardBg border border-borderCol rounded-xl overflow-hidden shadow-lg">
          <div className="p-4 bg-darkBg border-b border-borderCol flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-white text-sm">
                Historical Simulated Trades Log
              </h3>
              <p className="text-xs text-gray-400">
                Detailed step-by-step executions on 5-minute closed candles (Total {summary.allTrades.length} trades recorded).
              </p>
            </div>

            {/* Filter by Strategy */}
            <select
              value={selectedStrategyId}
              onChange={(e) => setSelectedStrategyId(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))}
              className="bg-cardBg border border-borderCol rounded-lg px-3 py-1.5 text-xs text-gray-300 font-sans focus:outline-none focus:border-neutralBlue"
            >
              <option value="ALL">All Strategies (Recent 50 Trades)</option>
              {summary.leaderboard.map(s => (
                <option key={s.strategyId} value={s.strategyId}>
                  #{s.rank} ID {s.strategyId}: {s.strategyName} ({s.netWinRate}%)
                </option>
              ))}
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-gray-300">
              <thead className="bg-darkBg/60 text-gray-400 uppercase tracking-wider border-b border-borderCol">
                <tr>
                  <th className="py-3 px-4">Time (IST)</th>
                  <th className="py-3 px-4">Strategy</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Entry</th>
                  <th className="py-3 px-4">Stop Loss</th>
                  <th className="py-3 px-4">Target 1</th>
                  <th className="py-3 px-4">Exit Price</th>
                  <th className="py-3 px-4">Outcome</th>
                  <th className="py-3 px-4 text-right">Net P&L</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-borderCol font-mono">
                {displayedTrades.map((t) => {
                  const isBuy = t.action === 'BUY_CE';
                  const isWin = t.outcome.startsWith('WIN');

                  return (
                    <tr key={t.tradeId} className="hover:bg-darkBg/40 transition">
                      <td className="py-3 px-4 text-gray-300 whitespace-nowrap">
                        {t.candleTimeIST}
                      </td>

                      <td className="py-3 px-4 font-sans text-gray-300 max-w-[200px] truncate" title={t.strategyName}>
                        <span className="text-[11px] text-gray-400 font-mono mr-1">ID {t.strategyId}</span>
                        {t.strategyName}
                      </td>

                      <td className="py-3 px-4 font-sans font-bold">
                        <span className={`px-2 py-0.5 rounded text-[11px] ${
                          isBuy ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-red-950 text-red-400 border border-red-800'
                        }`}>
                          {t.action}
                        </span>
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
                        ₹{t.exitPrice.toFixed(2)}
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

                      <td className={`py-3 px-4 text-right font-bold ${
                        t.netPnlInr >= 0 ? 'text-emerald-400' : 'text-red-400'
                      }`}>
                        {t.netPnlInr >= 0 ? '+' : ''}₹{t.netPnlInr.toLocaleString('en-IN')}
                        <span className="text-[10px] text-gray-400 block font-normal">
                          ({t.netPnlPoints >= 0 ? '+' : ''}{t.netPnlPoints} pts)
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Educational & Risk Disclaimer */}
      <div className="p-4 bg-darkBg border border-borderCol rounded-xl flex items-start gap-3 text-xs text-gray-400">
        <AlertCircle className="w-5 h-5 text-accentGold flex-shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p>
            <strong className="text-white">Strict Win Rate Policy:</strong> केवळ ऐतिहासिक बॅकटेस्टमध्ये 75%+ Net Win Rate आणि सकारात्मक Net Expectancy देणाऱ्या स्ट्रॅटेजीजच लाईव्ह सिग्नल देण्यासाठी पात्र ठरतात.
          </p>
          <p>
            इतर सर्व स्ट्रॅटेजीज ऑटोमॅटिक म्यूट असतात, ज्यामुळे खोटे (false) सिग्नल्स टाळले जातात आणि भांडवल (capital) सुरक्षित राहते.
          </p>
        </div>
      </div>
    </div>
  );
};
