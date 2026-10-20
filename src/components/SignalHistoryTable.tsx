import React from 'react';
import { History, TrendingUp, TrendingDown, PauseCircle, AlertCircle } from 'lucide-react';
import type { EvaluatedSignal } from '../engine/signalEngine';

interface SignalHistoryTableProps {
  signals: EvaluatedSignal[];
}

export const SignalHistoryTable: React.FC<SignalHistoryTableProps> = ({ signals }) => {
  return (
    <div className="bg-cardBg border border-borderCol rounded-xl overflow-hidden shadow-lg">
      <div className="p-4 bg-darkBg border-b border-borderCol flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History className="w-5 h-5 text-neutralBlue" />
          <h3 className="font-bold text-white text-sm">Signal History & Outcome Log</h3>
        </div>
        <span className="text-xs text-gray-400 font-mono">
          Strictly 5-Minute Closed Candles
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-gray-300">
          <thead className="bg-darkBg/60 text-gray-400 uppercase tracking-wider border-b border-borderCol">
            <tr>
              <th className="py-3 px-4">Time (IST)</th>
              <th className="py-3 px-4">Instrument</th>
              <th className="py-3 px-4">Type</th>
              <th className="py-3 px-4">Entry</th>
              <th className="py-3 px-4">Stop Loss</th>
              <th className="py-3 px-4">Target 1</th>
              <th className="py-3 px-4">Target 2</th>
              <th className="py-3 px-4">R:R</th>
              <th className="py-3 px-4">Trigger Pattern</th>
              <th className="py-3 px-4">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-borderCol">
            {signals.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-8 text-center text-gray-500 italic">
                  No signals recorded yet. Waiting for market 5m closed candles.
                </td>
              </tr>
            ) : (
              signals.map((sig, idx) => {
                const isBuy = sig.signalType === 'BUY';
                const isSell = sig.signalType === 'SELL';

                return (
                  <tr key={idx} className="hover:bg-darkBg/40 transition font-mono">
                    <td className="py-3 px-4 text-gray-300">
                      {sig.candleDateTimeIST}
                    </td>
                    <td className="py-3 px-4 font-bold text-white font-sans">
                      {sig.instrument}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold ${
                        isBuy
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                          : isSell
                          ? 'bg-red-950 text-red-400 border border-red-800'
                          : 'bg-amber-950 text-amber-300 border border-amber-800'
                      }`}>
                        {isBuy && <TrendingUp className="w-3 h-3" />}
                        {isSell && <TrendingDown className="w-3 h-3" />}
                        {sig.signalType}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-blue-400">
                      {sig.levels ? `₹${sig.levels.entryPrice.toFixed(2)}` : '—'}
                    </td>
                    <td className="py-3 px-4 text-bearRed">
                      {sig.levels ? `₹${sig.levels.stopLoss.toFixed(2)}` : '—'}
                    </td>
                    <td className="py-3 px-4 text-bullGreen">
                      {sig.levels ? `₹${sig.levels.target1.toFixed(2)}` : '—'}
                    </td>
                    <td className="py-3 px-4 text-emerald-300">
                      {sig.levels ? `₹${sig.levels.target2.toFixed(2)}` : '—'}
                    </td>
                    <td className="py-3 px-4 text-gray-300">
                      {sig.levels ? `1:${sig.levels.riskRewardRatio}` : '—'}
                    </td>
                    <td className="py-3 px-4 font-sans text-gray-300">
                      {sig.explanation.patterns[0]?.patternName || 'No Pattern'}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] bg-gray-800 text-gray-300">
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
