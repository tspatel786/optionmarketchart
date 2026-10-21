import React from 'react';
import { History, TrendingUp, TrendingDown, PauseCircle, AlertCircle } from 'lucide-react';
import type { EvaluatedSignal } from '../engine/signalEngine';

interface SignalHistoryTableProps {
  signals: EvaluatedSignal[];
}

export const SignalHistoryTable: React.FC<SignalHistoryTableProps> = ({ signals }) => {
  return (
    <div className="bg-[#0d1424]/90 border border-gray-800/80 rounded-2xl overflow-hidden shadow-xl">
      <div className="p-4 bg-gradient-to-r from-gray-900/90 via-[#0d1424] to-gray-900/90 border-b border-gray-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History className="w-5 h-5 text-cyan-400" />
          <h3 className="font-bold text-white text-sm">Signal History & Outcome Log</h3>
        </div>
        <span className="text-[11px] text-gray-400 font-mono">
          Strictly 5-Minute Closed Candles
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-gray-300">
          <thead className="bg-black/40 text-gray-400 uppercase tracking-wider border-b border-gray-800">
            <tr>
              <th className="py-3 px-4">Time (IST)</th>
              <th className="py-3 px-4">Instrument</th>
              <th className="py-3 px-4">Type</th>
              <th className="py-3 px-4">Strike / Contract</th>
              <th className="py-3 px-4">Entry</th>
              <th className="py-3 px-4">Stop Loss</th>
              <th className="py-3 px-4">Target 1</th>
              <th className="py-3 px-4">Target 2</th>
              <th className="py-3 px-4">R:R</th>
              <th className="py-3 px-4">Trigger Pattern</th>
              <th className="py-3 px-4">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/60">
            {signals.length === 0 ? (
              <tr>
                <td colSpan={11} className="py-8 text-center text-gray-500 italic">
                  No signals recorded yet. Waiting for market 5m closed candles.
                </td>
              </tr>
            ) : (
              signals.map((sig, idx) => {
                const isBuy = sig.signalType === 'BUY';
                const isSell = sig.signalType === 'SELL';

                return (
                  <tr key={idx} className="hover:bg-white/[0.02] transition font-mono">
                    <td className="py-3 px-4 text-gray-300">
                      {sig.candleDateTimeIST}
                    </td>
                    <td className="py-3 px-4 font-bold text-white font-sans">
                      {sig.instrument}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                        isBuy
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                          : isSell
                          ? 'bg-rose-950 text-rose-400 border border-rose-800'
                          : 'bg-amber-950 text-amber-300 border border-amber-800'
                      }`}>
                        {isBuy && <TrendingUp className="w-3 h-3" />}
                        {isSell && <TrendingDown className="w-3 h-3" />}
                        {sig.signalType}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-cyan-300">
                      {sig.optionContract ? sig.optionContract.symbol : 'ATM'}
                    </td>
                    <td className="py-3 px-4 text-cyan-400">
                      {sig.levels ? `₹${sig.levels.entryPrice.toFixed(1)}` : '—'}
                    </td>
                    <td className="py-3 px-4 text-rose-400">
                      {sig.levels ? `₹${sig.levels.stopLoss.toFixed(1)}` : '—'}
                    </td>
                    <td className="py-3 px-4 text-emerald-400">
                      {sig.levels ? `₹${sig.levels.target1.toFixed(1)}` : '—'}
                    </td>
                    <td className="py-3 px-4 text-green-300">
                      {sig.levels ? `₹${sig.levels.target2.toFixed(1)}` : '—'}
                    </td>
                    <td className="py-3 px-4 text-gray-300">
                      {sig.levels ? `1:${sig.levels.riskRewardRatio}` : '—'}
                    </td>
                    <td className="py-3 px-4 font-sans text-gray-300">
                      {sig.chartPattern?.patternName || sig.explanation.patterns[0]?.patternName || 'Price Action'}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] bg-gray-800 text-gray-300 border border-gray-700">
                        {sig.status}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
