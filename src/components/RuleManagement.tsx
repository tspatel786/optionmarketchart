import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Sliders, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  Activity, 
  Save, 
  RotateCcw,
  Plus
} from 'lucide-react';
import type { TradingCondition } from '../types/rules';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

// Default initial rules verified from screenshots (All on 5m timeframe)
const INITIAL_CONDITIONS: TradingCondition[] = [
  {
    id: 'c1',
    rule_id: 'r1',
    condition_code: 'VX-01',
    name: 'India VIX Below 10 (Sideways Filter)',
    category: 'VOLATILITY',
    indicator: 'INDIA_VIX',
    condition_type: 'MANDATORY_FILTER',
    operator: 'GREATER_THAN',
    threshold_values: { min: 10.0 },
    instrument: 'INDIA VIX',
    timeframe: '5m',
    is_required: true,
    enabled: true,
    source_screenshot_ref: 'या दिवशी Trade टाळा (Batch 1 Img 2)',
    validation_status: 'VERIFIED'
  },
  {
    id: 'c2',
    rule_id: 'r1',
    condition_code: 'RF-01',
    name: 'Friday Sideways / Weekend Hedging Caution',
    category: 'RISK_FILTER',
    indicator: 'CALENDAR',
    condition_type: 'CAUTION',
    operator: 'EQUALS',
    threshold_values: { day: 'Friday' },
    instrument: null,
    timeframe: '5m',
    is_required: false,
    enabled: true,
    source_screenshot_ref: 'शुक्रवारी पुढे 2 दिवस सुट्टी (Batch 1 Img 2)',
    validation_status: 'VERIFIED'
  },
  {
    id: 'c3',
    rule_id: 'r1',
    condition_code: 'RF-02',
    name: 'Consecutive Trend Days Exhaustion',
    category: 'RISK_FILTER',
    indicator: 'TREND_FATIGUE',
    condition_type: 'CAUTION',
    operator: 'LESS_THAN',
    threshold_values: { max_days: 4 },
    instrument: null,
    timeframe: '1D',
    is_required: false,
    enabled: true,
    source_screenshot_ref: 'सलग Trendy -> 4 -> Sideways (Batch 1 Img 2)',
    validation_status: 'VERIFIED'
  },
  {
    id: 'c4',
    rule_id: 'r1',
    condition_code: 'RF-03',
    name: 'Post Big Loss 2-Day Cool-off Gap',
    category: 'RISK_FILTER',
    indicator: 'ACCOUNT_RISK',
    condition_type: 'MANDATORY_FILTER',
    operator: 'EQUALS',
    threshold_values: { cooldown_days: 2 },
    instrument: null,
    timeframe: '1D',
    is_required: true,
    enabled: false,
    source_screenshot_ref: 'मोठा Loss -> 2 दिवस Gap (Batch 1 Img 2)',
    validation_status: 'VERIFIED'
  },
  {
    id: 'c5',
    rule_id: 'r1',
    condition_code: 'RF-04',
    name: 'Post Big Profit 1-Day Cool-off Gap',
    category: 'RISK_FILTER',
    indicator: 'ACCOUNT_RISK',
    condition_type: 'MANDATORY_FILTER',
    operator: 'EQUALS',
    threshold_values: { cooldown_days: 1 },
    instrument: null,
    timeframe: '1D',
    is_required: true,
    enabled: false,
    source_screenshot_ref: 'मोठा Profit -> 1 Day Gap (Batch 1 Img 2)',
    validation_status: 'VERIFIED'
  },
  {
    id: 'c6',
    rule_id: 'r1',
    condition_code: 'MB-01',
    name: 'Advances > Declines (Bullish Bias)',
    category: 'MARKET_BREADTH',
    indicator: 'ADVANCES_DECLINES',
    condition_type: 'BIAS_FILTER',
    operator: 'GREATER_THAN',
    threshold_values: { ratio: 1.0 },
    instrument: 'NSE',
    timeframe: '5m',
    is_required: false,
    enabled: true,
    source_screenshot_ref: 'Advance जास्त ↑ up (Batch 1 Img 1)',
    validation_status: 'VERIFIED'
  },
  {
    id: 'c7',
    rule_id: 'r1',
    condition_code: 'MB-02',
    name: 'Declines > Advances (Bearish Bias)',
    category: 'MARKET_BREADTH',
    indicator: 'ADVANCES_DECLINES',
    condition_type: 'BIAS_FILTER',
    operator: 'GREATER_THAN',
    threshold_values: { ratio: 1.0 },
    instrument: 'NSE',
    timeframe: '5m',
    is_required: false,
    enabled: true,
    source_screenshot_ref: 'Decline जास्त ↓ Down (Batch 1 Img 1)',
    validation_status: 'VERIFIED'
  },
  {
    id: 'c8',
    rule_id: 'r1',
    condition_code: 'VX-02',
    name: 'India VIX Stable Range (10 - 14)',
    category: 'VOLATILITY',
    indicator: 'INDIA_VIX',
    condition_type: 'BIAS_FILTER',
    operator: 'BETWEEN',
    threshold_values: { min: 10.0, max: 14.0 },
    instrument: 'INDIA VIX',
    timeframe: '5m',
    is_required: false,
    enabled: true,
    source_screenshot_ref: '14 च्या खाली Stable Market (Batch 1 Img 4)',
    validation_status: 'VERIFIED'
  },
  {
    id: 'c9',
    rule_id: 'r1',
    condition_code: 'VX-03',
    name: 'India VIX High Volatility (14-15+)',
    category: 'VOLATILITY',
    indicator: 'INDIA_VIX',
    condition_type: 'BIAS_FILTER',
    operator: 'GREATER_THAN',
    threshold_values: { min: 14.5 },
    instrument: 'INDIA VIX',
    timeframe: '5m',
    is_required: false,
    enabled: true,
    source_screenshot_ref: '14-15 ↑ मोठ्या Move (Batch 1 Img 4)',
    validation_status: 'VERIFIED'
  },
  // 5m Bullish Candlestick Patterns
  {
    id: 'c10',
    rule_id: 'r1',
    condition_code: 'PA-01',
    name: 'Hammer Pattern (5m Closed)',
    category: 'PRICE_ACTION',
    indicator: 'CANDLESTICK_PATTERN',
    condition_type: 'TRIGGER',
    operator: 'PATTERN_MATCH',
    threshold_values: { pattern: 'HAMMER', direction: 'BUY', min_wick_ratio: 2.0 },
    instrument: null,
    timeframe: '5m',
    is_required: false,
    enabled: true,
    source_screenshot_ref: '8 Candlestick Patterns #1 (Batch 1 Img 5)',
    validation_status: 'VERIFIED'
  },
  {
    id: 'c11',
    rule_id: 'r1',
    condition_code: 'PA-03',
    name: 'Three White Soldiers (5m Closed)',
    category: 'PRICE_ACTION',
    indicator: 'CANDLESTICK_PATTERN',
    condition_type: 'TRIGGER',
    operator: 'PATTERN_MATCH',
    threshold_values: { pattern: 'THREE_WHITE_SOLDIERS', direction: 'BUY' },
    instrument: null,
    timeframe: '5m',
    is_required: false,
    enabled: true,
    source_screenshot_ref: '8 Candlestick Patterns #3 (Batch 1 Img 5)',
    validation_status: 'VERIFIED'
  },
  {
    id: 'c12',
    rule_id: 'r1',
    condition_code: 'PA-05',
    name: 'Bullish Marubozu (5m Closed)',
    category: 'PRICE_ACTION',
    indicator: 'CANDLESTICK_PATTERN',
    condition_type: 'TRIGGER',
    operator: 'PATTERN_MATCH',
    threshold_values: { pattern: 'BULLISH_MARUBOZU', direction: 'BUY' },
    instrument: null,
    timeframe: '5m',
    is_required: false,
    enabled: true,
    source_screenshot_ref: '8 Candlestick Patterns #5 (Batch 1 Img 5)',
    validation_status: 'VERIFIED'
  },
  {
    id: 'c13',
    rule_id: 'r1',
    condition_code: 'PA-07',
    name: 'Bullish Engulfing (5m Closed)',
    category: 'PRICE_ACTION',
    indicator: 'CANDLESTICK_PATTERN',
    condition_type: 'TRIGGER',
    operator: 'PATTERN_MATCH',
    threshold_values: { pattern: 'BULLISH_ENGULFING', direction: 'BUY' },
    instrument: null,
    timeframe: '5m',
    is_required: false,
    enabled: true,
    source_screenshot_ref: '8 Candlestick Patterns #7 (Batch 1 Img 5)',
    validation_status: 'VERIFIED'
  },
  // 5m Bearish Candlestick Patterns
  {
    id: 'c14',
    rule_id: 'r1',
    condition_code: 'PA-02',
    name: 'Shooting Star Pattern (5m Closed)',
    category: 'PRICE_ACTION',
    indicator: 'CANDLESTICK_PATTERN',
    condition_type: 'TRIGGER',
    operator: 'PATTERN_MATCH',
    threshold_values: { pattern: 'SHOOTING_STAR', direction: 'SELL', min_wick_ratio: 2.0 },
    instrument: null,
    timeframe: '5m',
    is_required: false,
    enabled: true,
    source_screenshot_ref: '8 Candlestick Patterns #2 (Batch 1 Img 5)',
    validation_status: 'VERIFIED'
  },
  {
    id: 'c15',
    rule_id: 'r1',
    condition_code: 'PA-04',
    name: 'Three Black Crows (5m Closed)',
    category: 'PRICE_ACTION',
    indicator: 'CANDLESTICK_PATTERN',
    condition_type: 'TRIGGER',
    operator: 'PATTERN_MATCH',
    threshold_values: { pattern: 'THREE_BLACK_CROWS', direction: 'SELL' },
    instrument: null,
    timeframe: '5m',
    is_required: false,
    enabled: true,
    source_screenshot_ref: '8 Candlestick Patterns #4 (Batch 1 Img 5)',
    validation_status: 'VERIFIED'
  },
  {
    id: 'c16',
    rule_id: 'r1',
    condition_code: 'PA-06',
    name: 'Bearish Marubozu (5m Closed)',
    category: 'PRICE_ACTION',
    indicator: 'CANDLESTICK_PATTERN',
    condition_type: 'TRIGGER',
    operator: 'PATTERN_MATCH',
    threshold_values: { pattern: 'BEARISH_MARUBOZU', direction: 'SELL' },
    instrument: null,
    timeframe: '5m',
    is_required: false,
    enabled: true,
    source_screenshot_ref: '8 Candlestick Patterns #6 (Batch 1 Img 5)',
    validation_status: 'VERIFIED'
  },
  {
    id: 'c17',
    rule_id: 'r1',
    condition_code: 'PA-08',
    name: 'Bearish Engulfing (5m Closed)',
    category: 'PRICE_ACTION',
    indicator: 'CANDLESTICK_PATTERN',
    condition_type: 'TRIGGER',
    operator: 'PATTERN_MATCH',
    threshold_values: { pattern: 'BEARISH_ENGULFING', direction: 'SELL' },
    instrument: null,
    timeframe: '5m',
    is_required: false,
    enabled: true,
    source_screenshot_ref: '8 Candlestick Patterns #8 (Batch 1 Img 5)',
    validation_status: 'VERIFIED'
  }
];

