import React, { useState } from 'react';
import { 
  ShieldCheck, 
  Lock, 
  KeyRound, 
  User, 
  ArrowRight, 
  TrendingUp, 
  Activity, 
  Eye, 
  EyeOff, 
  Zap, 
  Sparkles,
  AlertCircle,
  Smartphone
} from 'lucide-react';
import { AppAuthService, type AppUser } from '../services/appAuthService';

interface LoginPageProps {
  onLoginSuccess: (user: AppUser) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [tab, setTab] = useState<'pin' | 'credentials'>('pin');
  
  // PIN mode state
  const [pin, setPin] = useState<string>('');
  
  // Credentials mode state
  const [username, setUsername] = useState<string>('trader');
  const [password, setPassword] = useState<string>('9096');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  
  const [rememberMe, setRememberMe] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setIsSubmitting(true);

    setTimeout(() => {
      const res = AppAuthService.loginWithPin(pin, rememberMe);
      if (res.success && res.user) {
        onLoginSuccess(res.user);
      } else {
        setErrorMessage(res.error || 'अवैध PIN. कृपया पुन्हा प्रयत्न करा.');
        setIsSubmitting(false);
      }
    }, 250);
  };

  const handleCredentialsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setIsSubmitting(true);

    setTimeout(() => {
      const res = AppAuthService.loginWithCredentials(username, password, rememberMe);
      if (res.success && res.user) {
        onLoginSuccess(res.user);
      } else {
        setErrorMessage(res.error || 'अवैध युझरनेम किंवा पासवर्ड.');
        setIsSubmitting(false);
      }
    }, 250);
  };

  const handleQuickLogin = () => {
    setIsSubmitting(true);
    setErrorMessage('');
    setTimeout(() => {
      const user = AppAuthService.instantAccess();
      onLoginSuccess(user);
    }, 200);
  };

  const handleKeypadPress = (digit: string) => {
    if (pin.length < 6) {
      const newPin = pin + digit;
      setPin(newPin);
      if (newPin.length === 4) {
        // Auto-check PIN when 4 digits are entered
        setTimeout(() => {
          const res = AppAuthService.loginWithPin(newPin, rememberMe);
          if (res.success && res.user) {
            onLoginSuccess(res.user);
          }
        }, 150);
      }
    }
  };

  const handleKeypadBackspace = () => {
    setPin(prev => prev.slice(0, -1));
  };

  return (
    <div className="min-h-screen bg-[#070a12] text-gray-100 flex flex-col justify-between relative overflow-hidden font-sans select-none">
      {/* Background Ambient Glows & Grid */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/20 via-[#070a12] to-[#070a12] pointer-events-none" />
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-72 h-72 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
      
      {/* Subtle Grid overlay */}
      <div 
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(#3b82f6 1px, transparent 1px), linear-gradient(90deg, #3b82f6 1px, transparent 1px)`,
          backgroundSize: '40px 40px'
        }}
      />

      {/* Top Mini Header */}
      <header className="relative z-10 w-full px-4 py-4 sm:py-6 max-w-6xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-gradient-to-tr from-blue-600 to-cyan-500 rounded-xl shadow-lg shadow-blue-500/20 text-white flex-shrink-0">
            <Activity className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-black text-sm sm:text-base tracking-wider bg-gradient-to-r from-white via-gray-100 to-gray-400 bg-clip-text text-transparent">
                ALGO OPTION TERMINAL
              </span>
              <span className="px-1.5 py-0.5 text-[9px] font-mono font-bold bg-emerald-950 text-emerald-400 border border-emerald-800 rounded">
                v2.4
              </span>
            </div>
            <p className="text-[10px] text-gray-400 hidden sm:block">
              80% Win-Rate Confluence • Black-Scholes Greeks Engine
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-950/60 border border-emerald-800/80 text-emerald-300 font-mono text-[11px]">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
            LIVE MARKET
          </span>
        </div>
      </header>

      {/* Main Login Card */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-6">
        <div className="w-full max-w-md">
          {/* Glass Card Container */}
          <div className="relative bg-[#0d1424]/90 backdrop-blur-xl border border-gray-800/80 rounded-2xl sm:rounded-3xl p-5 sm:p-8 shadow-2xl shadow-black/80 space-y-5">
            {/* Ambient edge highlight */}
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent" />

            {/* Header / Title */}
            <div className="text-center space-y-1.5">
              <div className="inline-flex p-3 bg-gradient-to-br from-blue-600/20 to-cyan-500/10 border border-blue-500/30 rounded-2xl text-cyan-400 shadow-inner mb-1">
                <Lock className="w-6 h-6" />
              </div>
              <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                ट्रेडर लॉगिन (Terminal Login)
              </h2>
              <p className="text-xs text-gray-400">
                सुरक्षित ट्रेडिंग टर्मिनलमध्ये प्रवेश करण्यासाठी लॉगिन करा
              </p>
            </div>

            {/* Fast Quick 1-Click Access Button (Most Mobile Friendly!) */}
            <div className="p-3 bg-gradient-to-r from-blue-950/40 via-cyan-950/30 to-blue-950/40 border border-cyan-800/40 rounded-xl">
              <div className="flex items-center justify-between gap-2">
                <div className="text-left">
                  <span className="text-[11px] font-bold text-cyan-300 flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-accentGold" /> 1-Click Quick Access
                  </span>
                  <span className="text-[10px] text-gray-400 block">
                    पासवर्ड न टाकता थेट सुरू करा
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleQuickLogin}
                  disabled={isSubmitting}
                  className="px-3 py-1.5 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-bold text-xs rounded-lg shadow-md transition flex items-center gap-1 active:scale-95"
                >
                  <Zap className="w-3.5 h-3.5" />
                  प्रवेश करा
                </button>
              </div>
            </div>

            {/* Tab Switcher: PIN vs Username/Password */}
            <div className="grid grid-cols-2 p-1 bg-black/40 border border-gray-800/80 rounded-xl text-xs font-semibold">
              <button
                type="button"
                onClick={() => { setTab('pin'); setErrorMessage(''); }}
                className={`py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition ${
                  tab === 'pin'
                    ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-md'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <KeyRound className="w-3.5 h-3.5" />
                Security PIN
              </button>
              <button
                type="button"
                onClick={() => { setTab('credentials'); setErrorMessage(''); }}
                className={`py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition ${
                  tab === 'credentials'
                    ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-md'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <User className="w-3.5 h-3.5" />
                ID & Password
              </button>
            </div>

            {/* Error Message */}
            {errorMessage && (
              <div className="p-3 bg-red-950/70 border border-red-800 text-red-200 text-xs rounded-xl flex items-center gap-2 animate-shake">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* PIN Tab Form */}
            {tab === 'pin' && (
              <form onSubmit={handlePinSubmit} className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <label className="text-gray-300 font-semibold flex items-center gap-1">
                      <Smartphone className="w-3.5 h-3.5 text-cyan-400" />
                      4-अंकी सुरक्षा PIN
                    </label>
                    <span className="text-[10px] text-gray-500 font-mono">
                      (डिफॉल्ट PIN: <strong className="text-cyan-400">9096</strong>)
                    </span>
                  </div>

                  {/* Masked PIN Display */}
                  <div className="flex items-center justify-center gap-3 py-2">
                    {[0, 1, 2, 3].map((idx) => (
                      <div
                        key={idx}
                        className={`w-11 h-12 rounded-xl border flex items-center justify-center text-lg font-bold font-mono transition-all ${
                          pin.length > idx
                            ? 'bg-blue-950/70 border-cyan-400 text-cyan-300 shadow-lg shadow-cyan-500/20 scale-105'
                            : 'bg-black/30 border-gray-700/80 text-gray-600'
                        }`}
                      >
                        {pin.length > idx ? '●' : ''}
                      </div>
                    ))}
                  </div>

                  {/* Hidden input for physical keyboard entry */}
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                    placeholder="Type PIN here..."
                    className="w-full bg-black/40 border border-gray-800 rounded-lg py-2 px-3 text-center text-sm font-mono tracking-widest text-white focus:outline-none focus:border-cyan-500"
                    autoFocus
                  />
                </div>

                {/* Mobile Touch Keypad */}
                <div className="grid grid-cols-3 gap-2 pt-1">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'].map((btn) => (
                    <button
                      key={btn}
                      type="button"
                      onClick={() => {
                        if (btn === 'C') setPin('');
                        else if (btn === '⌫') handleKeypadBackspace();
                        else handleKeypadPress(btn);
                      }}
                      className={`h-11 rounded-xl text-base font-bold transition flex items-center justify-center active:scale-95 ${
                        btn === 'C'
                          ? 'bg-gray-800/50 text-gray-400 hover:text-white border border-gray-700/60'
                          : btn === '⌫'
                          ? 'bg-gray-800/50 text-gray-400 hover:text-white border border-gray-700/60'
                          : 'bg-gray-900/80 hover:bg-gray-800 text-white border border-gray-800 font-mono shadow-sm'
                      }`}
                    >
                      {btn}
                    </button>
                  ))}
                </div>

                {/* Remember Me Checkbox */}
                <div className="flex items-center justify-between text-xs text-gray-400 pt-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="rounded bg-gray-900 border-gray-700 text-blue-500 focus:ring-0"
                    />
                    <span>या डिव्हाइसवर लॉगिन ठेवा</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setPin('9096')}
                    className="text-cyan-400 hover:underline text-[11px]"
                  >
                    Auto-Fill 9096
                  </button>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isSubmitting || pin.length < 4}
                  className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-sm rounded-xl shadow-lg shadow-blue-500/25 transition flex items-center justify-center gap-2 active:scale-98"
                >
                  <span>टर्मिनल उघडा (Access Terminal)</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            )}

            {/* Credentials Tab Form */}
            {tab === 'credentials' && (
              <form onSubmit={handleCredentialsSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs text-gray-300 font-semibold block">
                    युझरनेम / Trader ID
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-gray-400 absolute left-3 top-3 pointer-events-none" />
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="e.g. trader or admin"
                      className="w-full bg-black/40 border border-gray-800 rounded-xl py-2.5 pl-9 pr-3 text-sm text-white focus:outline-none focus:border-cyan-500"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-gray-300 font-semibold block">
                    पासवर्ड / PIN
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-3 pointer-events-none" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter password (default: 9096)"
                      className="w-full bg-black/40 border border-gray-800 rounded-xl py-2.5 pl-9 pr-10 text-sm text-white focus:outline-none focus:border-cyan-500 font-mono"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-200"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Remember Me */}
                <div className="flex items-center justify-between text-xs text-gray-400">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="rounded bg-gray-900 border-gray-700 text-blue-500 focus:ring-0"
                    />
                    <span>लॉगिन सेव्ह ठेवा</span>
                  </label>
                  <span className="text-gray-500 text-[11px]">Default: trader / 9096</span>
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 disabled:opacity-50 text-white font-bold text-sm rounded-xl shadow-lg shadow-blue-500/25 transition flex items-center justify-center gap-2 active:scale-98"
                >
                  <span>साइन इन करा (Sign In)</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            )}

            {/* Security Badge */}
            <div className="pt-2 border-t border-gray-800/80 flex items-center justify-between text-[11px] text-gray-500">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                256-Bit SSL Encrypted
              </span>
              <span>Strictly Signal-Only</span>
            </div>
          </div>
        </div>
      </main>

      {/* Footer / Regulatory Notice */}
      <footer className="relative z-10 py-3 text-center text-[10px] text-gray-500 px-4">
        Autonomous Algo Terminal • NIFTY & BANK NIFTY 5-Minute Closed Price Action Signals
      </footer>
    </div>
  );
};
