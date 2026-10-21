import React, { useState, useEffect } from 'react';
import { Activity, ShieldAlert, CheckCircle2, Clock, Cpu, RefreshCw, AlertCircle } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

export interface WorkerHeartbeatData {
  status: 'RUNNING' | 'IDLE_OUTSIDE_HOURS' | 'STALE_FEED' | 'BROKER_AUTH_EXPIRED' | 'ERROR' | 'STOPPED';
  last_heartbeat: string;
  last_candle_ist?: string;
  current_regime?: string;
  broker_status?: string;
  memory_usage_mb?: number;
  uptime_seconds?: number;
}

export const WorkerStatusBanner: React.FC = () => {
  const [heartbeat, setHeartbeat] = useState<WorkerHeartbeatData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchWorkerStatus = async () => {
    // 1. Try fetching from /healthz or /api/status if on the same server
    try {
      const res = await fetch('/api/status', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setHeartbeat({
          status: data.status,
          last_heartbeat: data.lastHeartbeatIST,
          last_candle_ist: data.lastCandleIST,
          current_regime: data.currentRegime,
          broker_status: data.brokerStatus,
          memory_usage_mb: data.memoryUsageMb,
          uptime_seconds: data.uptimeSeconds,
        });
        setLoading(false);
        return;
      }
    } catch {
      // Fallback to Supabase worker_heartbeats table
    }

    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('worker_heartbeats')
          .select('*')
          .order('last_heartbeat', { ascending: false })
          .limit(1)
          .single();

        if (!error && data) {
          setHeartbeat(data as WorkerHeartbeatData);
        }
      } catch {
        // Heartbeat table may still be migrating
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchWorkerStatus();
    const interval = setInterval(fetchWorkerStatus, 15000); // Polling every 15s
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'RUNNING':
        return 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300';
      case 'IDLE_OUTSIDE_HOURS':
        return 'bg-blue-950/40 border-cyan-800/60 text-cyan-300';
      case 'BROKER_AUTH_EXPIRED':
        return 'bg-rose-950/40 border-rose-800/60 text-rose-300 animate-pulse';
      case 'STALE_FEED':
        return 'bg-amber-950/40 border-amber-800/60 text-amber-300';
      default:
        return 'bg-[#0d1424]/90 border-gray-800/80 text-gray-300';
    }
  };

  const getStatusLabel = (status?: string) => {
    switch (status) {
      case 'RUNNING':
        return '24/7 BACKGROUND WORKER: ACTIVE';
      case 'IDLE_OUTSIDE_HOURS':
        return 'STANDBY: OUTSIDE NSE TRADING HOURS (09:15-15:30 IST)';
      case 'BROKER_AUTH_EXPIRED':
        return 'ALERT: BROKER TOKEN EXPIRED — SAFE NO_DATA MODE';
      case 'STALE_FEED':
        return 'CAUTION: MARKET DATA FEED STALE';
      default:
        return 'BACKGROUND ENGINE: 24/7 MONITORING';
    }
  };

  const getRegimeBadge = (regime?: string) => {
    switch (regime) {
      case 'TRENDING_BULL':
        return <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 font-bold border border-emerald-800 text-[10px]">BULLISH TREND ↗</span>;
      case 'TRENDING_BEAR':
        return <span className="px-2 py-0.5 rounded bg-rose-950 text-rose-400 font-bold border border-rose-800 text-[10px]">BEARISH TREND ↘</span>;
      case 'VOLATILE_CHOP':
        return <span className="px-2 py-0.5 rounded bg-purple-950 text-purple-300 font-bold border border-purple-800 text-[10px]">VOLATILE CHOP ⚡</span>;
      default:
        return <span className="px-2 py-0.5 rounded bg-amber-950 text-amber-300 font-bold border border-amber-800 text-[10px]">SIDEWAYS RANGE ↔</span>;
    }
  };

  return (
    <div className={`p-3 sm:p-3.5 rounded-2xl border flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs shadow-lg transition ${getStatusColor(heartbeat?.status)}`}>
      <div className="flex items-center gap-2.5">
        <div className="relative flex items-center justify-center">
          <Activity className="w-4 h-4 text-cyan-400" />
          {heartbeat?.status === 'RUNNING' && (
            <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
          )}
        </div>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold tracking-wide uppercase text-[11px] sm:text-xs">
              {getStatusLabel(heartbeat?.status)}
            </span>
            {getRegimeBadge(heartbeat?.current_regime)}
          </div>
          <p className="text-[10px] text-gray-400 mt-0.5">
            5M closed candles • Multi-timeframe pattern detection • Deduplicated Telegram alerts
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-[10px] sm:text-[11px] text-gray-300 border-t md:border-t-0 border-gray-800/80 pt-2 md:pt-0">
        <div className="flex items-center gap-1.5" title="Last background evaluation cycle">
          <Clock className="w-3.5 h-3.5 text-gray-400" />
          <span>Last 5M Candle: <strong className="text-white">{heartbeat?.last_candle_ist || 'Live Feed'}</strong></span>
        </div>

        <div className="flex items-center gap-1.5" title="Broker API Health">
          <Cpu className="w-3.5 h-3.5 text-gray-400" />
          <span>Broker: <strong className="text-emerald-400">{heartbeat?.broker_status || 'Angel One (T134200)'}</strong></span>
        </div>

        <button
          onClick={fetchWorkerStatus}
          disabled={loading}
          className="p-1 hover:bg-white/10 rounded-lg transition active:scale-95"
          title="Refresh Heartbeat"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
        </button>
      </div>
    </div>
  );
};
