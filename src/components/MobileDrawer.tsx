import React from 'react';
import { 
  X, 
  BarChart3, 
  TrendingUp, 
  Activity, 
  Sliders, 
  Compass, 
  Layers, 
  Landmark, 
  Zap, 
  Target, 
  Calculator, 
  Send, 
  Smartphone, 
  LogOut, 
  Clock, 
  ShieldCheck, 
  User,
  Volume2,
  VolumeX,
  Sparkles,
  ChevronRight
} from 'lucide-react';
import type { AppUser } from '../services/appAuthService';
import { SoundAlertService } from '../services/soundAlertService';

interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: AppUser | null;
  currentTimeIST: string;
  activeTab: string;
  onSelectTab: (tab: string, section?: string) => void;
  onOpenRiskCalc: () => void;
  onOpenTelegramModal: () => void;
  onLogout: () => void;
}

export const MobileDrawer: React.FC<MobileDrawerProps> = ({
  isOpen,
  onClose,
  currentUser,
  currentTimeIST,
  activeTab,
  onSelectTab,
  onOpenRiskCalc,
  onOpenTelegramModal,
  onLogout,
}) => {
  if (!isOpen) return null;

  const isSoundOn = SoundAlertService.isSoundEnabled();

  const handleItemClick = (action: () => void) => {
    action();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop overlay */}
      <div 
        className="fixed inset-0 bg-black/80 backdrop-blur-md transition-opacity animate-fadeIn"
        onClick={onClose}
      />

      {/* Slide-out Menu Panel */}
      <div className="relative w-4/5 max-w-xs sm:max-w-sm bg-[#0a0f1d] border-r border-gray-800/90 h-full flex flex-col shadow-2xl z-10 overflow-hidden">
        {/* Drawer Header: User Profile Card */}
        <div className="p-4 sm:p-5 bg-gradient-to-b from-[#10192e] to-[#0d1424] border-b border-gray-800/80">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center text-white font-black text-sm shadow-md shadow-blue-500/20">
                {currentUser?.username?.[0] || 'T'}
              </div>
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                  {currentUser?.name || 'Taufik Patel'}
                  <span className="text-[9px] px-1.5 py-0.2 bg-emerald-950 text-emerald-400 border border-emerald-800 rounded font-mono font-bold">
                    PRO
                  </span>
                </h3>
                <p className="text-[11px] text-gray-400 font-mono truncate max-w-[150px]">
                  {currentUser?.email || 'tufikpatel23@gmail.com'}
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800/60 transition"
              aria-label="Close menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-gray-800/60 text-[10px] text-gray-400 font-mono">
            <span className="flex items-center gap-1 text-cyan-400">
              <Clock className="w-3 h-3" />
              {currentTimeIST || '09:15 - 15:30 IST'}
            </span>
            <span className="text-emerald-400 font-semibold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
              PIN 9096 Active
            </span>
          </div>
        </div>

        {/* Scrollable Navigation Items */}
        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          {/* Section 1: Live Trading & Market Signals */}
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 px-2 block mb-1.5">
              ट्रेडिंग व लाईव्ह ॲनालिटिक्स
            </span>
            <div className="space-y-1">
              <button
                onClick={() => handleItemClick(() => onSelectTab('dashboard', 'ALL'))}
                className={`w-full flex items-center justify-between p-2.5 rounded-xl text-xs font-semibold transition ${
                  activeTab === 'dashboard'
                    ? 'bg-blue-600/20 text-cyan-300 border border-cyan-500/40'
                    : 'text-gray-300 hover:bg-gray-800/50 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className="p-1.5 rounded-lg bg-blue-500/20 text-blue-400">
                    <BarChart3 className="w-4 h-4" />
                  </span>
                  <span>📈 लाईव्ह सिग्नल्स व चार्ट</span>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
              </button>

              <button
                onClick={() => handleItemClick(() => onSelectTab('dashboard', 'CPR'))}
                className="w-full flex items-center justify-between p-2.5 rounded-xl text-xs font-semibold text-gray-300 hover:bg-gray-800/50 hover:text-white transition"
              >
                <div className="flex items-center gap-2.5">
                  <span className="p-1.5 rounded-lg bg-cyan-500/20 text-cyan-400">
                    <Compass className="w-4 h-4" />
                  </span>
                  <span>🎯 CPR प्रेडिक्टर (Pivot Range)</span>
                </div>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800 font-mono">
                  Trending
                </span>
              </button>

              <button
                onClick={() => handleItemClick(() => onSelectTab('dashboard', 'OPTION_CHAIN'))}
                className="w-full flex items-center justify-between p-2.5 rounded-xl text-xs font-semibold text-gray-300 hover:bg-gray-800/50 hover:text-white transition"
              >
                <div className="flex items-center gap-2.5">
                  <span className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400">
                    <Layers className="w-4 h-4" />
                  </span>
                  <span>📊 ऑप्शन चेन व PCR मीटर</span>
                </div>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 font-mono">
                  Max Pain
                </span>
              </button>

              <button
                onClick={() => handleItemClick(() => onSelectTab('dashboard', 'FII_DII'))}
                className="w-full flex items-center justify-between p-2.5 rounded-xl text-xs font-semibold text-gray-300 hover:bg-gray-800/50 hover:text-white transition"
              >
                <div className="flex items-center gap-2.5">
                  <span className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-400">
                    <Landmark className="w-4 h-4" />
                  </span>
                  <span>🏛️ FII / DII संस्थात्मक डेटा</span>
                </div>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800 font-mono">
                  Flow
                </span>
              </button>

              <button
                onClick={() => handleItemClick(() => onSelectTab('dashboard', 'HERO_ZERO'))}
                className="w-full flex items-center justify-between p-2.5 rounded-xl text-xs font-semibold text-gray-300 hover:bg-gray-800/50 hover:text-white transition"
              >
                <div className="flex items-center gap-2.5">
                  <span className="p-1.5 rounded-lg bg-amber-500/20 text-accentGold">
                    <Zap className="w-4 h-4" />
                  </span>
                  <span>⚡ एक्सपायरी "हिरो-झिरो" रडार</span>
                </div>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800 font-mono">
                  1:15 PM
                </span>
              </button>

              <button
                onClick={() => handleItemClick(() => onSelectTab('dashboard', 'STRATEGIES'))}
                className="w-full flex items-center justify-between p-2.5 rounded-xl text-xs font-semibold text-gray-300 hover:bg-gray-800/50 hover:text-white transition"
              >
                <div className="flex items-center gap-2.5">
                  <span className="p-1.5 rounded-lg bg-purple-500/20 text-purple-400">
                    <Target className="w-4 h-4" />
                  </span>
                  <span>🎯 ३८ चार्ट पॅटर्न स्ट्रॅटेजीज</span>
                </div>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-800 font-mono">
                  75%+ Win
                </span>
              </button>
            </div>
          </div>

          {/* Section 2: Tools, Portfolio & Backtest */}
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 px-2 block mb-1.5">
              टूल्स व पोर्टफोलिओ
            </span>
            <div className="space-y-1">
              <button
                onClick={() => handleItemClick(onOpenRiskCalc)}
                className="w-full flex items-center justify-between p-2.5 rounded-xl text-xs font-semibold text-amber-300 bg-amber-950/20 border border-amber-800/50 hover:bg-amber-900/40 transition"
              >
                <div className="flex items-center gap-2.5">
                  <span className="p-1.5 rounded-lg bg-amber-500/20 text-accentGold">
                    <Calculator className="w-4 h-4" />
                  </span>
                  <span>🧮 लॉट व रिस्क कॅल्क्युलेटर</span>
                </div>
                <span className="text-[9px] font-mono font-bold bg-amber-900/60 px-1.5 py-0.5 rounded text-accentGold">
                  Open
                </span>
              </button>

              <button
                onClick={() => handleItemClick(() => onSelectTab('paper_trading'))}
                className={`w-full flex items-center justify-between p-2.5 rounded-xl text-xs font-semibold transition ${
                  activeTab === 'paper_trading'
                    ? 'bg-blue-600/20 text-cyan-300 border border-cyan-500/40'
                    : 'text-gray-300 hover:bg-gray-800/50 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400">
                    <Activity className="w-4 h-4" />
                  </span>
                  <span>💼 पेपर ट्रेडिंग खाते (₹१० लाख)</span>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
              </button>

              <button
                onClick={() => handleItemClick(() => onSelectTab('backtest'))}
                className={`w-full flex items-center justify-between p-2.5 rounded-xl text-xs font-semibold transition ${
                  activeTab === 'backtest'
                    ? 'bg-blue-600/20 text-cyan-300 border border-cyan-500/40'
                    : 'text-gray-300 hover:bg-gray-800/50 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className="p-1.5 rounded-lg bg-cyan-500/20 text-cyan-400">
                    <TrendingUp className="w-4 h-4" />
                  </span>
                  <span>🧪 स्ट्रॅटेजी बॅकटेस्टिंग लीडरबोर्ड</span>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
              </button>

              <button
                onClick={() => handleItemClick(() => onSelectTab('rules'))}
                className={`w-full flex items-center justify-between p-2.5 rounded-xl text-xs font-semibold transition ${
                  activeTab === 'rules'
                    ? 'bg-blue-600/20 text-cyan-300 border border-cyan-500/40'
                    : 'text-gray-300 hover:bg-gray-800/50 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className="p-1.5 rounded-lg bg-rose-500/20 text-rose-400">
                    <Sliders className="w-4 h-4" />
                  </span>
                  <span>📋 अल्गोरिदम नियम व फिल्टर्स</span>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
              </button>

              <button
                onClick={() => handleItemClick(onOpenTelegramModal)}
                className="w-full flex items-center justify-between p-2.5 rounded-xl text-xs font-semibold text-gray-300 hover:bg-gray-800/50 hover:text-white transition"
              >
                <div className="flex items-center gap-2.5">
                  <span className="p-1.5 rounded-lg bg-sky-500/20 text-sky-400">
                    <Send className="w-4 h-4" />
                  </span>
                  <span>⚙️ टेलिग्राम बॉट सूचना (8932116600)</span>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
              </button>
            </div>
          </div>
        </div>

        {/* Drawer Footer: Sound toggle, App Install & Logout */}
        <div className="p-3 bg-black/60 border-t border-gray-800/80 space-y-2">
          {/* Audio Alert Status Pill */}
          <div className="flex items-center justify-between p-2 rounded-xl bg-gray-900/60 border border-gray-800 text-xs">
            <span className="text-gray-400 flex items-center gap-1.5">
              {isSoundOn ? <Volume2 className="w-3.5 h-3.5 text-emerald-400" /> : <VolumeX className="w-3.5 h-3.5 text-rose-400" />}
              व्हॉईस व ऑडिओ अलर्ट्स:
            </span>
            <span className={`font-bold ${isSoundOn ? 'text-emerald-400' : 'text-rose-400'}`}>
              {isSoundOn ? 'चालू (ON)' : 'म्यूट (OFF)'}
            </span>
          </div>

          {/* Logout Button */}
          <button
            onClick={() => handleItemClick(onLogout)}
            className="w-full py-2.5 px-3 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-900/60 text-rose-300 hover:text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 active:scale-95"
          >
            <LogOut className="w-4 h-4" />
            <span>लॉगआउट (Logout)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
