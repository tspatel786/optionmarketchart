import React, { useState, useEffect } from 'react';
import { 
  BarChart2, 
  Key, 
  RefreshCw, 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  AlertTriangle, 
  Database,
  ExternalLink,
  ShieldCheck,
  Play
} from 'lucide-react';
import { TradingViewChart } from './TradingViewChart';
import { LiveSignalCard } from './LiveSignalCard';
import { SignalHistoryTable } from './SignalHistoryTable';
import { growwService, type MarketCandle, type LiveQuote } from '../services/growwService';
import { SignalEngine, type EvaluatedSignal } from '../engine/signalEngine';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

export const Dashboard: React.FC = () => {
  const [selectedInstrument, setSelectedInstrument] = useState<'NIFTY 50' | 'BANK NIFTY'>('NIFTY 50');
  const [growwToken, setGrowwToken] = useState<string>('');
  const [isTokenModalOpen, setIsTokenModalOpen] = useState<boolean>(false);
  const [isGrowwConnected, setIsGrowwConnected] = useState<boolean>(growwService.isConfigured());

  // Market Data state
  const [candles, setCandles] = useState<MarketCandle[]>([]);
  const [quote, setQuote] = useState<LiveQuote | null>(null);
  const [vix, setVix] = useState<number>(13.2); // Default stable VIX
  const [advances, setAdvances] = useState<number>(1420);
  const [declines, setDeclines] = useState<number>(850);
  const [currentSignal, setCurrentSignal] = useState<EvaluatedSignal | null>(null);
  const [signalHistory, setSignalHistory] = useState<EvaluatedSignal[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  // Save Groww token
  const handleSaveToken = () => {
    if (growwToken.trim().length > 5) {
      growwService.setAccessToken(growwToken.trim());
      setIsGrowwConnected(true);
      setIsTokenModalOpen(false);
      fetchLiveMarketData();
    }
  };

  // Fetch Live Candles & Evaluate Signal
  const fetchLiveMarketData = async () => {
    setLoading(true);
    setErrorMsg('');

    try {
      if (growwService.isConfigured()) {
        const symbol = selectedInstrument === 'NIFTY 50' ? 'NIFTY' : 'BANKNIFTY';
        
        // Fetch closed 5m candles for today (from 09:15 to current IST)
        const todayStr = new Date().toISOString().split('T')[0];
        const fetchedCandles = await growwService.get5mCandles(
          symbol,
          `${todayStr} 09:15:00`,
          `${todayStr} 15:30:00`
        );
        const liveQuote = await growwService.getLiveQuote(symbol);

        setCandles(fetchedCandles);
        setQuote(liveQuote);

        // Evaluate Signal
        const evalResult = SignalEngine.evaluate(selectedInstrument, {
          candles: fetchedCandles,
          vix,
          advances,
          declines,
          prevDayHigh: liveQuote.high || 23200,
          prevDayLow: liveQuote.low || 22800,
          prevDayClose: liveQuote.close || 23000,
          activeConditions: [],
          forceMarketHoursCheck: false,
        });

        setCurrentSignal(evalResult);
        if (evalResult.signalType === 'BUY' || evalResult.signalType === 'SELL') {
          setSignalHistory(prev => [evalResult, ...prev]);
        }
      } else {
        // If Groww token not configured yet, generate initial baseline candles
        generateBaselineData();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to fetch live market data from Groww API');
    } finally {
      setLoading(false);
    }
  };

  // Generate baseline closed 5m candles if broker token is pending
  const generateBaselineData = () => {
    const basePrice = selectedInstrument === 'NIFTY 50' ? 23000 : 49500;
    const nowSec = Math.floor(Date.now() / 1000);
    const mockCandles: MarketCandle[] = [];

    // Create 12 closed 5m candles (1 hour of closed 5m candles)
    for (let i = 12; i >= 1; i--) {
      const time = nowSec - i * 300;
      const variation = Math.sin(i) * (selectedInstrument === 'NIFTY 50' ? 25 : 60);
      const open = basePrice + variation;
      const close = open + (i % 2 === 0 ? 15 : -12);
      const high = Math.max(open, close) + 8;
      const low = Math.min(open, close) - 10;

      mockCandles.push({
        timestamp: time,
        datetime: new Date(time * 1000).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' }),
        open: Number(open.toFixed(2)),
        high: Number(high.toFixed(2)),
        low: Number(low.toFixed(2)),
        close: Number(close.toFixed(2)),
        volume: 1200 + i * 50,
        isClosed: true,
      });
    }

    setCandles(mockCandles);
    const last = mockCandles[mockCandles.length - 1];

    setQuote({
      symbol: selectedInstrument,
      exchange: 'NSE',
      lastPrice: last.close,
      dayChange: 45.2,
      dayChangePerc: 0.20,
      open: basePrice,
      high: basePrice + 60,
      low: basePrice - 40,
      close: last.close,
      volume: 450000,
      timestamp: last.timestamp,
    });

    const evaluated = SignalEngine.evaluate(selectedInstrument, {
      candles: mockCandles,
      vix,
      advances,
      declines,
      prevDayHigh: basePrice + 120,
      prevDayLow: basePrice - 100,
      prevDayClose: basePrice,
      activeConditions: [],
      forceMarketHoursCheck: false,
    });

    setCurrentSignal(evaluated);
  };

  useEffect(() => {
    fetchLiveMarketData();
  }, [selectedInstrument]);

  return (
    <div className="space-y-6">
      {/* Top Controls & Status Bar */}
      <div className="bg-cardBg border border-borderCol rounded-xl p-4 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Instrument Switcher */}
        <div className="flex items-center gap-2">
          {(['NIFTY 50', 'BANK NIFTY'] as const).map(inst => (
            <button
              key={inst}
              onClick={() => setSelectedInstrument(inst)}
              className={`px-4 py-2 rounded-lg text-sm font-bold tracking-wide transition ${
                selectedInstrument === inst
                  ? 'bg-neutralBlue text-white shadow-md'
                  : 'bg-darkBg text-gray-400 hover:text-white border border-borderCol'
              }`}
            >
              {inst}
            </button>
          ))}

          <span className="text-xs px-2.5 py-1 bg-emerald-950 text-emerald-400 border border-emerald-800 rounded font-mono font-bold">
            5M Interval
          </span>
        </div>

        {/* Live Broker & Database Status */}
        <div className="flex items-center gap-3">
          {/* Groww API Status */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-darkBg border border-borderCol rounded-lg text-xs">
            <span className={`w-2 h-2 rounded-full ${isGrowwConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
            <span className="text-gray-300">
              Groww API: <strong>{isGrowwConnected ? 'Active (Live)' : 'Token Needed'}</strong>
            </span>
            <button
              onClick={() => setIsTokenModalOpen(true)}
              className="ml-2 text-blue-400 hover:text-blue-300 flex items-center gap-1 font-semibold underline"
            >
              <Key className="w-3.5 h-3.5" />
              {isGrowwConnected ? 'Update Token' : 'Enter Token'}
            </button>
          </div>

          {/* Supabase Status */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-darkBg border border-borderCol rounded-lg text-xs">
            <Database className="w-3.5 h-3.5 text-bullGreen" />
            <span className="text-gray-300">
              Supabase: <strong>{isSupabaseConfigured ? 'Connected' : 'Local'}</strong>
            </span>
          </div>

          {/* Refresh Button */}
          <button
            onClick={fetchLiveMarketData}
            disabled={loading}
            className="p-2 bg-darkBg hover:bg-gray-800 border border-borderCol rounded-lg text-gray-300 transition"
            title="Refresh Live 5m Candles"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-neutralBlue' : ''}`} />
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3 bg-red-950/70 border border-red-800 text-red-200 text-xs rounded-xl flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Main Grid: Chart on Left, Live Signal Card on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7">
          <TradingViewChart 
            candles={candles} 
            levels={currentSignal?.levels}
            instrument={selectedInstrument} 
          />
        </div>

        <div className="lg:col-span-5">
          <LiveSignalCard
            signal={currentSignal}
            quote={quote}
            vix={vix}
            advances={advances}
            declines={declines}
          />
        </div>
      </div>

      {/* Signal History Table */}
      <SignalHistoryTable signals={signalHistory} />

      {/* Groww Token Configuration Modal */}
      {isTokenModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-cardBg border border-borderCol rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-2 text-white">
              <Key className="w-5 h-5 text-neutralBlue" />
              <h3 className="text-lg font-bold">Configure Groww Access Token</h3>
            </div>
            
            <p className="text-xs text-gray-400 leading-relaxed">
              Enter your official Bearer Access Token from <a href="https://groww.in/trade-api" target="_blank" rel="noreferrer" className="text-blue-400 underline">Groww Trade API</a> to fetch real-time 5-minute closed candles directly.
            </p>

            <div>
              <label className="text-xs text-gray-300 font-semibold block mb-1">
                Bearer Access Token
              </label>
              <textarea
                value={growwToken}
                onChange={(e) => setGrowwToken(e.target.value)}
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                rows={3}
                className="w-full bg-darkBg border border-borderCol rounded-lg p-2.5 text-xs font-mono text-white focus:outline-none focus:border-neutralBlue"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setIsTokenModalOpen(false)}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-gray-400 hover:text-white transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveToken}
                className="px-5 py-2 bg-neutralBlue hover:bg-blue-600 text-white rounded-lg text-xs font-bold transition shadow-md"
              >
                Save & Connect
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
