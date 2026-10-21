import React from 'react';
import { Zap, Flame, Target, ShieldAlert, Clock, AlertTriangle, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { HeroZeroRadarEngine, type HeroZeroRadarResult } from '../engine/heroZeroRadar';

interface HeroZeroRadarCardProps {
  instrument: string;
  spotPrice: number;
}

export const HeroZeroRadarCard: React.FC<HeroZeroRadarCardProps> = ({
  instrument,
  spotPrice,
}) => {
  const radar: HeroZeroRadarResult = HeroZeroRadarEngine.evaluateRadar(instrument, spotPrice);

  return (
    <div className="bg-[#0d1424]/90 border border-gray-800/80 rounded-2xl p-4 sm:p-5 shadow-xl space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <span className="p-1.5 bg-amber-500/20 text-accentGold rounded-lg">
            <Zap className="w-4 h-4" />
          </span>
          <div>
            <h3 className="text-sm sm:text-base font-black text-white flex items-center gap-2">
              Expiry Day "Hero or Zero" Setup Radar
            </h3>
            <p className="text-[10px] sm:text-[11px] text-gray-400">
              कमी प्रीमियम (₹१५-₹३०) • ३x ते ५x गॅमा मोमेंटम ब्रेकआउट स्कॅनर
            </p>
          </div>
        </div>

        {/* Expiry Badge */}
        <div className="flex items-center gap-2">
          <span className={`px-2.5 py-1 rounded-full text-xs font-black uppercase border tracking-wider flex items-center gap-1.5 shadow-md ${
            radar.isExpiryDay
              ? 'bg-amber-950 text-amber-300 border-amber-600 animate-pulse'
              : 'bg-gray-800 text-gray-300 border-gray-700'
          }`}>
            <Flame className="w-3.5 h-3.5 text-accentGold" />
            {radar.todayDayName}: {radar.expiryInstrument} Expiry
          </span>
        </div>
      </div>

      {/* Power Hour Info Banner */}
      <div className={`p-3 rounded-xl border flex items-center justify-between text-xs ${
        radar.isPowerHourActive
          ? 'bg-amber-950/40 border-amber-700 text-amber-200'
          : 'bg-black/40 border-gray-800 text-gray-300'
      }`}>
        <div className="flex items-center gap-2">
          <Clock className={`w-4 h-4 ${radar.isPowerHourActive ? 'text-accentGold animate-spin' : 'text-cyan-400'}`} />
          <span className="font-medium">{radar.powerHourMessage}</span>
        </div>
        <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-black/60 border border-gray-800 text-gray-400">
          Power Hour: 1:15 - 3:15 PM
        </span>
      </div>

      {/* Hero-Zero Candidate Setups (CE & PE) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {radar.setups.map((setup, idx) => {
          const isCE = setup.optionType === 'CE';
          return (
            <div
              key={idx}
              className={`p-3.5 rounded-xl border space-y-3 transition ${
                isCE
                  ? 'bg-emerald-950/20 border-emerald-800/60 hover:border-emerald-600/80'
                  : 'bg-rose-950/20 border-rose-800/60 hover:border-rose-600/80'
              }`}
            >
              {/* Setup Title & Direction */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className={`p-1 rounded-md text-xs font-bold ${
                    isCE ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                  }`}>
                    {isCE ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                  </span>
                  <span className="font-black text-white text-xs sm:text-sm">
                    {setup.contractName}
                  </span>
                </div>

                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-black/60 border border-gray-800 text-accentGold">
                  R:R {setup.riskReward}
                </span>
              </div>

              {/* Price Targets Grid */}
              <div className="grid grid-cols-4 gap-1 text-center font-mono">
                <div className="p-1.5 bg-black/40 rounded-lg border border-gray-800">
                  <span className="text-[9px] text-gray-400 block">Entry Zone</span>
                  <span className="text-xs font-bold text-cyan-300">₹{setup.currentPremium}</span>
                </div>
                <div className="p-1.5 bg-black/40 rounded-lg border border-gray-800">
                  <span className="text-[9px] text-gray-400 block">Stop Loss</span>
                  <span className="text-xs font-bold text-rose-400">₹{setup.stopLoss}</span>
                </div>
                <div className="p-1.5 bg-black/40 rounded-lg border border-gray-800">
                  <span className="text-[9px] text-gray-400 block">Target 1 (2x)</span>
                  <span className="text-xs font-bold text-emerald-400">₹{setup.target1}</span>
                </div>
                <div className="p-1.5 bg-black/40 rounded-lg border border-gray-800">
                  <span className="text-[9px] text-gray-400 block">Target 2 (4x)</span>
                  <span className="text-xs font-bold text-green-300">₹{setup.target2}</span>
                </div>
              </div>

              {/* Risk vs Reward ₹ Breakdown */}
              <div className="flex items-center justify-between text-[11px] pt-1 border-t border-gray-800/80">
                <span className="text-rose-400">
                  कमाल रिस्क/लॉट: <strong>₹{setup.maxRiskPerLot}</strong>
                </span>
                <span className="text-emerald-400">
                  संभाव्य नफा/लॉट: <strong>₹{setup.potentialProfitPerLot}</strong>
                </span>
              </div>

              {/* Trigger Condition */}
              <div className="text-[10px] text-gray-400 italic bg-black/30 p-2 rounded-lg border border-gray-800/50">
                🎯 <strong>Trigger Rule:</strong> {setup.triggerCondition}
              </div>
            </div>
          );
        })}
      </div>

      {/* Golden Precautions */}
      <div className="p-3 bg-amber-950/20 border border-amber-900/50 rounded-xl space-y-1.5 text-xs text-amber-200/90">
        <div className="font-bold flex items-center gap-1.5 text-accentGold">
          <AlertTriangle className="w-3.5 h-3.5" />
          हिरो-झिरो ट्रेडसाठी अत्यंत महत्त्वाचे नियम:
        </div>
        <ul className="list-disc list-inside space-y-0.5 text-[11px] text-gray-300">
          {radar.rulesAndPrecautions.map((rule, idx) => (
            <li key={idx}>{rule}</li>
          ))}
        </ul>
      </div>
    </div>
  );
};
