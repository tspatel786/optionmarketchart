import React from 'react';
import { Landmark, TrendingUp, TrendingDown, Layers, PieChart, ShieldCheck } from 'lucide-react';
import { FiiDiiEngine, type FiiDiiData } from '../engine/fiiDiiEngine';

export const FiiDiiCard: React.FC = () => {
  const data: FiiDiiData = FiiDiiEngine.getDailyFlow();

  const isFiiPositive = data.fiiCashNet >= 0;
  const isDiiPositive = data.diiCashNet >= 0;
  const isTotalPositive = data.totalNetInstitutional >= 0;

  return (
    <div className="bg-[#0d1424]/90 border border-gray-800/80 rounded-2xl p-4 sm:p-5 shadow-xl space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <span className="p-1.5 bg-indigo-500/20 text-indigo-400 rounded-lg">
            <Landmark className="w-4 h-4" />
          </span>
          <div>
            <h3 className="text-sm sm:text-base font-black text-white flex items-center gap-2">
              FII / DII Institutional Flow & Long-Short Radar
            </h3>
            <p className="text-[10px] sm:text-[11px] text-gray-400">
              मोठ्या संस्थांची (FII & DII) कॅश मार्केट खरेदी-विक्री आणि इंडेक्स फ्युचर्स पोझिशन्स
            </p>
          </div>
        </div>

        {/* Sentiment Badge */}
        <div className="flex items-center gap-2">
          <span className={`px-2.5 py-1 rounded-full text-xs font-black uppercase border tracking-wider flex items-center gap-1.5 shadow-md ${
            data.bias === 'VERY_BULLISH' || data.bias === 'BULLISH'
              ? 'bg-emerald-950 text-emerald-300 border-emerald-700'
              : data.bias === 'VERY_BEARISH' || data.bias === 'BEARISH'
              ? 'bg-rose-950 text-rose-300 border-rose-700'
              : 'bg-amber-950 text-amber-300 border-amber-700'
          }`}>
            {isTotalPositive ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
            {data.biasLabel}
          </span>
        </div>
      </div>

      {/* Cash Market Flow Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-center text-xs">
        {/* FII Cash Net */}
        <div className="p-3 bg-black/40 rounded-xl border border-gray-800">
          <span className="text-[10px] text-gray-400 block font-medium">FII Net Cash (विदेशी संस्था)</span>
          <span className={`text-base sm:text-lg font-black font-mono mt-0.5 block ${
            isFiiPositive ? 'text-emerald-400' : 'text-rose-400'
          }`}>
            {isFiiPositive ? '+' : ''}₹{data.fiiCashNet.toLocaleString('en-IN')} Cr
          </span>
          <span className="text-[10px] text-gray-500 mt-0.5 block">
            खरेदी: ₹{data.fiiCashBuy.toFixed(0)} | विक्री: ₹{data.fiiCashSell.toFixed(0)}
          </span>
        </div>

        {/* DII Cash Net */}
        <div className="p-3 bg-black/40 rounded-xl border border-gray-800">
          <span className="text-[10px] text-gray-400 block font-medium">DII Net Cash (भारतीय संस्था)</span>
          <span className={`text-base sm:text-lg font-black font-mono mt-0.5 block ${
            isDiiPositive ? 'text-emerald-400' : 'text-rose-400'
          }`}>
            {isDiiPositive ? '+' : ''}₹{data.diiCashNet.toLocaleString('en-IN')} Cr
          </span>
          <span className="text-[10px] text-gray-500 mt-0.5 block">
            खरेदी: ₹{data.diiCashBuy.toFixed(0)} | विक्री: ₹{data.diiCashSell.toFixed(0)}
          </span>
        </div>

        {/* Total Institutional Flow */}
        <div className="p-3 bg-black/40 rounded-xl border border-gray-800">
          <span className="text-[10px] text-gray-400 block font-medium">Total Institutional Net Flow</span>
          <span className={`text-base sm:text-lg font-black font-mono mt-0.5 block ${
            isTotalPositive ? 'text-cyan-300' : 'text-amber-300'
          }`}>
            {isTotalPositive ? '+' : ''}₹{data.totalNetInstitutional.toLocaleString('en-IN')} Cr
          </span>
          <span className="text-[10px] text-emerald-400/80 mt-0.5 block font-bold">
            {isTotalPositive ? 'निव्वळ खरेदी (Inflow)' : 'निव्वळ विक्री (Outflow)'}
          </span>
        </div>
      </div>

      {/* FII Index Futures Long vs Short Ratio Bar */}
      <div className="p-3 bg-black/40 border border-gray-800 rounded-xl space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-gray-300 flex items-center gap-1.5">
            <PieChart className="w-3.5 h-3.5 text-cyan-400" />
            FII Index Futures Exposure:
          </span>
          <span className="font-mono text-cyan-300 text-[11px]">
            Long/Short Ratio: <strong>{data.fiiLongShortRatio}</strong> ({data.fiiLongPercentage}% Long)
          </span>
        </div>

        {/* Visual Progress Bar */}
        <div className="h-3 w-full bg-rose-900/60 rounded-full overflow-hidden flex shadow-inner">
          <div
            className="h-full bg-gradient-to-r from-emerald-500 to-cyan-400 transition-all duration-500"
            style={{ width: `${data.fiiLongPercentage}%` }}
            title={`Long: ${data.fiiLongPercentage}%`}
          />
        </div>

        <div className="flex items-center justify-between text-[10px] text-gray-400 font-mono">
          <span className="text-emerald-400 font-bold">
            🟢 Long: {data.fiiFuturesLongContracts.toLocaleString('en-IN')} ({data.fiiLongPercentage}%)
          </span>
          <span className="text-rose-400 font-bold">
            🔴 Short: {data.fiiFuturesShortContracts.toLocaleString('en-IN')} ({(100 - data.fiiLongPercentage).toFixed(1)}%)
          </span>
        </div>
      </div>

      {/* Marathi Interpretation Footer */}
      <div className="p-3 bg-indigo-950/30 border border-indigo-900/60 rounded-xl text-xs text-indigo-200/90 leading-relaxed">
        <strong>💡 संस्थात्मक कल (Insight):</strong> {data.marathiInsight}
      </div>
    </div>
  );
};
