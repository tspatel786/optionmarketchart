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
  Play,
  Target,
  PauseCircle
} from 'lucide-react';
import { TradingViewChart } from './TradingViewChart';
import { LiveSignalCard } from './LiveSignalCard';
import { SignalHistoryTable } from './SignalHistoryTable';
import { growwService, type MarketCandle, type LiveQuote } from '../services/growwService';
import { SignalEngine, type EvaluatedSignal } from '../engine/signalEngine';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

import { TelegramSettingsModal } from './TelegramSettingsModal';
import { TelegramService, type TelegramConfig } from '../services/telegramService';
import { StrategyRegistry, type StrategySignalResult } from '../engine/strategyRegistry';
import { PivotCalculator } from '../engine/pivotCalculator';

export const Dashboard: React.FC = () => {
  const [selectedInstrument, setSelectedInstrument] = useState<'NIFTY 50' | 'BANK NIFTY'>('NIFTY 50');
  const [growwToken, setGrowwToken] = useState<string>('');
  const [isTokenModalOpen, setIsTokenModalOpen] = useState<boolean>(false);
  const [isGrowwConnected, setIsGrowwConnected] = useState<boolean>(growwService.isConfigured());

  // Telegram Configuration State
  const [isTelegramModalOpen, setIsTelegramModalOpen] = useState<boolean>(false);
  const [telegramConfig, setTelegramConfig] = useState<TelegramConfig>(() => {
    const saved = localStorage.getItem('TELEGRAM_CONFIG');
    return saved
      ? JSON.parse(saved)
      : {
          botToken: '8932116600:AAE3X71nap5n6aDu-sttvmVZMh_2_F68ax0',
          chatId: '1760361828',
        };
  });

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

  // Strategies state
  const [selectedStrategyId, setSelectedStrategyId] = useState<number>(20);
  const [strategySignals, setStrategySignals] = useState<StrategySignalResult[]>([]);

  const handleSaveTelegramConfig = (cfg: TelegramConfig) => {
    setTelegramConfig(cfg);
    localStorage.setItem('TELEGRAM_CONFIG', JSON.stringify(cfg));
  };

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

        // Calculate today's signals count and last signal for cooldown
        const instrumentSignals = signalHistory.filter(
          s => s.instrument === selectedInstrument && (s.signalType === 'BUY' || s.signalType === 'SELL')
        );
        const lastSignalRecord = instrumentSignals[0];

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
          cooldownMinutes: 15,
          dailySignalCap: 3,
          todaySignalsCount: instrumentSignals.length,
          lastSignal: lastSignalRecord
            ? {
                direction: lastSignalRecord.signalType,
                timestamp: lastSignalRecord.candleTimestamp,
              }
            : undefined,
        });

        setCurrentSignal(evalResult);
        if (evalResult.signalType === 'BUY' || evalResult.signalType === 'SELL') {
          setSignalHistory(prev => [evalResult, ...prev]);
          // Deliver to Telegram Outbox queue
          TelegramService.queueNotification(evalResult, telegramConfig);
        }

        // Evaluate 20 Intraday Strategies
        const pivots = PivotCalculator.calculatePivots(
          liveQuote.high || 23200,
          liveQuote.low || 22800,
          liveQuote.close || 23000
        );
        const evaluatedStrategies = StrategyRegistry.evaluateAllStrategies(
          fetchedCandles,
          pivots,
          liveQuote.high || 23200,
          liveQuote.low || 22800
        );
        setStrategySignals(evaluatedStrategies);
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

    // Evaluate 20 Strategies for baseline
    const pivots = PivotCalculator.calculatePivots(basePrice + 120, basePrice - 100, basePrice);
    const stratEval = StrategyRegistry.evaluateAllStrategies(
      mockCandles,
      pivots,
      basePrice + 120,
      basePrice - 100
    );
    setStrategySignals(stratEval);
  };

  useEffect(() => {
    fetchLiveMarketData();
  }, [selectedInstrument]);

  return (
    <div className="space-y-6">
      {/* Top Controls & Status Bar */}
      <div className="bg-cardBg border border-borderCol rounded-xl p-3 sm:p-4 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
        {/* Instrument Switcher */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full md:w-auto">
          <div className="grid grid-cols-2 gap-2 w-full sm:w-auto">
            {(['NIFTY 50', 'BANK NIFTY'] as const).map(inst => (
              <button
                key={inst}
                onClick={() => setSelectedInstrument(inst)}
                className={`px-3 py-2 rounded-lg text-xs sm:text-sm font-bold tracking-wide transition text-center ${
                  selectedInstrument === inst
                    ? 'bg-neutralBlue text-white shadow-md'
                    : 'bg-darkBg text-gray-400 hover:text-white border border-borderCol'
                }`}
              >
                {inst}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] sm:text-xs px-2 py-0.5 bg-emerald-950 text-emerald-400 border border-emerald-800 rounded font-mono font-bold">
              5M Interval
            </span>

            {isGrowwConnected ? (
              <span className="text-[10px] sm:text-[11px] px-2 py-0.5 bg-emerald-950 text-emerald-300 border border-emerald-800 rounded font-bold flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                LIVE (GROWW API)
              </span>
            ) : (
              <span className="text-[10px] sm:text-[11px] px-2 py-0.5 bg-amber-950 text-amber-300 border border-amber-800 rounded font-bold flex items-center gap-1.5" title="Broker token pending. Showing simulation data.">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                SIMULATION / MOCK
              </span>
            )}
          </div>
        </div>

        {/* Live Broker, Telegram & Database Status */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-between sm:justify-start pt-2 md:pt-0 border-t border-borderCol/40 md:border-0">
          {/* Telegram Status */}
          <button
            onClick={() => setIsTelegramModalOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-darkBg hover:bg-gray-800 border border-borderCol rounded-lg text-[11px] transition"
          >
            <span className={`w-2 h-2 rounded-full ${telegramConfig.botToken ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            <span className="text-gray-300">
              Telegram: <strong className={telegramConfig.botToken ? 'text-emerald-400' : 'text-amber-300'}>{telegramConfig.botToken ? 'Active' : 'Configure'}</strong>
            </span>
          </button>

          {/* Groww API Status */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-darkBg border border-borderCol rounded-lg text-xs">
            <span className={`w-2 h-2 rounded-full ${isGrowwConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
            <span className="text-gray-300">
              Groww API: <strong>{isGrowwConnected ? 'Live' : 'Token Needed'}</strong>
            </span>
            <button
              onClick={() => setIsTokenModalOpen(true)}
              className="ml-1 text-blue-400 hover:text-blue-300 font-semibold underline"
            >
              {isGrowwConnected ? 'Update' : 'Enter'}
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

      {/* 20 Intraday Strategies Hub (CE / PE Options) */}
      <div className="bg-cardBg border border-borderCol rounded-xl p-4 sm:p-5 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-borderCol gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-accentGold/20 border border-accentGold/40 rounded-lg text-accentGold">
                <Target className="w-4 h-4" />
              </span>
              <h3 className="text-sm sm:text-base font-bold text-white">
                20 Intraday Strategies (CE / PE Setup Hub)
              </h3>
            </div>
            <p className="text-[11px] text-gray-400 mt-0.5">
              Strict 80% Win Rate filters for {selectedInstrument}. Select any strategy or use Master Combination Score.
            </p>
          </div>

          {/* Strategy Dropdown / Quick Select */}
          <div className="w-full sm:w-auto">
            <select
              value={selectedStrategyId}
              onChange={(e) => setSelectedStrategyId(Number(e.target.value))}
              aria-label="Select Trading Strategy"
              className="w-full sm:w-auto bg-darkBg border border-borderCol rounded-lg px-3 py-1.5 text-xs text-white font-medium focus:outline-none focus:border-neutralBlue"
            >
              <option value={20}>⭐ Strategy 20: Master Combination Score (80%+ A+ Filter)</option>
              <option value={1}>Strategy 1: Opening Range Breakout (15m ORB)</option>
              <option value={2}>Strategy 2: EMA Trend Pullback (20 / 50)</option>
              <option value={4}>Strategy 4: Supertrend + VWAP Confluence</option>
              <option value={5}>Strategy 5: RSI Momentum + Structure (60/40)</option>
              <option value={7}>Strategy 7: Bollinger Band Squeeze Breakout</option>
              <option value={9}>Strategy 9: Previous Day High / Low (PDH/PDL) Breakout</option>
              <option value={12}>Strategy 12: Pivot Point R1/S1 Breakout & Retest</option>
              <option value={15}>Strategy 15: NR7 (Narrow Range 7) Breakout</option>
            </select>
          </div>
        </div>

        {/* Selected Strategy Display Card */}
        {(() => {
          const currentStrat = strategySignals.find(s => s.strategyId === selectedStrategyId) || strategySignals[0];
          if (!currentStrat) return null;

          const isCE = currentStrat.action === 'BUY_CE';
          const isPE = currentStrat.action === 'BUY_PE';
          const isWait = currentStrat.action === 'WAIT';

          return (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-darkBg/80 rounded-xl border border-borderCol">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white">
                      {currentStrat.strategyName}
                    </span>
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-gray-800 text-gray-300 border border-gray-700">
                      {currentStrat.category}
                    </span>
                  </div>
                  <p className="text-xs text-gray-300 mt-1 font-medium">
                    {currentStrat.ruleTriggered}
                  </p>
                </div>

                <div className="flex items-center gap-2.5 flex-shrink-0">
                  <span className={`px-3.5 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider flex items-center gap-1.5 ${
                    isCE
                      ? 'bg-emerald-950 text-emerald-400 border border-emerald-700 shadow-md'
                      : isPE
                      ? 'bg-red-950 text-red-400 border border-red-700 shadow-md'
                      : 'bg-amber-950 text-amber-300 border border-amber-700'
                  }`}>
                    {isCE && <TrendingUp className="w-4 h-4" />}
                    {isPE && <TrendingDown className="w-4 h-4" />}
                    {isWait && <PauseCircle className="w-4 h-4" />}
                    {currentStrat.action === 'BUY_CE' ? 'BUY CE (CALL)' : currentStrat.action === 'BUY_PE' ? 'BUY PE (PUT)' : 'WAIT (NO TRADE)'}
                  </span>

                  <span className="text-xs font-mono font-bold px-2.5 py-1 bg-gray-800 border border-gray-700 rounded-lg text-accentGold">
                    {currentStrat.confidence}% Match
                  </span>
                </div>
              </div>

              {/* R:R Targets Grid (1.5R & 2.0R) */}
              {currentStrat.levels && (isCE || isPE) && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                  <div className="p-2.5 bg-darkBg rounded-lg border border-borderCol">
                    <span className="text-[10px] text-gray-400 block font-medium">Entry</span>
                    <span className="text-sm font-bold font-mono text-blue-400 mt-0.5 block">
                      ₹{currentStrat.levels.entryPrice.toFixed(2)}
                    </span>
                  </div>

                  <div className="p-2.5 bg-darkBg rounded-lg border border-borderCol">
                    <span className="text-[10px] text-gray-400 block font-medium">Stop Loss</span>
                    <span className="text-sm font-bold font-mono text-bearRed mt-0.5 block">
                      ₹{currentStrat.levels.stopLoss.toFixed(2)}
                    </span>
                  </div>

                  <div className="p-2.5 bg-darkBg rounded-lg border border-borderCol">
                    <span className="text-[10px] text-gray-400 block font-medium">Target 1 (1.5R)</span>
                    <span className="text-sm font-bold font-mono text-bullGreen mt-0.5 block">
                      ₹{currentStrat.target1_5R ? currentStrat.target1_5R.toFixed(2) : currentStrat.levels.target1.toFixed(2)}
                    </span>
                  </div>

                  <div className="p-2.5 bg-darkBg rounded-lg border border-borderCol">
                    <span className="text-[10px] text-gray-400 block font-medium">Target 2 (2.0R)</span>
                    <span className="text-sm font-bold font-mono text-emerald-300 mt-0.5 block">
                      ₹{currentStrat.target2R ? currentStrat.target2R.toFixed(2) : currentStrat.levels.target2.toFixed(2)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })()}
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

      {/* Telegram Configuration Modal */}
      <TelegramSettingsModal
        isOpen={isTelegramModalOpen}
        onClose={() => setIsTelegramModalOpen(false)}
        config={telegramConfig}
        onSaveConfig={handleSaveTelegramConfig}
      />
    </div>
  );
};
