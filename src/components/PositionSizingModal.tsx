import React, { useState } from 'react';
import { Calculator, X, Shield, DollarSign, Target, AlertCircle, CheckCircle2 } from 'lucide-react';
import { RiskCalculator, type PositionSizingInput } from '../engine/riskCalculator';

interface PositionSizingModalProps {
  isOpen: boolean;
  onClose: () => void;
  instrument: 'NIFTY 50' | 'BANK NIFTY' | 'FINNIFTY' | 'SENSEX';
  defaultEntryPrice?: number;
  defaultStopLossPrice?: number;
}

export const PositionSizingModal: React.FC<PositionSizingModalProps> = ({
  isOpen,
  onClose,
  instrument,
  defaultEntryPrice = 120,
  defaultStopLossPrice = 90,
}) => {
  const [capital, setCapital] = useState<number>(50000);
  const [riskPercent, setRiskPercent] = useState<number>(2.0);
  const [entryPrice, setEntryPrice] = useState<number>(defaultEntryPrice);
  const [stopLossPrice, setStopLossPrice] = useState<number>(defaultStopLossPrice);

  if (!isOpen) return null;

  const result = RiskCalculator.calculate({
    capital,
    riskPercentage: riskPercent,
    instrument,
    optionEntryPrice: entryPrice,
    optionStopLossPrice: stopLossPrice,
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 select-none">
      <div className="bg-[#0d1424] border border-gray-800 rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl space-y-4 relative">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-gradient-to-tr from-cyan-600 to-blue-500 rounded-xl text-white">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-white">
                लॉट साईज व रिस्क कॅल्क्युलेटर ({instrument})
              </h3>
              <p className="text-[11px] text-gray-400">
                भांडवल आणि रिस्क मॅनेजमेंटनुसार अचूक लॉट्स
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Capital Presets */}
        <div className="space-y-1.5">
          <label className="text-xs text-gray-300 font-bold block">
            तुमचे एकूण भांडवल (Total Trading Capital):
          </label>
          <div className="grid grid-cols-4 gap-1.5">
            {[25000, 50000, 100000, 200000].map((amt) => (
              <button
                key={amt}
                type="button"
                onClick={() => setCapital(amt)}
                className={`py-1.5 px-2 rounded-xl text-xs font-mono font-bold transition border ${
                  capital === amt
                    ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white border-cyan-400 shadow-md'
                    : 'bg-black/40 border-gray-800 text-gray-400 hover:text-white'
                }`}
              >
                ₹{(amt / 1000).toFixed(0)}K
              </button>
            ))}
          </div>
          <div className="relative pt-1">
            <span className="absolute left-3 top-3 text-gray-400 font-mono text-sm">₹</span>
            <input
              type="number"
              value={capital}
              onChange={(e) => setCapital(Math.max(1000, Number(e.target.value)))}
              className="w-full bg-black/40 border border-gray-800 rounded-xl py-2 pl-7 pr-3 text-sm font-mono text-white focus:outline-none focus:border-cyan-500"
            />
          </div>
        </div>

        {/* Risk % per trade */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-300 font-bold">प्रत्येक ट्रेडची जास्तीत जास्त रिस्क (%):</span>
            <span className="font-mono text-rose-400 font-bold">
              {riskPercent}% (₹{((capital * riskPercent) / 100).toFixed(0)} Max Loss)
            </span>
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {[1.0, 1.5, 2.0, 3.0].map((pct) => (
              <button
                key={pct}
                type="button"
                onClick={() => setRiskPercent(pct)}
                className={`py-1.5 rounded-xl text-xs font-mono font-bold transition border ${
                  riskPercent === pct
                    ? 'bg-rose-950 text-rose-300 border-rose-600 shadow-md'
                    : 'bg-black/40 border-gray-800 text-gray-400 hover:text-white'
                }`}
              >
                {pct}%
              </button>
            ))}
          </div>
        </div>

        {/* Entry & Stop Loss inputs */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="space-y-1">
            <label className="text-gray-300 block font-medium">Option Entry Premium (₹)</label>
            <input
              type="number"
              value={entryPrice}
              onChange={(e) => setEntryPrice(Math.max(1, Number(e.target.value)))}
              className="w-full bg-black/40 border border-gray-800 rounded-xl p-2 font-mono text-cyan-300 focus:outline-none focus:border-cyan-500"
            />
          </div>
          <div className="space-y-1">
            <label className="text-gray-300 block font-medium">Option Stop Loss (₹)</label>
            <input
              type="number"
              value={stopLossPrice}
              onChange={(e) => setStopLossPrice(Math.max(0, Number(e.target.value)))}
              className="w-full bg-black/40 border border-gray-800 rounded-xl p-2 font-mono text-rose-400 focus:outline-none focus:border-rose-500"
            />
          </div>
        </div>

        {/* Results Card */}
        <div className="p-4 bg-gradient-to-b from-[#11192e] to-[#0a101f] border border-cyan-800/60 rounded-2xl space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-gray-800 text-xs">
            <span className="font-bold text-gray-300 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              शिफारस केलेले लॉट्स (Recommended Size):
            </span>
            <span className="px-3 py-1 bg-gradient-to-r from-blue-600 to-cyan-500 text-white rounded-lg font-black text-sm shadow-md font-mono">
              {result.recommendedLots} LOTS ({result.totalQuantity} QTY)
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
            <div className="p-2 bg-black/40 rounded-xl border border-gray-800">
              <span className="text-[10px] text-gray-400 block">एकूण भांडवल लागेल</span>
              <span className="text-xs sm:text-sm font-mono font-bold text-cyan-300 block mt-0.5">
                ₹{result.totalCapitalRequired.toLocaleString('en-IN')}
              </span>
            </div>

            <div className="p-2 bg-black/40 rounded-xl border border-gray-800">
              <span className="text-[10px] text-gray-400 block">SL लागल्यास तोटा</span>
              <span className="text-xs sm:text-sm font-mono font-bold text-rose-400 block mt-0.5">
                -₹{result.totalActualRiskAmount.toLocaleString('en-IN')}
              </span>
            </div>

            <div className="p-2 bg-black/40 rounded-xl border border-gray-800">
              <span className="text-[10px] text-gray-400 block">Target 1 नफा</span>
              <span className="text-xs sm:text-sm font-mono font-bold text-emerald-400 block mt-0.5">
                +₹{result.target1RewardAmount.toLocaleString('en-IN')}
              </span>
            </div>

            <div className="p-2 bg-black/40 rounded-xl border border-gray-800">
              <span className="text-[10px] text-gray-400 block">Target 2 नफा</span>
              <span className="text-xs sm:text-sm font-mono font-bold text-green-300 block mt-0.5">
                +₹{result.target2RewardAmount.toLocaleString('en-IN')}
              </span>
            </div>
          </div>

          <p className="text-[11px] text-gray-300 text-left">
            {result.advice}
          </p>
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-1">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-gradient-to-r from-blue-600 to-cyan-500 text-white rounded-xl text-xs font-bold shadow-md hover:from-blue-500 hover:to-cyan-400 transition"
          >
            लागू करा (Apply)
          </button>
        </div>
      </div>
    </div>
  );
};
