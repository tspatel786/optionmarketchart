import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  Activity, 
  Sliders, 
  AlertCircle,
  BarChart3, 
  LogOut, 
  User, 
  Clock, 
  Radio, 
  Sparkles, 
  Shield, 
  Layers,
  Menu,
  Compass,
  Landmark,
  Zap,
  Calculator
} from 'lucide-react';
import { RuleManagement } from './components/RuleManagement';
import { Dashboard, type DashboardViewSection } from './components/Dashboard';
import { BacktestView } from './components/BacktestView';
import { PaperTradingPortfolio } from './components/PaperTradingPortfolio';
import { LoginPage } from './components/LoginPage';
import { MobileDrawer } from './components/MobileDrawer';
import { AppAuthService, type AppUser } from './services/appAuthService';
import { MarketHoursHelper } from './engine/marketHours';

export const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => AppAuthService.isAuthenticated());
  const [currentUser, setCurrentUser] = useState<AppUser | null>(() => AppAuthService.getCurrentUser());
  const [activeTab, setActiveTab] = useState<'dashboard' | 'paper_trading' | 'rules' | 'backtest'>('dashboard');
  const [dashboardSection, setDashboardSection] = useState<DashboardViewSection>('ALL');
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState<boolean>(false);
  const [isRiskModalOpen, setIsRiskModalOpen] = useState<boolean>(false);
  const [backtestInstrument, setBacktestInstrument] = useState<'NIFTY 50' | 'BANK NIFTY'>('NIFTY 50');
  const [currentTimeIST, setCurrentTimeIST] = useState<string>('');

  // Live IST Clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTimeIST(
        now.toLocaleTimeString('en-IN', {
          timeZone: 'Asia/Kolkata',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        })
      );
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleLoginSuccess = (user: AppUser) => {
    setCurrentUser(user);
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    AppAuthService.logout();
    setCurrentUser(null);
    setIsAuthenticated(false);
  };

  // If not logged in, render the Login Page
  if (!isAuthenticated) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen bg-[#070a12] text-gray-100 flex flex-col font-sans select-none antialiased">
      {/* Top Application Header */}
      <header className="border-b border-gray-800/80 bg-[#0d1424]/90 backdrop-blur-xl sticky top-0 z-40 shadow-lg">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3">
          {/* Brand Identity & Mobile Hamburger Menu */}
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            {/* Mobile Menu Trigger Button (☰ Hamburger) */}
            <button
              onClick={() => setIsMobileDrawerOpen(true)}
              className="sm:hidden p-2 rounded-xl bg-black/40 border border-gray-800 text-gray-300 hover:text-white hover:bg-gray-800 transition active:scale-95 flex-shrink-0"
              aria-label="Open Mobile Drawer Menu"
              title="मेनू उघडा (Open Menu)"
            >
              <Menu className="w-5 h-5 text-cyan-400" />
            </button>

            <div className="p-2 bg-gradient-to-tr from-blue-600 to-cyan-500 rounded-xl text-white shadow-md shadow-blue-500/20 flex-shrink-0">
              <Activity className="w-5 h-5 animate-pulse" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h1 className="text-sm sm:text-base font-black tracking-wider text-white truncate">
                  ALGO QUANTUM
                </h1>
                <span className="text-[9px] font-mono uppercase bg-emerald-950/80 text-emerald-400 border border-emerald-800 px-1.5 py-0.5 rounded font-bold hidden sm:inline-flex items-center gap-1">
                  <span className="w-1 h-1 rounded-full bg-emerald-400 animate-ping" />
                  80% Confluence
                </span>
                <span className="text-[9px] font-mono uppercase bg-cyan-950/80 text-cyan-300 border border-cyan-800 px-1.5 py-0.5 rounded font-bold">
                  v2.5
                </span>
              </div>
              <p className="text-[10px] text-gray-400 truncate hidden md:block">
                NIFTY • BANK NIFTY • FINNIFTY • SENSEX Terminal
              </p>
            </div>
          </div>

          {/* Desktop & Tablet Navigation */}
          <nav className="hidden sm:flex items-center gap-1 bg-black/40 p-1 border border-gray-800/80 rounded-xl">
            <button
              onClick={() => {
                setActiveTab('dashboard');
                setDashboardSection('ALL');
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                activeTab === 'dashboard' && dashboardSection === 'ALL'
                  ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-md shadow-blue-500/20'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800/40'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              Live Signals
            </button>

            <button
              onClick={() => {
                setActiveTab('dashboard');
                setDashboardSection('CPR');
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                activeTab === 'dashboard' && dashboardSection === 'CPR'
                  ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-md shadow-blue-500/20'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800/40'
              }`}
            >
              <Compass className="w-3.5 h-3.5" />
              CPR
            </button>

            <button
              onClick={() => {
                setActiveTab('dashboard');
                setDashboardSection('FII_DII');
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                activeTab === 'dashboard' && dashboardSection === 'FII_DII'
                  ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-md shadow-blue-500/20'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800/40'
              }`}
            >
              <Landmark className="w-3.5 h-3.5" />
              FII/DII
            </button>

            <button
              onClick={() => setActiveTab('paper_trading')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                activeTab === 'paper_trading'
                  ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-md shadow-blue-500/20'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800/40'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              Paper Trade
            </button>

            <button
              onClick={() => setActiveTab('rules')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                activeTab === 'rules'
                  ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-md shadow-blue-500/20'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800/40'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              Rules
            </button>

            <button
              onClick={() => setActiveTab('backtest')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                activeTab === 'backtest'
                  ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-md shadow-blue-500/20'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800/40'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              Backtesting
            </button>
          </nav>

          {/* Right Toolbar: Live Clock, User Pill & Logout */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Live IST Clock */}
            <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 bg-black/40 border border-gray-800 rounded-lg text-xs font-mono text-cyan-300">
              <Clock className="w-3.5 h-3.5 text-cyan-400" />
              <span>{currentTimeIST || 'IST'}</span>
            </div>

            {/* User Profile Pill */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-gray-900/80 border border-gray-800 rounded-lg text-xs">
              <div className="w-5 h-5 rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 flex items-center justify-center text-[10px] font-bold text-white uppercase">
                {currentUser?.username?.[0] || 'T'}
              </div>
              <span className="text-gray-300 font-semibold hidden md:inline">
                {currentUser?.name || 'Taufik'}
              </span>
              <span className="text-[9px] px-1 bg-emerald-950 text-emerald-400 border border-emerald-800 rounded font-bold font-mono">
                PRO
              </span>
            </div>

            {/* Logout Button */}
            <button
              onClick={handleLogout}
              className="p-1.5 sm:px-2.5 sm:py-1 bg-red-950/40 hover:bg-red-900/60 border border-red-900/60 text-red-300 hover:text-white rounded-lg text-xs font-medium transition flex items-center gap-1.5 active:scale-95"
              title="Logout / बाहेर पडा"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">बाहेर पडा</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main App Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-3 sm:py-6 pb-24 sm:pb-8">
        {/* Compliance & Status Notice */}
        <div className="mb-4 sm:mb-6 p-2.5 sm:p-3 bg-gradient-to-r from-[#0d1424] via-[#10192e] to-[#0d1424] border border-gray-800/80 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-gray-400 shadow-md">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-accentGold flex-shrink-0" />
            <span className="text-[11px] sm:text-xs leading-tight">
              <strong>Strictly Signal-Only:</strong> Analytical signals & paper trading only. No automated broker orders. Not financial advice.
            </span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 text-[10px] sm:text-xs text-gray-300 font-mono">
            {MarketHoursHelper.getSessionInfo().isOpen ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                NSE LIVE (09:15 - 15:30)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800 font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                मार्केट बंद (3:30 PM Close) • 15:30 Closing Data
              </span>
            )}
          </div>
        </div>

        {activeTab === 'dashboard' && (
          <Dashboard
            initialSection={dashboardSection}
            isRiskModalExternalOpen={isRiskModalOpen}
            onCloseRiskModalExternal={() => setIsRiskModalOpen(false)}
          />
        )}
        {activeTab === 'paper_trading' && <PaperTradingPortfolio />}
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
                      ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-md'
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

      {/* Modern Mobile Bottom Navigation Bar (Fixed for Smartphones) */}
      <nav className="sm:hidden fixed bottom-0 inset-x-0 z-40 bg-[#0d1424]/95 backdrop-blur-xl border-t border-gray-800/80 px-2 py-1.5 flex items-center justify-around shadow-2xl shadow-black">
        <button
          onClick={() => {
            setActiveTab('dashboard');
            setDashboardSection('ALL');
          }}
          className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition ${
            activeTab === 'dashboard' && dashboardSection === 'ALL'
              ? 'text-cyan-400 font-bold scale-105'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          <BarChart3 className="w-5 h-5 mb-0.5" />
          <span className="text-[10px]">Signals</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('dashboard');
            setDashboardSection('CPR');
          }}
          className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition ${
            activeTab === 'dashboard' && dashboardSection === 'CPR'
              ? 'text-cyan-400 font-bold scale-105'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          <Compass className="w-5 h-5 mb-0.5" />
          <span className="text-[10px]">CPR / PCR</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('dashboard');
            setDashboardSection('FII_DII');
          }}
          className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition ${
            activeTab === 'dashboard' && dashboardSection === 'FII_DII'
              ? 'text-cyan-400 font-bold scale-105'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          <Landmark className="w-5 h-5 mb-0.5" />
          <span className="text-[10px]">FII / DII</span>
        </button>

        <button
          onClick={() => setActiveTab('paper_trading')}
          className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition ${
            activeTab === 'paper_trading'
              ? 'text-cyan-400 font-bold scale-105'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          <Activity className="w-5 h-5 mb-0.5" />
          <span className="text-[10px]">Portfolio</span>
        </button>

        <button
          onClick={() => setIsMobileDrawerOpen(true)}
          className="flex flex-col items-center justify-center py-1 px-2.5 rounded-xl text-amber-400 font-bold transition hover:text-accentGold active:scale-95"
        >
          <Menu className="w-5 h-5 mb-0.5" />
          <span className="text-[10px]">Menu ☰</span>
        </button>
      </nav>

      {/* Slide-out Mobile App Drawer Component */}
      <MobileDrawer
        isOpen={isMobileDrawerOpen}
        onClose={() => setIsMobileDrawerOpen(false)}
        currentUser={currentUser}
        currentTimeIST={currentTimeIST}
        activeTab={activeTab}
        onSelectTab={(tab, section) => {
          setActiveTab(tab as any);
          if (section) {
            setDashboardSection(section as any);
          }
        }}
        onOpenRiskCalc={() => {
          setActiveTab('dashboard');
          setIsRiskModalOpen(true);
        }}
        onOpenTelegramModal={() => {
          setActiveTab('dashboard');
        }}
        onLogout={handleLogout}
      />

      {/* Desktop Footer */}
      <footer className="border-t border-gray-800/60 py-3 bg-[#070a12] text-xs text-gray-500 text-center hidden sm:block">
        Autonomous Algo Terminal • Built strictly on 5M closed candle price action rules & Black-Scholes Greeks.
      </footer>
    </div>
  );
};

export default App;
