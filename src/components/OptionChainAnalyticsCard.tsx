import React from 'react';
import { Layers, Activity, TrendingUp, TrendingDown, Target, ShieldAlert, BarChart2 } from 'lucide-react';
import type { OptionChainAnalysis } from '../engine/optionChainEngine';

interface OptionChainAnalyticsCardProps {
  analysis: OptionChainAnalysis;
  instrument: string;
}

export const OptionChainAnalyticsCard: React.FC<OptionChainAnalyticsCardProps> = ({
  analysis,
  instrument,
}) => {
  const isBull = analysis.sentiment === 'BULLISH' || analysis.sentiment === 'EXTREME_BULLISH';
  const isBear = analysis.sentiment === 'BEARISH' || analysis.sentiment === 'EXTREME_BEARISH';

  // Find max OI for relative bar width
  const maxOI = Math.max(...analysis.strikes.map(s => Math.max(s.callOI, s.putOI)), 1);

  return (
    <div className="bg-[#0d1424]/90 border border-gray-800/80 rounded-2xl p-4 sm:p-5 shadow-xl space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <span className="p-1.5 bg-blue-500/20 text-cyan-400 rounded-lg">
            <BarChart2 className="w-4 h-4" />
          </span>
          <div>
            <h3 className="text-sm sm:text-base font-black text-white flex items-center gap-2">
              Live Option Chain & PCR Analysis ({instrument})
            </h3>
            <p className="text-[10px] sm:text-[11px] text-gray-400">
              Put-Call Ratio • Open Interest (OI) • Max Pain Strike
            </p>
          </div>
        </div>

        {/* PCR Sentiment Badge */}
        <div className="flex items-center gap-2">
          <span className={`px-3 py-1 rounded-full text-xs font-black uppercase border tracking-wider flex items-center gap-1.5 shadow-md ${
            isBull
              ? 'bg-emerald-950 text-emerald-300 border-emerald-700'
              : isBear
              ? 'bg-rose-950 text-rose-300 border-rose-700'
              : 'bg-amber-950 text-amber-300 border-amber-700'
          }`}>
            {isBull && <TrendingUp className="w-3.5 h-3.5" />}
            {isBear && <TrendingDown className="w-3.5 h-3.5" />}
            PCR: {analysis.pcr.toFixed(2)} ({analysis.sentimentLabel})
          </span>
        </div>
      </div>

      {/* PCR & Max Pain Summary Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
        {/* Put-Call Ratio */}
        <div className="p-3 bg-black/50 rounded-xl border border-gray-800">
          <span className="text-[10px] text-gray-400 block font-medium">Put-Call Ratio (PCR)</span>
          <span className={`text-base sm:text-lg font-black font-mono mt-0.5 block ${
            analysis.pcr >= 1.05 ? 'text-emerald-400' : analysis.pcr <= 0.85 ? 'text-rose-400' : 'text-amber-300'
          }`}>
            {analysis.pcr.toFixed(2)}
          </span>
          <span className="text-[9px] text-gray-500 block mt-0.5">
            {analysis.pcr >= 1.05 ? 'Bullish Floor' : analysis.pcr <= 0.85 ? 'Bearish Ceiling' : 'Neutral Balance'}
          </span>
        </div>

        {/* Max Pain Strike */}
        <div className="p-3 bg-black/50 rounded-xl border border-gray-800">
          <span className="text-[10px] text-gray-400 block font-medium">Max Pain Strike</span>
          <span className="text-base sm:text-lg font-black font-mono text-cyan-300 mt-0.5 block">
            ₹{analysis.maxPainStrike}
          </span>
          <span className="text-[9px] text-gray-500 block mt-0.5">
            Option Writers Target
          </span>
        </div>

        {/* Highest Put OI (Support) */}
        <div className="p-3 bg-black/50 rounded-xl border border-gray-800">
          <span className="text-[10px] text-gray-400 block font-medium">Primary Support (Put OI)</span>
          <span className="text-base sm:text-lg font-black font-mono text-emerald-400 mt-0.5 block">
            ₹{analysis.highestPutOIStrike}
          </span>
          <span className="text-[9px] text-gray-500 block mt-0.5">
            Strongest Put Wall
          </span>
        </div>

        {/* Highest Call OI (Resistance) */}
        <div className="p-3 bg-black/50 rounded-xl border border-gray-800">
          <span className="text-[10px] text-gray-400 block font-medium">Primary Resistance (Call OI)</span>
          <span className="text-base sm:text-lg font-black font-mono text-rose-400 mt-0.5 block">
            ₹{analysis.highestCallOIStrike}
          </span>
          <span className="text-[9px] text-gray-500 block mt-0.5">
            Strongest Call Wall
          </span>
        </div>
      </div>

      {/* PCR Interpretation Banner */}
      <div className="p-2.5 bg-black/40 border border-gray-800 rounded-xl text-xs text-gray-300">
        <strong className="text-cyan-400">मार्केट संकेत (Market Bias): </strong>
        {analysis.recommendation}
      </div>

      {/* Mini Option Chain Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-center text-[11px] font-mono">
          <thead className="bg-black/60 text-gray-400 border-b border-gray-800 uppercase tracking-wider text-[10px]">
            <tr>
              <th className="py-2 px-2 text-right">Call OI</th>
              <th className="py-2 px-2 text-right">Call LTP</th>
              <th className="py-2 px-3 text-center text-white">Strike</th>
              <th className="py-2 px-2 text-left">Put LTP</th>
              <th className="py-2 px-2 text-left">Put OI</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/40">
            {analysis.strikes.map((s) => {
              const callWidth = Math.min(100, Math.max(5, (s.callOI / maxOI) * 100));
              const putWidth = Math.min(100, Math.max(5, (s.putOI / maxOI) * 100));

              return (
                <tr
                  key={s.strike}
                  className={`transition ${s.isAtm ? 'bg-cyan-950/40 font-bold' : 'hover:bg-white/[0.02]'}`}
                >
                  {/* Call OI Bar */}
                  <td className="py-2 px-2 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <span className="text-gray-300">{(s.callOI / 1000).toFixed(0)}k</span>
                      <div className="w-14 bg-gray-900 h-2 rounded-full overflow-hidden flex justify-end">
                        <div
                          className="bg-rose-500 h-2 rounded-full"
                          style={{ width: `${callWidth}%` }}
                        />
                      </div>
                    </div>
                  </td>

                  {/* Call LTP */}
                  <td className="py-2 px-2 text-right text-cyan-300">
                    ₹{s.callLtp.toFixed(1)}
                  </td>

                  {/* Strike Price */}
                  <td className="py-2 px-3 text-center">
                    <span className={`px-2 py-0.5 rounded font-bold ${
                      s.isAtm
                        ? 'bg-cyan-500 text-black shadow-md shadow-cyan-500/30'
                        : 'text-white'
                    }`}>
                      {s.strike} {s.isAtm && '• ATM'}
                    </span>
                  </td>

                  {/* Put LTP */}
                  <td className="py-2 px-2 text-left text-cyan-300">
                    ₹{s.putLtp.toFixed(1)}
                  </td>

                  {/* Put OI Bar */}
                  <td className="py-2 px-2 text-left">
                    <div className="flex items-center justify-start gap-1.5">
                      <div className="w-14 bg-gray-900 h-2 rounded-full overflow-hidden flex justify-start">
                        <div
                          className="bg-emerald-500 h-2 rounded-full"
                          style={{ width: `${putWidth}%` }}
                        />
                      </div>
                      <span className="text-gray-300">{(s.putOI / 1000).toFixed(0)}k</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
