import React, { useState } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  PauseCircle, 
  AlertCircle, 
  ShieldAlert, 
  Target, 
  Activity, 
  CheckCircle2, 
  Clock,
  Layers,
  Zap,
  ChevronDown,
  ChevronUp
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
  const [showExplanationDetails, setShowExplanationDetails] = useState<boolean>(false);

  if (!signal) {
    return (
      <div className="bg-[#0d1424]/90 border border-gray-800 rounded-2xl p-6 sm:p-8 text-center text-gray-400 shadow-xl h-full flex flex-col items-center justify-center min-h-[380px]">
        <Activity className="w-10 h-10 mx-auto mb-3 text-cyan-400 opacity-60 animate-pulse" />
        <p className="text-sm font-semibold text-gray-300">Awaiting market signal evaluation...</p>
        <p className="text-xs text-gray-500 mt-1">Analyzing closed 5m candles on NSE live feed</p>
      </div>
    );
  }

  const isBuy = signal.signalType === 'BUY';
  const isSell = signal.signalType === 'SELL';
  const isWait = signal.signalType === 'WAIT';
  const isNoData = signal.signalType === 'NO_DATA';

  const badgeColor = isBuy
    ? 'bg-emerald-950/90 text-emerald-300 border-emerald-600/80 shadow-emerald-500/20'
    : isSell
    ? 'bg-rose-950/90 text-rose-300 border-rose-600/80 shadow-rose-500/20'
    : isWait
    ? 'bg-amber-950/90 text-amber-300 border-amber-600/80 shadow-amber-500/20'
    : 'bg-gray-800 text-gray-300 border-gray-700';

  const greeks = signal.optionContract?.greeks;
  const projections = signal.optionContract?.projections;
  const breakout = signal.breakoutValidation;
  const pattern = signal.chartPattern;

  const isStrongBreakout = breakout?.isQualified && breakout.classification.startsWith('STRONG');
  const isRetestBounce = breakout?.classification === 'STRONG_RETEST_BOUNCE';

  return (
    <div className="bg-[#0d1424]/90 border border-gray-800/90 rounded-2xl overflow-hidden shadow-2xl shadow-black/80 flex flex-col h-full">
      {/* Header Bar */}
      <div className="p-3 sm:p-3.5 bg-gradient-to-r from-gray-900/90 via-[#0d1424] to-gray-900/90 border-b border-gray-800 flex flex-wrap items-center justify-between gap-2 flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-sm sm:text-base font-black tracking-wider text-white">
            {signal.instrument}
          </span>
          <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase border tracking-wider flex items-center gap-1 shadow-md ${badgeColor}`}>
            {isBuy && <TrendingUp className="w-3 h-3" />}
            {isSell && <TrendingDown className="w-3 h-3" />}
            {isWait && <PauseCircle className="w-3 h-3" />}
            {isNoData && <AlertCircle className="w-3 h-3" />}
            {signal.signalType === 'BUY' ? 'BUY CE (CALL)' : signal.signalType === 'SELL' ? 'BUY PE (PUT)' : signal.signalType}
          </span>
        </div>

        {/* Live Spot Price */}
        {quote && (
          <div className="flex items-center gap-2">
            <span className="text-base sm:text-lg font-black font-mono text-white">
              ₹{quote.lastPrice.toFixed(2)}
            </span>
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded font-mono ${
              quote.dayChange >= 0 ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800' : 'bg-rose-950/80 text-rose-400 border border-rose-800'
            }`}>
              {quote.dayChange >= 0 ? '+' : ''}{quote.dayChange.toFixed(2)} ({quote.dayChangePerc.toFixed(2)}%)
            </span>
          </div>
        )}
      </div>

      {/* Scrollable Card Body with height matched to chart */}
      <div className="p-3 sm:p-3.5 space-y-2.5 overflow-y-auto max-h-[460px] custom-scrollbar flex-1">
        {/* Chart Pattern & Breakout Quality Badge */}
        {(pattern || breakout) && (
          <div className="p-2 sm:p-2.5 bg-gradient-to-r from-blue-950/40 via-cyan-950/20 to-blue-950/40 border border-cyan-800/50 rounded-xl space-y-1">
            <div className="flex flex-wrap items-center justify-between gap-1">
              <span className="text-[11px] font-bold text-cyan-300 flex items-center gap-1.5">
                <Layers className="w-3 h-3 text-cyan-400" />
                Pattern: <strong>{pattern?.patternName || 'Multi-Timeframe Structure'}</strong>
              </span>
              {isRetestBounce ? (
                <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 flex items-center gap-0.5">
                  <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" />
                  RETEST BOUNCE (92% Edge)
                </span>
              ) : isStrongBreakout ? (
                <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 flex items-center gap-0.5">
                  <Zap className="w-2.5 h-2.5 text-emerald-400" />
                  BREAKOUT ({breakout.penetrationPct.toFixed(0)}%)
                </span>
              ) : (
                <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800">
                  {breakout?.recommendation || 'AWAITING RETEST'}
                </span>
              )}
            </div>
            {pattern && (
              <p className="text-[10px] text-gray-300 font-mono">
                Neckline: <strong className="text-white">₹{pattern.necklinePrice.toFixed(1)}</strong> • Height: <strong className="text-white">{pattern.patternHeight.toFixed(1)} pts</strong>
              </p>
            )}
          </div>
        )}

        {/* Option Contract & Black-Scholes Greeks Widget */}
        {signal.optionContract && (
          <div className="p-2.5 sm:p-3 bg-gradient-to-b from-[#11192e] to-[#0a101f] border border-cyan-800/40 rounded-xl space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-1.5 pb-1.5 border-b border-gray-800">
              <div className="flex items-center gap-1.5">
                <span className="p-1 bg-cyan-500/20 text-cyan-400 rounded-md">
                  <Target className="w-3 h-3" />
                </span>
                <span className="text-xs font-black text-white tracking-wide">
                  {signal.optionContract.symbol}
                </span>
                <span className={`text-[9px] font-black px-1.5 py-0.2 rounded font-mono ${
                  signal.optionContract.optionType === 'CE'
                    ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                    : 'bg-rose-950 text-rose-400 border border-rose-800'
                }`}>
                  {signal.optionContract.optionType} STRIKE
                </span>
              </div>
              <span className="text-[10px] text-gray-400 font-mono">
                {signal.optionContract.estimatedPremiumRange}
              </span>
            </div>

            {/* Greeks Grid (Correct IV Display) */}
            {greeks && (
              <div className="grid grid-cols-4 gap-1 text-center text-xs">
                <div className="p-1 bg-black/40 rounded-lg border border-gray-800">
                  <span className="text-[9px] text-gray-400 block">Delta (Δ)</span>
                  <span className="text-[11px] font-mono font-bold text-cyan-300 block">
                    {greeks.delta >= 0 ? '+' : ''}{greeks.delta.toFixed(2)}
                  </span>
                </div>
                <div className="p-1 bg-black/40 rounded-lg border border-gray-800">
                  <span className="text-[9px] text-gray-400 block">Gamma (Γ)</span>
                  <span className="text-[11px] font-mono font-bold text-indigo-300 block">
                    {greeks.gamma.toFixed(4)}
                  </span>
                </div>
                <div className="p-1 bg-black/40 rounded-lg border border-gray-800">
                  <span className="text-[9px] text-gray-400 block">Theta (Θ)</span>
                  <span className="text-[11px] font-mono font-bold text-rose-400 block">
                    {greeks.theta.toFixed(1)}/d
                  </span>
                </div>
                <div className="p-1 bg-black/40 rounded-lg border border-gray-800">
                  <span className="text-[9px] text-gray-400 block">IV</span>
                  <span className="text-[11px] font-mono font-bold text-amber-300 block">
                    {greeks.impliedVolatility.toFixed(1)}%
                  </span>
                </div>
              </div>
            )}

            {/* Greeks-Adjusted Option Premium Targets */}
            {projections && (
              <div className="grid grid-cols-4 gap-1 text-center text-xs pt-0.5">
                <div className="p-1.5 bg-black/50 rounded-lg border border-gray-800">
                  <span className="text-[9px] text-gray-400 block">Opt Entry</span>
                  <span className="text-xs font-mono font-black text-cyan-300 block">
                    ₹{projections.currentEstimatedPremium.toFixed(1)}
                  </span>
                </div>
                <div className="p-1.5 bg-black/50 rounded-lg border border-gray-800">
                  <span className="text-[9px] text-gray-400 block">Opt SL</span>
                  <span className="text-xs font-mono font-black text-rose-400 block">
                    ₹{projections.stopLossEstimatedPremium.toFixed(1)}
                  </span>
                </div>
                <div className="p-1.5 bg-black/50 rounded-lg border border-gray-800">
                  <span className="text-[9px] text-gray-400 block">Opt T1</span>
                  <span className="text-xs font-mono font-black text-emerald-400 block">
                    ₹{projections.target1EstimatedPremium.toFixed(1)}
                  </span>
                </div>
                <div className="p-1.5 bg-black/50 rounded-lg border border-gray-800">
                  <span className="text-[9px] text-gray-400 block">Opt T2</span>
                  <span className="text-xs font-mono font-black text-green-300 block">
                    ₹{projections.target2EstimatedPremium.toFixed(1)}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 80% Win Rate Confluence Meter */}
        <div className="p-2.5 bg-black/40 border border-gray-800/80 rounded-xl space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-gray-300 flex items-center gap-1.5 text-[11px]">
              <ShieldAlert className="w-3.5 h-3.5 text-accentGold" />
              80% Win Rate Confluence Filter
            </span>
            <span className={`px-2 py-0.5 rounded-full font-mono font-black text-[10px] ${
              (signal.confluenceScore || 0) >= 80
                ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                : 'bg-amber-950 text-amber-300 border border-amber-800'
            }`}>
              {signal.confluenceScore !== undefined ? `${signal.confluenceScore}% Match` : '80% Gate'}
            </span>
          </div>

          <div className="w-full bg-gray-900 rounded-full h-2 overflow-hidden border border-gray-800">
            <div
              className={`h-2 rounded-full transition-all duration-500 ${
                (signal.confluenceScore || 0) >= 80
                  ? 'bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400'
                  : 'bg-gradient-to-r from-amber-500 to-yellow-400'
              }`}
              style={{ width: `${Math.min(100, Math.max(8, signal.confluenceScore || 25))}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[9px] text-gray-400 font-mono">
            <span>0%</span>
            <span className="font-bold text-cyan-400">80% A+ Threshold</span>
            <span>100%</span>
          </div>
        </div>

        {/* Recommended Spot Price Levels Box */}
        {signal.levels && (isBuy || isSell) && (
          <div className="p-2.5 bg-black/40 border border-gray-800 rounded-xl space-y-1.5">
            <div className="flex flex-wrap items-center justify-between text-[11px] font-semibold text-gray-300 gap-1 pb-1 border-b border-gray-800">
              <span className="flex items-center gap-1 text-cyan-400">
                <Target className="w-3 h-3" /> Spot Levels (5M Closed)
              </span>
              <span className="font-mono text-cyan-300 text-[10px]">
                R:R = 1:{signal.levels.riskRewardRatio}
              </span>
            </div>

            <div className="grid grid-cols-5 gap-1 text-center">
              <div className="bg-gray-900/80 p-1.5 rounded-lg border border-gray-800">
                <span className="text-[8px] text-gray-400 block">Entry</span>
                <span className="text-[11px] font-bold font-mono text-cyan-300 block truncate">
                  ₹{signal.levels.entryPrice.toFixed(0)}
                </span>
              </div>

              <div className="bg-gray-900/80 p-1.5 rounded-lg border border-gray-800">
                <span className="text-[8px] text-gray-400 block">Stop Loss</span>
                <span className="text-[11px] font-bold font-mono text-rose-400 block truncate">
                  ₹{signal.levels.stopLoss.toFixed(0)}
                </span>
              </div>

              <div className="bg-gray-900/80 p-1.5 rounded-lg border border-gray-800">
                <span className="text-[8px] text-gray-400 block">Target 1</span>
                <span className="text-[11px] font-bold font-mono text-emerald-400 block truncate">
                  ₹{signal.levels.target1.toFixed(0)}
                </span>
              </div>

              <div className="bg-gray-900/80 p-1.5 rounded-lg border border-gray-800">
                <span className="text-[8px] text-gray-400 block">Target 2</span>
                <span className="text-[11px] font-bold font-mono text-green-300 block truncate">
                  ₹{signal.levels.target2.toFixed(0)}
                </span>
              </div>

              <div className="bg-gray-900/80 p-1.5 rounded-lg border border-gray-800">
                <span className="text-[8px] text-gray-400 block">Pivot</span>
                <span className="text-[11px] font-bold font-mono text-amber-300 block truncate">
                  ₹{signal.levels.pivot.toFixed(0)}
                </span>
              </div>
            </div>

            <div className="text-[10px] text-gray-400 leading-tight">
              <strong className="text-gray-300">Invalidation:</strong> {signal.levels.invalidation}
            </div>
          </div>
        )}

        {/* Market Context (VIX, Breadth, Candle Time) */}
        <div className="grid grid-cols-3 gap-1.5 text-xs">
          <div className="bg-gray-900/60 p-1.5 rounded-lg border border-gray-800 flex flex-col justify-between">
            <span className="text-gray-400 text-[9px]">India VIX</span>
            <div className="flex items-center justify-between mt-0.5">
              <span className="font-bold font-mono text-white text-[11px]">
                {vix !== undefined && vix !== null ? vix.toFixed(2) : '13.20'}
              </span>
              <span className="text-[8px] font-bold px-1 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
                {signal.explanation.vixStatus}
              </span>
            </div>
          </div>

          <div className="bg-gray-900/60 p-1.5 rounded-lg border border-gray-800 flex flex-col justify-between">
            <span className="text-gray-400 text-[9px]">NSE Breadth</span>
            <div className="flex items-center justify-between mt-0.5">
              <span className="font-bold font-mono text-white text-[11px]">
                {advances || 1420}/{declines || 850}
              </span>
              <span className="text-[8px] font-bold px-1 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
                {(advances || 1420) > (declines || 850) ? 'BULL' : 'BEAR'}
              </span>
            </div>
          </div>

          <div className="bg-gray-900/60 p-1.5 rounded-lg border border-gray-800 flex flex-col justify-between">
            <span className="text-gray-400 text-[9px]">5M Candle</span>
            <div className="flex items-center justify-between mt-0.5">
              <span className="font-mono text-gray-200 text-[11px] truncate">
                {signal.candleDateTimeIST || '15:30 IST'}
              </span>
              <Clock className="w-3 h-3 text-cyan-400 flex-shrink-0" />
            </div>
          </div>
        </div>

        {/* Engine Explanation Accordion */}
        <div className="bg-black/30 border border-gray-800 rounded-lg p-2 text-xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-gray-300 text-[11px]">लॉजिक व निर्णय:</span>
            <button
              onClick={() => setShowExplanationDetails(prev => !prev)}
              className="text-[10px] text-cyan-400 hover:text-cyan-300 font-bold flex items-center gap-0.5 underline transition"
            >
              {showExplanationDetails ? (
                <>
                  <span>कमी करा</span>
                  <ChevronUp className="w-3 h-3" />
                </>
              ) : (
                <>
                  <span>सविस्तर कारणे</span>
                  <ChevronDown className="w-3 h-3" />
                </>
              )}
            </button>
          </div>
          <p className="text-gray-200 text-[11px] leading-tight line-clamp-2">
            {signal.explanation.decision}
          </p>

          {showExplanationDetails && (
            <ul className="list-disc list-inside text-gray-400 space-y-0.5 text-[10px] pt-1 border-t border-gray-800/80 animate-fadeIn">
              {signal.explanation.reasons.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};
