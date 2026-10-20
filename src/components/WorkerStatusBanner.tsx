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
        return 'bg-emerald-950/80 border-emerald-800 text-emerald-400';
      case 'IDLE_OUTSIDE_HOURS':
        return 'bg-blue-950/80 border-blue-800 text-blue-400';
      case 'BROKER_AUTH_EXPIRED':
        return 'bg-red-950/80 border-red-800 text-red-400 animate-pulse';
      case 'STALE_FEED':
        return 'bg-amber-950/80 border-amber-800 text-amber-400';
      default:
        return 'bg-cardBg border-borderCol text-gray-300';
    }
  };

  const getStatusLabel = (status?: string) => {
    switch (status) {
      case 'RUNNING':
        return '24/7 BACKGROUND WORKER: ACTIVE';
      case 'IDLE_OUTSIDE_HOURS':
        return 'STANDBY: OUTSIDE NSE TRADING HOURS (09:15-15:30 IST)';
      case 'BROKER_AUTH_EXPIRED':
        return 'ALERT: GROWW API TOKEN EXPIRED — SAFE NO_DATA MODE';
      case 'STALE_FEED':
        return 'CAUTION: MARKET DATA FEED STALE';
      default:
        return 'BACKGROUND ENGINE: MONITORING';
    }
  };

  const getRegimeBadge = (regime?: string) => {
    switch (regime) {
      case 'TRENDING_BULL':
        return <span className="px-2 py-0.5 rounded bg-emerald-900/60 text-emerald-300 font-bold border border-emerald-700 text-[10px]">BULLISH TREND ↗</span>;
      case 'TRENDING_BEAR':
        return <span className="px-2 py-0.5 rounded bg-rose-900/60 text-rose-300 font-bold border border-rose-700 text-[10px]">BEARISH TREND ↘</span>;
      case 'VOLATILE_CHOP':
        return <span className="px-2 py-0.5 rounded bg-purple-900/60 text-purple-300 font-bold border border-purple-700 text-[10px]">VOLATILE CHOP ⚡</span>;
      default:
        return <span className="px-2 py-0.5 rounded bg-amber-900/60 text-amber-300 font-bold border border-amber-700 text-[10px]">SIDEWAYS RANGE ↔</span>;
    }
  };

  return (
    <div className={`p-3 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs transition ${getStatusColor(heartbeat?.status)}`}>
      <div className="flex items-center gap-2.5">
        <div className="relative flex items-center justify-center">
          <Activity className="w-4 h-4 text-emerald-400" />
          {heartbeat?.status === 'RUNNING' && (
            <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
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
            Evaluates 5M closed candles unattended • Persists canonical signals to Supabase • Dispatches deduplicated Telegram alerts
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-[10px] sm:text-[11px] text-gray-300 border-t md:border-t-0 border-borderCol/50 pt-2 md:pt-0">
        <div className="flex items-center gap-1.5" title="Last background evaluation cycle">
          <Clock className="w-3.5 h-3.5 text-gray-400" />
          <span>Last 5M Candle: <strong>{heartbeat?.last_candle_ist || 'Live Market'}</strong></span>
        </div>

        <div className="flex items-center gap-1.5" title="Broker API Health">
          <Cpu className="w-3.5 h-3.5 text-gray-400" />
          <span>Broker: <strong>{heartbeat?.broker_status || 'OK'}</strong></span>
        </div>

        <button
          onClick={fetchWorkerStatus}
          disabled={loading}
          className="p-1 hover:bg-white/10 rounded transition"
          title="Refresh Heartbeat"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>
    </div>
  );
};
