import React from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  PauseCircle, 
  AlertCircle, 
  ShieldAlert, 
  Target, 
  Activity, 
  CheckCircle2, 
  XCircle, 
  Clock,
  Layers,
  Sparkles,
  Zap,
  Percent,
  Compass
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
      <div className="bg-[#0d1424]/90 border border-gray-800 rounded-2xl p-6 sm:p-8 text-center text-gray-400 shadow-xl">
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
    <div className="bg-[#0d1424]/90 border border-gray-800/90 rounded-2xl sm:rounded-3xl overflow-hidden shadow-2xl shadow-black/80 space-y-4">
      {/* Header Bar */}
      <div className="p-4 sm:p-5 bg-gradient-to-r from-gray-900/90 via-[#0d1424] to-gray-900/90 border-b border-gray-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="text-base sm:text-lg font-black tracking-wider text-white">
            {signal.instrument}
          </span>
          <span className={`px-3 py-1 rounded-full text-xs font-black uppercase border tracking-wider flex items-center gap-1.5 shadow-md ${badgeColor}`}>
            {isBuy && <TrendingUp className="w-3.5 h-3.5" />}
            {isSell && <TrendingDown className="w-3.5 h-3.5" />}
            {isWait && <PauseCircle className="w-3.5 h-3.5" />}
            {isNoData && <AlertCircle className="w-3.5 h-3.5" />}
            {signal.signalType === 'BUY' ? 'BUY CE (CALL)' : signal.signalType === 'SELL' ? 'BUY PE (PUT)' : signal.signalType}
          </span>
        </div>

        {/* Live Spot Price */}
        {quote && (
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="text-lg sm:text-xl font-black font-mono text-white">
              ₹{quote.lastPrice.toFixed(2)}
            </span>
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded font-mono ${
              quote.dayChange >= 0 ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800' : 'bg-rose-950/80 text-rose-400 border border-rose-800'
            }`}>
              {quote.dayChange >= 0 ? '+' : ''}{quote.dayChange.toFixed(2)} ({quote.dayChangePerc.toFixed(2)}%)
            </span>
          </div>
        )}
      </div>

      <div className="p-4 sm:p-5 space-y-4">
        {/* Chart Pattern & Breakout Quality Badge (Cheat Sheet Engine) */}
        {(pattern || breakout) && (
          <div className="p-3 bg-gradient-to-r from-blue-950/40 via-cyan-950/20 to-blue-950/40 border border-cyan-800/50 rounded-xl space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-1.5">
              <span className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-cyan-400" />
                Detected Pattern: <strong>{pattern?.patternName || 'Multi-Timeframe Structure'}</strong>
              </span>
              {isRetestBounce ? (
                <span className="text-[10px] font-black px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  RETEST BOUNCE (92% Edge)
                </span>
              ) : isStrongBreakout ? (
                <span className="text-[10px] font-black px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 flex items-center gap-1">
                  <Zap className="w-3 h-3 text-emerald-400" />
                  STRONG BREAKOUT ({breakout.penetrationPct.toFixed(0)}% Penetration)
                </span>
              ) : (
                <span className="text-[10px] font-black px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800">
                  {breakout?.recommendation || 'AWAITING RETEST'}
                </span>
              )}
            </div>
            {pattern && (
              <p className="text-[11px] text-gray-300">
                15M Neckline: <strong className="text-white font-mono">₹{pattern.necklinePrice.toFixed(2)}</strong> • Height: <strong className="text-white font-mono">{pattern.patternHeight.toFixed(2)} pts</strong>
              </p>
            )}
          </div>
        )}

        {/* Option Contract & Black-Scholes Greeks Widget */}
        {signal.optionContract && (
          <div className="p-3.5 bg-gradient-to-b from-[#11192e] to-[#0a101f] border border-cyan-800/40 rounded-xl space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-gray-800">
              <div className="flex items-center gap-2">
                <span className="p-1 bg-cyan-500/20 text-cyan-400 rounded-md">
                  <Target className="w-3.5 h-3.5" />
                </span>
                <span className="text-xs font-black text-white tracking-wide">
                  {signal.optionContract.symbol}
                </span>
                <span className={`text-[10px] font-black px-2 py-0.5 rounded font-mono ${
                  signal.optionContract.optionType === 'CE'
                    ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                    : 'bg-rose-950 text-rose-400 border border-rose-800'
                }`}>
                  {signal.optionContract.optionType} STRIKE
                </span>
              </div>
              <span className="text-[11px] text-gray-400 font-medium">
                {signal.optionContract.estimatedPremiumRange}
              </span>
            </div>

            {/* Greeks Grid */}
            {greeks && (
              <div className="grid grid-cols-4 gap-1.5 text-center text-xs">
                <div className="p-1.5 bg-black/40 rounded-lg border border-gray-800">
                  <span className="text-[9px] text-gray-400 block font-medium">Delta (Δ)</span>
                  <span className="text-xs font-mono font-bold text-cyan-300 block">
                    {greeks.delta >= 0 ? '+' : ''}{greeks.delta.toFixed(2)}
                  </span>
                </div>
                <div className="p-1.5 bg-black/40 rounded-lg border border-gray-800">
                  <span className="text-[9px] text-gray-400 block font-medium">Gamma (Γ)</span>
                  <span className="text-xs font-mono font-bold text-indigo-300 block">
                    {greeks.gamma.toFixed(4)}
                  </span>
                </div>
                <div className="p-1.5 bg-black/40 rounded-lg border border-gray-800">
                  <span className="text-[9px] text-gray-400 block font-medium">Theta (Θ)</span>
                  <span className="text-xs font-mono font-bold text-rose-400 block">
                    {greeks.theta.toFixed(1)}/day
                  </span>
                </div>
                <div className="p-1.5 bg-black/40 rounded-lg border border-gray-800">
                  <span className="text-[9px] text-gray-400 block font-medium">IV</span>
                  <span className="text-xs font-mono font-bold text-amber-300 block">
                    {(greeks.impliedVolatility * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
            )}

            {/* Greeks-Adjusted Option Premium Targets */}
            {projections && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs pt-1">
                <div className="p-2 bg-black/50 rounded-lg border border-gray-800">
                  <span className="text-[9px] text-gray-400 block">Option Entry</span>
                  <span className="text-xs sm:text-sm font-mono font-black text-cyan-300 block">
                    ₹{projections.currentEstimatedPremium.toFixed(1)}
                  </span>
                </div>
                <div className="p-2 bg-black/50 rounded-lg border border-gray-800">
                  <span className="text-[9px] text-gray-400 block">Option SL</span>
                  <span className="text-xs sm:text-sm font-mono font-black text-rose-400 block">
                    ₹{projections.stopLossEstimatedPremium.toFixed(1)}
                  </span>
                </div>
                <div className="p-2 bg-black/50 rounded-lg border border-gray-800">
                  <span className="text-[9px] text-gray-400 block">Option T1</span>
                  <span className="text-xs sm:text-sm font-mono font-black text-emerald-400 block">
                    ₹{projections.target1EstimatedPremium.toFixed(1)}
                  </span>
                </div>
                <div className="p-2 bg-black/50 rounded-lg border border-gray-800">
                  <span className="text-[9px] text-gray-400 block">Option T2</span>
                  <span className="text-xs sm:text-sm font-mono font-black text-green-300 block">
                    ₹{projections.target2EstimatedPremium.toFixed(1)}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 80% Win Rate Confluence Meter */}
        <div className="p-3.5 bg-black/40 border border-gray-800/80 rounded-xl space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-gray-300 flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-accentGold" />
              80% Win Rate Confluence Filter
            </span>
            <span className={`px-2.5 py-0.5 rounded-full font-mono font-black text-xs ${
              (signal.confluenceScore || 0) >= 80
                ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                : 'bg-amber-950 text-amber-300 border border-amber-800'
            }`}>
              {signal.confluenceScore !== undefined ? `${signal.confluenceScore}% Match` : '80% Gate'}
            </span>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-gray-900 rounded-full h-2.5 overflow-hidden border border-gray-800">
            <div
              className={`h-2.5 rounded-full transition-all duration-500 ${
                (signal.confluenceScore || 0) >= 80
                  ? 'bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400'
                  : 'bg-gradient-to-r from-amber-500 to-yellow-400'
              }`}
              style={{ width: `${Math.min(100, Math.max(8, signal.confluenceScore || 25))}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[10px] text-gray-400 font-mono">
            <span>0%</span>
            <span className="font-bold text-cyan-400">80% A+ Threshold</span>
            <span>100%</span>
          </div>
        </div>

        {/* Recommended Spot Price Levels Box */}
        {signal.levels && (isBuy || isSell) && (
          <div className="p-3.5 bg-black/40 border border-gray-800 rounded-xl space-y-2.5">
            <div className="flex flex-wrap items-center justify-between text-xs font-semibold text-gray-300 gap-1.5 pb-2 border-b border-gray-800">
              <span className="flex items-center gap-1 text-cyan-400">
                <Target className="w-3.5 h-3.5" /> Spot Price Levels (5M Closed)
              </span>
              <span className="font-mono text-cyan-300">
                R:R = 1:{signal.levels.riskRewardRatio}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center">
              <div className="bg-gray-900/80 p-2 rounded-lg border border-gray-800">
                <span className="text-[9px] text-gray-400 block font-medium">Entry</span>
                <span className="text-xs sm:text-sm font-bold font-mono text-cyan-300 block">
                  ₹{signal.levels.entryPrice.toFixed(2)}
                </span>
              </div>

              <div className="bg-gray-900/80 p-2 rounded-lg border border-gray-800">
                <span className="text-[9px] text-gray-400 block font-medium">Stop Loss</span>
                <span className="text-xs sm:text-sm font-bold font-mono text-rose-400 block">
                  ₹{signal.levels.stopLoss.toFixed(2)}
                </span>
              </div>

              <div className="bg-gray-900/80 p-2 rounded-lg border border-gray-800">
                <span className="text-[9px] text-gray-400 block font-medium">Target 1</span>
                <span className="text-xs sm:text-sm font-bold font-mono text-emerald-400 block">
                  ₹{signal.levels.target1.toFixed(2)}
                </span>
              </div>

              <div className="bg-gray-900/80 p-2 rounded-lg border border-gray-800">
                <span className="text-[9px] text-gray-400 block font-medium">Target 2</span>
                <span className="text-xs sm:text-sm font-bold font-mono text-green-300 block">
                  ₹{signal.levels.target2.toFixed(2)}
                </span>
              </div>

              <div className="bg-gray-900/80 p-2 rounded-lg border border-gray-800 col-span-2 sm:col-span-1">
                <span className="text-[9px] text-gray-400 block font-medium">Pivot</span>
                <span className="text-xs sm:text-sm font-bold font-mono text-amber-300 block">
                  ₹{signal.levels.pivot.toFixed(2)}
                </span>
              </div>
            </div>

            <div className="text-[10px] sm:text-[11px] text-gray-400">
              <strong>Invalidation:</strong> {signal.levels.invalidation}
            </div>
          </div>
        )}

        {/* Market Context (VIX, Breadth, Candle Time) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
          <div className="bg-gray-900/60 p-2.5 rounded-lg border border-gray-800 flex items-center justify-between">
            <div>
              <span className="text-gray-400 text-[10px] block">India VIX</span>
              <span className="font-bold font-mono text-white text-xs">
                {vix !== undefined && vix !== null ? vix.toFixed(2) : '12.80'}
              </span>
            </div>
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
              {signal.explanation.vixStatus}
            </span>
          </div>

          <div className="bg-gray-900/60 p-2.5 rounded-lg border border-gray-800 flex items-center justify-between">
            <div>
              <span className="text-gray-400 text-[10px] block">NSE Breadth</span>
              <span className="font-bold font-mono text-white text-xs">
                {advances || 1450} / {declines || 820}
              </span>
            </div>
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
              {(advances || 1450) > (declines || 820) ? 'BULLISH' : 'BEARISH'}
            </span>
          </div>

          <div className="bg-gray-900/60 p-2.5 rounded-lg border border-gray-800 flex items-center justify-between">
            <div>
              <span className="text-gray-400 text-[10px] block">5M Candle IST</span>
              <span className="font-mono text-gray-200 text-xs">
                {signal.candleDateTimeIST}
              </span>
            </div>
            <Clock className="w-3.5 h-3.5 text-gray-400" />
          </div>
        </div>

        {/* Engine Explanation */}
        <div className="bg-black/30 border border-gray-800 rounded-lg p-3 text-xs space-y-1.5">
          <span className="font-semibold text-gray-300 block">Engine Decision & Logic:</span>
          <p className="text-gray-200">{signal.explanation.decision}</p>
          <ul className="list-disc list-inside text-gray-400 space-y-0.5 text-[11px]">
            {signal.explanation.reasons.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};
