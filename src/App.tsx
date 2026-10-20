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

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'rules' | 'dashboard'>('dashboard');

  return (
    <div className="min-h-screen bg-darkBg text-gray-100 flex flex-col font-sans">
      {/* Top Header */}
      <header className="border-b border-borderCol bg-cardBg/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-neutralBlue/20 border border-neutralBlue/40 rounded-xl text-neutralBlue">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold tracking-tight text-white">
                  Market Signal Engine
                </h1>
                <span className="text-[10px] font-mono uppercase bg-emerald-950 text-emerald-400 border border-emerald-800 px-1.5 py-0.5 rounded font-bold">
                  5M TF Active
                </span>
                <span className="text-[10px] font-mono uppercase bg-amber-950 text-amber-300 border border-amber-800 px-1.5 py-0.5 rounded font-bold">
                  IST (Asia/Kolkata)
                </span>
              </div>
              <p className="text-xs text-gray-400">
                Automated Price Action & Pivot Strategy for NIFTY 50 & BANK NIFTY
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === 'dashboard'
                  ? 'bg-neutralBlue text-white shadow-md'
                  : 'text-gray-400 hover:text-white hover:bg-darkBg'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              Live Signals & Charts
            </button>

            <button
              onClick={() => setActiveTab('rules')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === 'rules'
                  ? 'bg-neutralBlue text-white shadow-md'
                  : 'text-gray-400 hover:text-white hover:bg-darkBg'
              }`}
            >
              <Sliders className="w-4 h-4" />
              Rule Management
            </button>
          </nav>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Compliance & Status Notice */}
        <div className="mb-6 p-3 bg-cardBg border border-borderCol rounded-xl flex items-center justify-between text-xs text-gray-400">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-accentGold" />
            <span>
              <strong>Disclaimer:</strong> This application generates analytical signals for educational & testing purposes only. Not financial advice.
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Closed Candle Eval (5m)
            </span>
            <span className="text-gray-500">|</span>
            <span className="text-gray-400">Timezone: IST (09:15 - 15:30)</span>
          </div>
        </div>

        {activeTab === 'dashboard' && <Dashboard />}
        {activeTab === 'rules' && <RuleManagement />}
      </main>

      {/* Footer */}
      <footer className="border-t border-borderCol py-4 bg-darkBg text-xs text-gray-500 text-center">
        Market Signal Application • Built strictly on user-verified 5m trading rules & Supabase architecture.
      </footer>
    </div>
  );
};

export default App;