export const RuleManagement: React.FC = () => {
  const [conditions, setConditions] = useState<TradingCondition[]>(INITIAL_CONDITIONS);
  const [activeCategory, setActiveCategory] = useState<string>('ALL');
  const [cooldownMins, setCooldownMins] = useState<number>(30);
  const [dailyCap, setDailyCap] = useState<number>(4);
  const [cooloffActive, setCooloffActive] = useState<boolean>(false);
  const [saveStatus, setSaveStatus] = useState<string>('');

  useEffect(() => {
    // If Supabase is connected, fetch live conditions
    async function fetchRules() {
      if (!isSupabaseConfigured || !supabase) return;
      try {
        const { data, error } = await supabase.from('trading_conditions').select('*');
        if (!error && data && data.length > 0) {
          setConditions(data as TradingCondition[]);
        }
      } catch (err) {
        console.warn('Using local fallback for trading conditions', err);
      }
    }
    fetchRules();
  }, []);

  const toggleCondition = (id: string) => {
    setConditions(prev => prev.map(c => c.id === id ? { ...c, enabled: !c.enabled } : c));
  };

  const handleSaveAll = async () => {
    setSaveStatus('Saving to Supabase...');
    if (isSupabaseConfigured && supabase) {
      try {
        for (const c of conditions) {
          await supabase.from('trading_conditions').update({ enabled: c.enabled, threshold_values: c.threshold_values }).eq('id', c.id);
        }
        await supabase.from('system_settings').upsert([
          { key: 'cooldown_minutes', value: cooldownMins },
          { key: 'max_daily_signals', value: dailyCap },
          { key: 'risk_pause_active', value: cooloffActive }
        ]);
        setSaveStatus('Saved successfully!');
      } catch (err: any) {
        setSaveStatus('Error saving: ' + err.message);
      }
    } else {
      setTimeout(() => {
        setSaveStatus('Saved locally in browser memory (Supabase keys pending)');
      }, 500);
    }
    setTimeout(() => setSaveStatus(''), 4000);
  };

  const filteredConditions = activeCategory === 'ALL'
    ? conditions
    : conditions.filter(c => c.category === activeCategory);

  return (
    <div className="space-y-6">
      {/* Top Banner / System Controls */}
      <div className="bg-cardBg border border-borderCol rounded-xl p-5 shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-borderCol">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-6 h-6 text-bullGreen" />
              <h2 className="text-xl font-bold text-white tracking-wide">
                Trading Rules & Strategy Configuration
              </h2>
            </div>
            <p className="text-sm text-gray-400 mt-1">
              Strictly evaluated on <span className="text-accentGold font-semibold">5-Minute (5m)</span> closed candles for NIFTY 50 and BANK NIFTY.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSaveAll}
              className="flex items-center gap-2 px-4 py-2 bg-neutralBlue hover:bg-blue-600 text-white rounded-lg font-medium transition text-sm shadow-md"
            >
              <Save className="w-4 h-4" />
              Save Rules
            </button>
          </div>
        </div>

        {saveStatus && (
          <div className="mt-3 p-2 bg-blue-950/60 border border-blue-800 text-blue-200 text-xs rounded-lg">
            {saveStatus}
          </div>
        )}

        {/* Risk & Safety Switches */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
          <div className="bg-darkBg/60 border border-borderCol p-3 rounded-lg flex items-center justify-between">
            <div>
              <span className="text-xs text-gray-400 block font-medium">Post-Loss / Profit Cool-off</span>
              <span className="text-sm font-semibold text-white">
                {cooloffActive ? 'PAUSED (2-Day Gap Active)' : 'Active (Normal Trading)'}
              </span>
            </div>
            <button
              onClick={() => setCooloffActive(!cooloffActive)}
              className={`px-3 py-1 rounded text-xs font-bold transition ${
                cooloffActive ? 'bg-bearRed text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {cooloffActive ? 'Turn Off' : 'Activate Pause'}
            </button>
          </div>

          <div className="bg-darkBg/60 border border-borderCol p-3 rounded-lg flex items-center justify-between">
            <div>
              <span className="text-xs text-gray-400 block font-medium">Signal Cooldown</span>
              <span className="text-sm font-semibold text-white">{cooldownMins} Minutes Gap</span>
            </div>
            <input
              type="number"
              value={cooldownMins}
              onChange={(e) => setCooldownMins(Number(e.target.value))}
              className="w-16 bg-cardBg border border-borderCol text-center text-white text-sm rounded py-1 px-1"
              min={5}
              max={120}
              step={5}
            />
          </div>

          <div className="bg-darkBg/60 border border-borderCol p-3 rounded-lg flex items-center justify-between">
            <div>
              <span className="text-xs text-gray-400 block font-medium">Max Daily Signals</span>
              <span className="text-sm font-semibold text-white">{dailyCap} / Day Cap</span>
            </div>
            <input
              type="number"
              value={dailyCap}
              onChange={(e) => setDailyCap(Number(e.target.value))}
              className="w-16 bg-cardBg border border-borderCol text-center text-white text-sm rounded py-1 px-1"
              min={1}
              max={10}
            />
          </div>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-borderCol pb-2">
        {[
          { key: 'ALL', label: 'All Conditions' },
          { key: 'PRICE_ACTION', label: '5m Candlestick Patterns' },
          { key: 'VOLATILITY', label: 'India VIX Rules' },
          { key: 'MARKET_BREADTH', label: 'Advance / Decline' },
          { key: 'RISK_FILTER', label: 'Risk & Calendar Filters' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveCategory(tab.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              activeCategory === tab.key
                ? 'bg-neutralBlue text-white shadow'
                : 'text-gray-400 hover:text-gray-200 hover:bg-cardBg'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Conditions Table */}
      <div className="bg-cardBg border border-borderCol rounded-xl overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-300">
            <thead className="bg-darkBg text-xs uppercase tracking-wider text-gray-400 border-b border-borderCol">
              <tr>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Code</th>
                <th className="py-3 px-4">Rule Name</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Role / Type</th>
                <th className="py-3 px-4">Timeframe</th>
                <th className="py-3 px-4">Threshold / Spec</th>
                <th className="py-3 px-4">Source Reference</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-borderCol">
              {filteredConditions.map((cond) => {
                const isTrigger = cond.condition_type === 'TRIGGER';
                const isMandatory = cond.condition_type === 'MANDATORY_FILTER';

                return (
                  <tr key={cond.id} className="hover:bg-darkBg/40 transition">
                    <td className="py-3 px-4">
                      <button
                        onClick={() => toggleCondition(cond.id)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition ${
                          cond.enabled
                            ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800'
                            : 'bg-red-950/80 text-red-400 border border-red-800'
                        }`}
                      >
                        {cond.enabled ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5" /> Active
                          </>
                        ) : (
                          <>
                            <XCircle className="w-3.5 h-3.5" /> Inactive
                          </>
                        )}
                      </button>
                    </td>

                    <td className="py-3 px-4 font-mono text-xs font-bold text-gray-200">
                      {cond.condition_code}
                    </td>

                    <td className="py-3 px-4">
                      <div className="font-medium text-white flex items-center gap-2">
                        {cond.name}
                        {cond.threshold_values.direction === 'BUY' && (
                          <span className="text-bullGreen text-[10px] bg-emerald-950 px-1.5 py-0.5 rounded font-bold">
                            BUY
                          </span>
                        )}
                        {cond.threshold_values.direction === 'SELL' && (
                          <span className="text-bearRed text-[10px] bg-red-950 px-1.5 py-0.5 rounded font-bold">
                            SELL
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <span className="text-xs px-2 py-0.5 bg-gray-800 text-gray-300 rounded">
                        {cond.category}
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                        isMandatory
                          ? 'bg-amber-950 text-amber-400 border border-amber-800'
                          : isTrigger
                          ? 'bg-blue-950 text-blue-300 border border-blue-800'
                          : 'bg-gray-800 text-gray-400'
                      }`}>
                        {cond.condition_type}
                      </span>
                    </td>

                    <td className="py-3 px-4 font-mono text-xs text-accentGold font-semibold">
                      {cond.timeframe}
                    </td>

                    <td className="py-3 px-4 font-mono text-xs text-gray-300">
                      {JSON.stringify(cond.threshold_values)}
                    </td>

                    <td className="py-3 px-4 text-xs text-gray-400 max-w-[200px] truncate" title={cond.source_screenshot_ref}>
                      {cond.source_screenshot_ref || 'Verified Screenshot'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
