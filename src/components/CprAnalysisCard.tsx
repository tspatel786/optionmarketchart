import React from 'react';
import { Compass, Target, ArrowUpRight, ArrowDownRight, Layers, Sparkles, AlertCircle } from 'lucide-react';
import { CprEngine, type CprLevels } from '../engine/cprEngine';

interface CprAnalysisCardProps {
  cprLevels: CprLevels;
  currentPrice: number;
  instrument: string;
}

export const CprAnalysisCard: React.FC<CprAnalysisCardProps> = ({
  cprLevels,
  currentPrice,
  instrument,
}) => {
  const isNarrow = cprLevels.category === 'NARROW_CPR';
  const isWide = cprLevels.category === 'WIDE_CPR';

  const badgeColor = isNarrow
    ? 'bg-emerald-950 text-emerald-300 border-emerald-700 shadow-emerald-500/20'
    : isWide
    ? 'bg-purple-950 text-purple-300 border-purple-700 shadow-purple-500/20'
    : 'bg-blue-950 text-blue-300 border-blue-700';

  const isAboveCpr = currentPrice > cprLevels.cprTop;
  const isBelowCpr = currentPrice < cprLevels.cprBottom;
  const isInsideCpr = currentPrice >= cprLevels.cprBottom && currentPrice <= cprLevels.cprTop;

  return (
    <div className="bg-[#0d1424]/90 border border-gray-800/80 rounded-2xl p-4 sm:p-5 shadow-xl space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <span className="p-1.5 bg-cyan-500/20 text-cyan-400 rounded-lg">
            <Compass className="w-4 h-4" />
          </span>
          <div>
            <h3 className="text-sm sm:text-base font-black text-white flex items-center gap-2">
              CPR (Central Pivot Range) Daily Predictor
            </h3>
            <p className="text-[10px] sm:text-[11px] text-gray-400">
              आदल्या दिवसाच्या High, Low, Close वरून आजच्या दिवसाचा ट्रेंड अंदाज
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className={`px-2.5 py-1 rounded-full text-[11px] font-black uppercase border tracking-wider flex items-center gap-1 shadow-md ${badgeColor}`}>
            {isNarrow && <Sparkles className="w-3 h-3 text-emerald-400" />}
            {isNarrow ? 'NARROW CPR (TRENDING DAY)' : isWide ? 'WIDE CPR (SIDEWAYS DAY)' : 'AVERAGE CPR'}
          </span>
        </div>
      </div>

      {/* CPR Prediction Banner */}
      <div className="p-3 bg-black/40 border border-gray-800 rounded-xl space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-gray-300">दिवसाचा अंदाज (Day Forecast):</span>
          <span className="font-mono text-cyan-400 text-[11px]">
            Width: {cprLevels.cprWidth.toFixed(1)} pts ({cprLevels.cprWidthPercent}%)
          </span>
        </div>
        <p className="text-xs text-gray-200 font-medium">
          {cprLevels.prediction.recommendation}
        </p>
      </div>

      {/* CPR Levels Band & Position */}
      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        <div className="p-2.5 bg-black/50 rounded-xl border border-gray-800">
          <span className="text-[10px] text-gray-400 block font-medium">Top Central (TC)</span>
          <span className="text-xs sm:text-sm font-bold font-mono text-cyan-300 block mt-0.5">
            ₹{cprLevels.tc.toFixed(1)}
          </span>
        </div>

        <div className="p-2.5 bg-black/50 rounded-xl border border-cyan-800/60 shadow-inner">
          <span className="text-[10px] text-cyan-300 block font-bold">Central Pivot (P)</span>
          <span className="text-xs sm:text-sm font-black font-mono text-white block mt-0.5">
            ₹{cprLevels.pivot.toFixed(1)}
          </span>
        </div>

        <div className="p-2.5 bg-black/50 rounded-xl border border-gray-800">
          <span className="text-[10px] text-gray-400 block font-medium">Bottom Central (BC)</span>
          <span className="text-xs sm:text-sm font-bold font-mono text-cyan-300 block mt-0.5">
            ₹{cprLevels.bc.toFixed(1)}
          </span>
        </div>
      </div>

      {/* Price vs CPR Position Indicator */}
      <div className="flex items-center justify-between p-2.5 bg-gray-900/60 border border-gray-800 rounded-xl text-xs">
        <span className="text-gray-400">Current Price vs CPR:</span>
        <span className={`font-bold flex items-center gap-1 ${
          isAboveCpr ? 'text-emerald-400' : isBelowCpr ? 'text-rose-400' : 'text-amber-300'
        }`}>
          {isAboveCpr && <ArrowUpRight className="w-3.5 h-3.5" />}
          {isBelowCpr && <ArrowDownRight className="w-3.5 h-3.5" />}
          {isAboveCpr ? 'Above CPR (Bullish Territory ↗)' : isBelowCpr ? 'Below CPR (Bearish Territory ↘)' : 'Inside CPR (Range Resistance ↔)'}
        </span>
      </div>

      {/* Floor Pivots Grid: S1, S2, R1, R2 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs pt-1">
        <div className="p-2 bg-black/30 rounded-lg border border-gray-800/80">
          <span className="text-[9px] text-gray-400 block">Support 1 (S1)</span>
          <span className="text-xs font-mono font-bold text-emerald-400 block">₹{cprLevels.s1.toFixed(1)}</span>
        </div>
        <div className="p-2 bg-black/30 rounded-lg border border-gray-800/80">
          <span className="text-[9px] text-gray-400 block">Support 2 (S2)</span>
          <span className="text-xs font-mono font-bold text-green-300 block">₹{cprLevels.s2.toFixed(1)}</span>
        </div>
        <div className="p-2 bg-black/30 rounded-lg border border-gray-800/80">
          <span className="text-[9px] text-gray-400 block">Resistance 1 (R1)</span>
          <span className="text-xs font-mono font-bold text-rose-400 block">₹{cprLevels.r1.toFixed(1)}</span>
        </div>
        <div className="p-2 bg-black/30 rounded-lg border border-gray-800/80">
          <span className="text-[9px] text-gray-400 block">Resistance 2 (R2)</span>
          <span className="text-xs font-mono font-bold text-red-300 block">₹{cprLevels.r2.toFixed(1)}</span>
        </div>
      </div>
    </div>
  );
};
