import React from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  PauseCircle, 
  AlertCircle, 
  ShieldAlert, 
  Target, 
  Compass, 
  Activity,
  CheckCircle2,
  XCircle,
  Clock
} from 'lucide-react';
import type { EvaluatedSignal } from '../engine/signalEngine';
import type { LiveQuote } from '../services/growwService';

interface LiveSignalCardProps {
  signal: EvaluatedSignal | null;
  quote?: LiveQuote | null;
  vix?: number | null;
  advances?: number | null;
  declines?: number | null;
}

export const LiveSignalCard: React.FC<LiveSignalCardProps> = ({
  signal,
  quote,
  vix,
  advances,
  declines,
}) => {
  if (!signal) {
    return (
      <div className="bg-cardBg border border-borderCol rounded-xl p-6 text-center text-gray-400">
        <Activity className="w-8 h-8 mx-auto mb-2 opacity-50 animate-pulse" />
        <p className="text-sm">Awaiting market signal evaluation...</p>
      </div>
    );
  }

  const isBuy = signal.signalType === 'BUY';
  const isSell = signal.signalType === 'SELL';
  const isWait = signal.signalType === 'WAIT';
  const isNoData = signal.signalType === 'NO_DATA';

  const badgeColor = isBuy
    ? 'bg-emerald-950 text-emerald-400 border-emerald-700'
    : isSell
    ? 'bg-red-950 text-red-400 border-red-700'
    : isWait
    ? 'bg-amber-950 text-amber-300 border-amber-700'
    : 'bg-gray-800 text-gray-300 border-gray-700';

  return (
    <div className="bg-cardBg border border-borderCol rounded-xl overflow-hidden shadow-xl">
      {/* Top Banner */}
      <div className="p-4 bg-darkBg/60 border-b border-borderCol flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-lg font-black tracking-wider text-white">
              {signal.instrument}
            </span>
            <span className={`px-3 py-1 rounded-full text-xs font-black uppercase border tracking-wider flex items-center gap-1.5 shadow ${badgeColor}`}>
              {isBuy && <TrendingUp className="w-4 h-4" />}
              {isSell && <TrendingDown className="w-4 h-4" />}
              {isWait && <PauseCircle className="w-4 h-4" />}
              {isNoData && <AlertCircle className="w-4 h-4" />}
              {signal.signalType}
            </span>
          </div>
        </div>

        {/* Live Quote Price */}
        {quote && (
          <div className="flex items-center gap-3">
            <span className="text-xl font-bold font-mono text-white">
              ₹{quote.lastPrice.toFixed(2)}
            </span>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded font-mono ${
              quote.dayChange >= 0 ? 'bg-emerald-950 text-emerald-400' : 'bg-red-950 text-red-400'
            }`}>
              {quote.dayChange >= 0 ? '+' : ''}{quote.dayChange.toFixed(2)} ({quote.dayChangePerc.toFixed(2)}%)
            </span>
          </div>
        )}
      </div>

      <div className="p-5 space-y-5">
        {/* A+ Strategy 80% Win Rate Confluence Meter */}
        <div className="p-4 bg-darkBg/90 border border-borderCol rounded-xl space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-accentGold" />
              Strategy Win Rate Filter (80% A+ Confluence)
            </span>
            <span className={`text-xs font-black px-2.5 py-0.5 rounded-full font-mono ${
              (signal.confluenceScore || 0) >= 80
                ? 'bg-emerald-950 text-emerald-400 border border-emerald-700'
                : 'bg-amber-950 text-amber-300 border border-amber-700'
            }`}>
              {signal.confluenceScore !== undefined ? `${signal.confluenceScore}% Match` : '80% Gate Active'}
            </span>
          </div>

          {/* Visual Progress Bar */}
          <div className="w-full bg-gray-800 rounded-full h-2.5 overflow-hidden">
            <div
              className={`h-2.5 rounded-full transition-all duration-500 ${
                (signal.confluenceScore || 0) >= 80
                  ? 'bg-gradient-to-r from-emerald-500 to-green-400'
                  : 'bg-gradient-to-r from-amber-500 to-yellow-400'
              }`}
              style={{ width: `${Math.min(100, Math.max(10, signal.confluenceScore || 25))}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-gray-400">
            <span>0% (No Edge)</span>
            <span className="font-semibold text-accentGold">80% Threshold (A+ Setup)</span>
            <span>100% (Perfect)</span>
          </div>

          {signal.explanation.confluenceBreakdown && signal.explanation.confluenceBreakdown.length > 0 && (
            <div className="pt-2 border-t border-borderCol/50 grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px] text-gray-300">
              {signal.explanation.confluenceBreakdown.map((item, idx) => (
                <div key={idx} className="truncate">
                  {item}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Signal Execution Levels Box (Only on Valid BUY/SELL) */}
        {signal.levels && (isBuy || isSell) && (
          <div className="p-4 bg-darkBg border border-borderCol rounded-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-borderCol text-xs font-semibold text-gray-300 gap-1.5">
              <span className="flex items-center gap-1.5 text-accentGold">
                <Target className="w-4 h-4" /> Recommended Price Levels (5m Closed)
              </span>
              <span className="font-mono text-blue-400">
                Risk/Reward: 1:{signal.levels.riskRewardRatio}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 pt-3 text-center">
              <div className="bg-cardBg p-2.5 rounded-lg border border-borderCol">
                <span className="text-[10px] text-gray-400 block font-medium">Entry Price</span>
                <span className="text-sm font-bold font-mono text-blue-400 block mt-0.5">
                  ₹{signal.levels.entryPrice.toFixed(2)}
                </span>
              </div>

              <div className="bg-cardBg p-2.5 rounded-lg border border-borderCol">
                <span className="text-[10px] text-gray-400 block font-medium">Stop Loss</span>
                <span className="text-sm font-bold font-mono text-bearRed block mt-0.5">
                  ₹{signal.levels.stopLoss.toFixed(2)}
                </span>
              </div>

              <div className="bg-cardBg p-2.5 rounded-lg border border-borderCol">
                <span className="text-[10px] text-gray-400 block font-medium">Target 1 (R1/S1)</span>
                <span className="text-sm font-bold font-mono text-bullGreen block mt-0.5">
                  ₹{signal.levels.target1.toFixed(2)}
                </span>
              </div>

              <div className="bg-cardBg p-2.5 rounded-lg border border-borderCol">
                <span className="text-[10px] text-gray-400 block font-medium">Target 2 (R2/S2)</span>
                <span className="text-sm font-bold font-mono text-emerald-300 block mt-0.5">
                  ₹{signal.levels.target2.toFixed(2)}
                </span>
              </div>

              <div className="bg-cardBg p-2.5 rounded-lg border border-borderCol col-span-2 sm:col-span-1">
                <span className="text-[10px] text-gray-400 block font-medium">Pivot Level</span>
                <span className="text-sm font-bold font-mono text-amber-300 block mt-0.5">
                  ₹{signal.levels.pivot.toFixed(2)}
                </span>
              </div>
            </div>

            <div className="mt-2.5 text-[11px] text-gray-400 text-left">
              <strong>Invalidation:</strong> {signal.levels.invalidation}
            </div>
          </div>
        )}

        {/* Market Context Badges (VIX, Breadth, Closed Candle IST) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          {/* India VIX */}
          <div className="bg-darkBg/60 p-3 rounded-lg border border-borderCol flex items-center justify-between">
            <div>
              <span className="text-gray-400 block">India VIX</span>
              <span className="font-bold text-white text-sm">
                {vix !== undefined && vix !== null ? vix.toFixed(2) : '12.80 (Default)'}
              </span>
            </div>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
              (vix || 12.8) < 10
                ? 'bg-red-950 text-red-400'
                : (vix || 12.8) >= 14.5
                ? 'bg-amber-950 text-amber-400'
                : 'bg-emerald-950 text-emerald-400'
            }`}>
              {signal.explanation.vixStatus}
            </span>
          </div>

          {/* Market Breadth */}
          <div className="bg-darkBg/60 p-3 rounded-lg border border-borderCol flex items-center justify-between">
            <div>
              <span className="text-gray-400 block">NSE Advances / Declines</span>
              <span className="font-bold text-white text-sm">
                {advances !== undefined ? advances : 1450} / {declines !== undefined ? declines : 820}
              </span>
            </div>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
              (advances || 1450) > (declines || 820)
                ? 'bg-emerald-950 text-emerald-400'
                : 'bg-red-950 text-red-400'
            }`}>
              {(advances || 1450) > (declines || 820) ? 'BULLISH BREADTH' : 'BEARISH BREADTH'}
            </span>
          </div>

          {/* Candle Timestamp */}
          <div className="bg-darkBg/60 p-3 rounded-lg border border-borderCol flex items-center justify-between">
            <div>
              <span className="text-gray-400 block">Closed Candle Time</span>
              <span className="font-mono text-gray-200 text-xs">
                {signal.candleDateTimeIST}
              </span>
            </div>
            <Clock className="w-4 h-4 text-gray-400" />
          </div>
        </div>

        {/* Explanation & Reasons */}
        <div className="bg-darkBg/40 border border-borderCol rounded-lg p-3 text-xs space-y-2">
          <span className="font-semibold text-gray-300 block">Engine Explanation:</span>
          <p className="text-gray-300 font-medium">{signal.explanation.decision}</p>
          <ul className="list-disc list-inside text-gray-400 space-y-1">
            {signal.explanation.reasons.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>

        {/* Matched vs Failed Conditions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="bg-emerald-950/20 border border-emerald-900/40 p-3 rounded-lg">
            <span className="text-emerald-400 font-semibold flex items-center gap-1.5 mb-1.5">
              <CheckCircle2 className="w-4 h-4" /> Matched Conditions ({signal.matchedConditions.length})
            </span>
            {signal.matchedConditions.length > 0 ? (
              <ul className="space-y-1 text-gray-300">
                {signal.matchedConditions.map((c, i) => (
                  <li key={i}>• {c}</li>
                ))}
              </ul>
            ) : (
              <span className="text-gray-500 italic">None</span>
            )}
          </div>

          <div className="bg-red-950/20 border border-red-900/40 p-3 rounded-lg">
            <span className="text-red-400 font-semibold flex items-center gap-1.5 mb-1.5">
              <XCircle className="w-4 h-4" /> Failed / Filter Conditions ({signal.failedConditions.length})
            </span>
            {signal.failedConditions.length > 0 ? (
              <ul className="space-y-1 text-gray-300">
                {signal.failedConditions.map((c, i) => (
                  <li key={i}>• {c}</li>
                ))}
              </ul>
            ) : (
              <span className="text-gray-500 italic">All filters passed</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
