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
  PauseCircle,
  Cpu,
  Layers,
  Sparkles,
  Zap,
  Sliders
} from 'lucide-react';
import { TradingViewChart } from './TradingViewChart';
import { LiveSignalCard } from './LiveSignalCard';
import { SignalHistoryTable } from './SignalHistoryTable';
import { growwService, type MarketCandle, type LiveQuote } from '../services/growwService';
import { activeMarketDataProvider } from '../services/marketDataProvider';
import { angelOneClient } from '../services/angelOneApiClient';
import { SignalEngine, type EvaluatedSignal } from '../engine/signalEngine';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

import { TelegramSettingsModal } from './TelegramSettingsModal';
import { TelegramService, type TelegramConfig } from '../services/telegramService';
import { StrategyRegistry, type StrategySignalResult } from '../engine/strategyRegistry';
import { PivotCalculator } from '../engine/pivotCalculator';
import { WorkerStatusBanner } from './WorkerStatusBanner';
import { isStrategyAuthorizedForSignals } from '../engine/multiStrategyBacktester';
import { MarketHoursHelper } from '../engine/marketHours';

export const Dashboard: React.FC = () => {
  const [selectedInstrument, setSelectedInstrument] = useState<'NIFTY 50' | 'BANK NIFTY'>('NIFTY 50');
  const [growwToken, setGrowwToken] = useState<string>('');
  const [isTokenModalOpen, setIsTokenModalOpen] = useState<boolean>(false);
  const [isBrokerConnected, setIsBrokerConnected] = useState<boolean>(activeMarketDataProvider.isReady());

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
  const [selectedStrategyId, setSelectedStrategyId] = useState<number>(33); // Strategy 33 = M Pattern / Double Top
  const [strategySignals, setStrategySignals] = useState<StrategySignalResult[]>([]);

  const handleSaveTelegramConfig = (cfg: TelegramConfig) => {
    setTelegramConfig(cfg);
    localStorage.setItem('TELEGRAM_CONFIG', JSON.stringify(cfg));
  };

  // Save Groww token fallback
  const handleSaveToken = () => {
    if (growwToken.trim().length > 5) {
      growwService.setAccessToken(growwToken.trim());
      setIsBrokerConnected(true);
      setIsTokenModalOpen(false);
      fetchLiveMarketData();
    }
  };

  // Fetch Live Candles & Evaluate Signal
  const fetchLiveMarketData = async () => {
    setLoading(true);
    setErrorMsg('');

    try {
      if (activeMarketDataProvider.isReady()) {
        const symbol = selectedInstrument === 'NIFTY 50' ? 'NIFTY' : 'BANKNIFTY';
        
        // Fetch closed 5m candles for today (from 09:15 to current IST)
        const todayStr = new Date().toISOString().split('T')[0];
        const fetchedCandles = await activeMarketDataProvider.get5mClosedCandles(
          symbol,
          `${todayStr} 09:15:00`,
          `${todayStr} 15:30:00`
        );
        const liveQuote = await activeMarketDataProvider.getQuote(symbol);

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
          prevDayHigh: liveQuote.high || (selectedInstrument === 'NIFTY 50' ? 24650 : 52200),
          prevDayLow: liveQuote.low || (selectedInstrument === 'NIFTY 50' ? 24350 : 51600),
          prevDayClose: liveQuote.close || (selectedInstrument === 'NIFTY 50' ? 24500 : 51900),
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

        // Evaluate 38 Intraday Strategies
        const pivots = PivotCalculator.calculatePivots(
          liveQuote.high || 24650,
          liveQuote.low || 24350,
          liveQuote.close || 24500
        );
        const evaluatedStrategies = StrategyRegistry.evaluateAllStrategies(
          fetchedCandles,
          pivots,
          liveQuote.high || 24650,
          liveQuote.low || 24350
        );
        setStrategySignals(evaluatedStrategies);
      } else {
        // Generate baseline candles
        generateBaselineData();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error fetching live market feed');
      generateBaselineData();
    } finally {
      setLoading(false);
    }
  };

  // Generate baseline closed 5m candles aligned with official NSE session hours (09:15 - 15:30 IST)
  const generateBaselineData = () => {
    const sessionInfo = MarketHoursHelper.getSessionInfo();
    const basePrice = selectedInstrument === 'NIFTY 50' ? 24550 : 51850;
    const mockCandles: MarketCandle[] = [];

    // Create 16 closed 5m candles counting back from the session close (15:30 IST) or current candle
    const endTimestamp = sessionInfo.lastCandleTimestamp;

    for (let i = 15; i >= 0; i--) {
      const time = endTimestamp - i * 300;
      const variation = Math.sin(i * 0.8) * (selectedInstrument === 'NIFTY 50' ? 35 : 85);
      const open = basePrice + variation;
      const close = open + (i % 3 === 0 ? 22 : -18);
      const high = Math.max(open, close) + 12;
      const low = Math.min(open, close) - 14;

      mockCandles.push({
        timestamp: time,
        datetime: new Date(time * 1000).toLocaleTimeString('en-IN', {
          timeZone: 'Asia/Kolkata',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        }),
        open: Number(open.toFixed(2)),
        high: Number(high.toFixed(2)),
        low: Number(low.toFixed(2)),
        close: Number(close.toFixed(2)),
        volume: 1500 + (16 - i) * 80,
        isClosed: true,
      });
    }

    setCandles(mockCandles);
    const last = mockCandles[mockCandles.length - 1];

    setQuote({
      symbol: selectedInstrument,
      exchange: 'NSE',
      segment: 'CASH',
      lastPrice: last.close,
      dayChange: 68.4,
      dayChangePerc: 0.28,
      open: basePrice,
      high: basePrice + 95,
      low: basePrice - 65,
      close: last.close,
      volume: 620000,
      timestamp: last.timestamp,
    });

    const evaluated = SignalEngine.evaluate(selectedInstrument, {
      candles: mockCandles,
      vix,
      advances,
      declines,
      prevDayHigh: basePrice + 140,
      prevDayLow: basePrice - 110,
      prevDayClose: basePrice,
      activeConditions: [],
      forceMarketHoursCheck: false,
    });

    // If market is closed (after 3:30 PM), explicitly set closing session info
    if (!sessionInfo.isOpen) {
      evaluated.candleDateTimeIST = sessionInfo.formattedDateTimeIST;
      evaluated.explanation.decision = `🔴 मार्केट बंद आहे (NSE Closed at 03:30 PM). आजचा 15:30 चा अंतिम क्लोजिंग डेटा दाखवला आहे. पुढील लाईव्ह सत्र उद्या सकाळी 09:15 वाजता सुरू होईल.`;
      evaluated.explanation.reasons = [
        'भारतीय शेअर मार्केट (NSE) दुपारी 03:30 वाजता बंद होते (Trading Hours: 09:15 - 15:30 IST).',
        'सध्या दाखवलेला चार्ट आजच्या 15:30 क्लोजिंग सेशनचा अंतिम डेटा आहे.',
        'पुढील नवीन लाईव्ह सिग्नल्स उद्या सकाळी 09:15 AM वाजता सुरू होतील.',
      ];
    }

    setCurrentSignal(evaluated);

    // Evaluate 38 Strategies
    const pivots = PivotCalculator.calculatePivots(basePrice + 140, basePrice - 110, basePrice);
    const stratEval = StrategyRegistry.evaluateAllStrategies(
      mockCandles,
      pivots,
      basePrice + 140,
      basePrice - 110
    );
    setStrategySignals(stratEval);
  };

  useEffect(() => {
    fetchLiveMarketData();
  }, [selectedInstrument]);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* 24/7 Autonomous Worker Status */}
      <WorkerStatusBanner />

      {/* Top Controls Toolbar */}
      <div className="bg-[#0d1424]/90 border border-gray-800/80 rounded-2xl p-3 sm:p-4 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
        {/* Instrument Switcher (Mobile Friendly Segmented Control) */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full md:w-auto">
          <div className="grid grid-cols-2 gap-1.5 p-1 bg-black/40 border border-gray-800 rounded-xl w-full sm:w-auto">
            {(['NIFTY 50', 'BANK NIFTY'] as const).map(inst => (
              <button
                key={inst}
                onClick={() => setSelectedInstrument(inst)}
                className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-bold tracking-wide transition text-center flex items-center justify-center gap-1.5 ${
                  selectedInstrument === inst
                    ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-md shadow-blue-500/20'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800/40'
                }`}
              >
                <span>{inst}</span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5">
            <span className={`text-[10px] sm:text-xs px-2.5 py-1 rounded-lg font-mono font-bold flex items-center gap-1.5 ${
              MarketHoursHelper.getSessionInfo().isOpen
                ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800'
                : 'bg-rose-950/80 text-rose-300 border border-rose-800'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${MarketHoursHelper.getSessionInfo().isOpen ? 'bg-emerald-400 animate-ping' : 'bg-rose-400'}`} />
              {MarketHoursHelper.getSessionInfo().isOpen ? '5M LIVE SESSION' : '🔴 MARKET CLOSED (3:30 PM Close)'}
            </span>
          </div>
        </div>

        {/* Live Status Indicators */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-between sm:justify-start pt-2 md:pt-0 border-t border-gray-800/60 md:border-0">
          {/* Broker Status Pill */}
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-black/40 border border-gray-800 rounded-lg text-xs">
            <span className={`w-2 h-2 rounded-full ${angelOneClient.isConfigured() ? 'bg-emerald-400 animate-pulse' : 'bg-cyan-400'}`} />
            <span className="text-gray-300 text-[11px]">
              Feed: <strong className="text-emerald-400">{angelOneClient.isConfigured() ? 'Angel One (T134200)' : 'Adaptive Feed'}</strong>
            </span>
          </div>

          {/* Telegram Status */}
          <button
            onClick={() => setIsTelegramModalOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-black/40 hover:bg-gray-800/60 border border-gray-800 rounded-lg text-xs transition"
          >
            <span className={`w-2 h-2 rounded-full ${telegramConfig.botToken ? 'bg-emerald-400' : 'bg-amber-400'}`} />
            <span className="text-gray-300 text-[11px]">
              Telegram: <strong className={telegramConfig.botToken ? 'text-emerald-400' : 'text-amber-300'}>{telegramConfig.botToken ? 'Connected' : 'Setup'}</strong>
            </span>
          </button>

          {/* Supabase Status */}
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-black/40 border border-gray-800 rounded-lg text-xs">
            <Database className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-gray-300 text-[11px]">
              DB: <strong className="text-cyan-300">{isSupabaseConfigured ? 'Sync Live' : 'Local'}</strong>
            </span>
          </div>

          {/* Refresh Button */}
          <button
            onClick={fetchLiveMarketData}
            disabled={loading}
            className="p-2 bg-black/40 hover:bg-gray-800 border border-gray-800 rounded-lg text-gray-300 transition active:scale-95"
            title="Refresh Live 5m Candles"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
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
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
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

      {/* 38 Intraday Strategies Hub */}
      <div className="bg-[#0d1424]/90 border border-gray-800/80 rounded-2xl p-4 sm:p-5 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-gray-800 gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-accentGold/20 border border-accentGold/40 rounded-lg text-accentGold">
                <Target className="w-4 h-4" />
              </span>
              <h3 className="text-sm sm:text-base font-bold text-white">
                38 Intraday Strategies (Chart Patterns & Price Action Hub)
              </h3>
            </div>
            <p className="text-[11px] text-gray-400 mt-0.5">
              Strict 75%+ Win-Rate Gate active. Includes M Pattern, W Pattern, Head & Shoulders, and Retest Bounce Setups.
            </p>
          </div>

          {/* Strategy Select */}
          <div className="w-full sm:w-auto">
            <select
              value={selectedStrategyId}
              onChange={(e) => setSelectedStrategyId(Number(e.target.value))}
              aria-label="Select Trading Strategy"
              className="w-full sm:w-auto bg-black/50 border border-gray-800 rounded-xl px-3 py-2 text-xs text-white font-medium focus:outline-none focus:border-cyan-500"
            >
              {strategySignals.map(s => {
                const isQual = isStrategyAuthorizedForSignals(s.strategyId);
                return (
                  <option key={s.strategyId} value={s.strategyId}>
                    {isQual ? '🟢' : '🔒'} Strategy {s.strategyId}: {s.strategyName} {isQual ? '(Active)' : '(Muted)'}
                  </option>
                );
              })}
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
          const isQualified = isStrategyAuthorizedForSignals(currentStrat.strategyId);

          return (
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-black/40 rounded-xl border border-gray-800">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold text-white">
                      {currentStrat.strategyName}
                    </span>
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-gray-800 text-gray-300 border border-gray-700">
                      {currentStrat.category}
                    </span>
                    {isQualified ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
                        🟢 ACTIVE IN ENGINE
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-950/60 text-rose-400 border border-rose-900/80">
                        🔒 MUTED (&lt; 75% WIN RATE)
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-300 mt-1 font-medium">
                    {currentStrat.ruleTriggered}
                  </p>
                </div>

                <div className="flex items-center gap-2.5 flex-shrink-0">
                  <span className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 ${
                    isCE
                      ? 'bg-emerald-950 text-emerald-400 border border-emerald-700 shadow-md'
                      : isPE
                      ? 'bg-rose-950 text-rose-400 border border-rose-700 shadow-md'
                      : 'bg-amber-950 text-amber-300 border border-amber-700'
                  }`}>
                    {isCE && <TrendingUp className="w-3.5 h-3.5" />}
                    {isPE && <TrendingDown className="w-3.5 h-3.5" />}
                    {isWait && <PauseCircle className="w-3.5 h-3.5" />}
                    {currentStrat.action === 'BUY_CE' ? 'BUY CE (CALL)' : currentStrat.action === 'BUY_PE' ? 'BUY PE (PUT)' : 'WAIT (NO TRADE)'}
                  </span>

                  <span className="text-xs font-mono font-bold px-2.5 py-1 bg-gray-800 border border-gray-700 rounded-lg text-accentGold">
                    {currentStrat.confidence}% Match
                  </span>
                </div>
              </div>

              {/* R:R Targets Grid */}
              {currentStrat.levels && (isCE || isPE) && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                  <div className="p-2.5 bg-black/40 rounded-xl border border-gray-800">
                    <span className="text-[10px] text-gray-400 block font-medium">Entry</span>
                    <span className="text-xs sm:text-sm font-bold font-mono text-cyan-300 mt-0.5 block">
                      ₹{currentStrat.levels.entryPrice.toFixed(2)}
                    </span>
                  </div>

                  <div className="p-2.5 bg-black/40 rounded-xl border border-gray-800">
                    <span className="text-[10px] text-gray-400 block font-medium">Stop Loss</span>
                    <span className="text-xs sm:text-sm font-bold font-mono text-rose-400 mt-0.5 block">
                      ₹{currentStrat.levels.stopLoss.toFixed(2)}
                    </span>
                  </div>

                  <div className="p-2.5 bg-black/40 rounded-xl border border-gray-800">
                    <span className="text-[10px] text-gray-400 block font-medium">Target 1 (1.5R)</span>
                    <span className="text-xs sm:text-sm font-bold font-mono text-emerald-400 mt-0.5 block">
                      ₹{currentStrat.target1_5R ? currentStrat.target1_5R.toFixed(2) : currentStrat.levels.target1.toFixed(2)}
                    </span>
                  </div>

                  <div className="p-2.5 bg-black/40 rounded-xl border border-gray-800">
                    <span className="text-[10px] text-gray-400 block font-medium">Target 2 (2.0R)</span>
                    <span className="text-xs sm:text-sm font-bold font-mono text-green-300 mt-0.5 block">
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
