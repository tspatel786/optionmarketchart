import React, { useState } from 'react';
import { 
  TrendingUp, 
  Shield, 
  Activity, 
  Sliders, 
  Bell, 
  Database, 
  AlertCircle,
  HelpCircle,
  BarChart3
} from 'lucide-react';
import { RuleManagement } from './components/RuleManagement';
import { Dashboard } from './components/Dashboard';
import { BacktestView } from './components/BacktestView';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'rules' | 'backtest'>('dashboard');
  const [backtestInstrument, setBacktestInstrument] = useState<'NIFTY 50' | 'BANK NIFTY'>('NIFTY 50');

  return (
    <div className="min-h-screen bg-darkBg text-gray-100 flex flex-col font-sans">
      {/* Top Header */}
      <header className="border-b border-borderCol bg-cardBg/90 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-2.5 sm:py-0 sm:h-16 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-neutralBlue/20 border border-neutralBlue/40 rounded-xl text-neutralBlue flex-shrink-0">
              <Activity className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <h1 className="text-base sm:text-lg font-bold tracking-tight text-white truncate">
                  Market Signal Engine
                </h1>
                <span className="text-[9px] font-mono uppercase bg-emerald-950 text-emerald-400 border border-emerald-800 px-1.5 py-0.5 rounded font-bold">
                  80% A+ Filter
                </span>
                <span className="text-[9px] font-mono uppercase bg-amber-950 text-amber-300 border border-amber-800 px-1.5 py-0.5 rounded font-bold">
                  IST
                </span>
              </div>
              <p className="text-[11px] text-gray-400 truncate">
                NIFTY 50 & BANK NIFTY 5M High-Probability Strategy
              </p>
            </div>
          </div>

          {/* Navigation Tabs - Horizontal Scroll on Mobile */}
          <nav className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none w-full sm:w-auto">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                activeTab === 'dashboard'
                  ? 'bg-neutralBlue text-white shadow-md'
                  : 'text-gray-400 hover:text-white hover:bg-darkBg border border-borderCol/40'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              Live Signals
            </button>

            <button
              onClick={() => setActiveTab('rules')}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                activeTab === 'rules'
                  ? 'bg-neutralBlue text-white shadow-md'
                  : 'text-gray-400 hover:text-white hover:bg-darkBg border border-borderCol/40'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              Rules
            </button>

            <button
              onClick={() => setActiveTab('backtest')}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                activeTab === 'backtest'
                  ? 'bg-neutralBlue text-white shadow-md'
                  : 'text-gray-400 hover:text-white hover:bg-darkBg border border-borderCol/40'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              Backtesting
            </button>
          </nav>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6">
        {/* Compliance & Status Notice */}
        <div className="mb-4 sm:mb-6 p-3 bg-cardBg border border-borderCol rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-gray-400">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-accentGold flex-shrink-0" />
            <span className="text-[11px] sm:text-xs leading-tight">
              <strong>Disclaimer:</strong> Analytical signals for educational purposes only. Not financial advice.
            </span>
          </div>
          <div className="flex items-center gap-3 text-[10px] sm:text-xs">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              5m Closed Candles
            </span>
            <span className="text-gray-600">|</span>
            <span className="text-gray-400">IST 09:15 - 15:30</span>
          </div>
        </div>

        {activeTab === 'dashboard' && <Dashboard />}
        {activeTab === 'rules' && <RuleManagement />}
        {activeTab === 'backtest' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 font-semibold">Instrument:</span>
              {(['NIFTY 50', 'BANK NIFTY'] as const).map(inst => (
                <button
                  key={inst}
                  onClick={() => setBacktestInstrument(inst)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    backtestInstrument === inst
                      ? 'bg-neutralBlue text-white'
                      : 'bg-cardBg border border-borderCol text-gray-400 hover:text-white'
                  }`}
                >
                  {inst}
                </button>
              ))}
            </div>
            <BacktestView candles={[]} instrument={backtestInstrument} />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-borderCol py-4 bg-darkBg text-xs text-gray-500 text-center">
        Market Signal Application • Built strictly on user-verified 5m trading rules & Supabase architecture.
      </footer>
    </div>
  );
};

export default App;
