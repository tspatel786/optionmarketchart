-- SUPABASE MIGRATION: Autonomous Market Signal & Paper-Trading Platform
-- Extends initial schema with worker heartbeats, strategy performances, and paper trades.
-- Timezone: Asia/Kolkata (09:15 - 15:30 IST)

-- 1. EXTEND MARKET SIGNALS TYPE CONSTRAINT
-- Allow canonical signal types: 'BUY', 'SELL', 'BUY CE', 'BUY PE', 'WAIT', 'NO TRADE', 'NO_DATA'
ALTER TABLE public.market_signals DROP CONSTRAINT IF EXISTS market_signals_signal_type_check;
ALTER TABLE public.market_signals ADD CONSTRAINT market_signals_signal_type_check 
    CHECK (signal_type IN ('BUY', 'SELL', 'BUY CE', 'BUY PE', 'WAIT', 'NO TRADE', 'NO_DATA'));

-- 2. WORKER HEARTBEATS TABLE
CREATE TABLE IF NOT EXISTS public.worker_heartbeats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    worker_id TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL CHECK (status IN ('RUNNING', 'IDLE_OUTSIDE_HOURS', 'STALE_FEED', 'BROKER_AUTH_EXPIRED', 'ERROR', 'STOPPED')),
    last_heartbeat TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    last_candle_timestamp TIMESTAMPTZ,
    last_candle_ist TEXT,
    current_regime TEXT DEFAULT 'UNKNOWN',
    active_instrument TEXT DEFAULT 'NIFTY 50',
    broker_status TEXT DEFAULT 'OK',
    memory_usage_mb NUMERIC(8, 2),
    uptime_seconds BIGINT DEFAULT 0,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_worker_heartbeats_status ON public.worker_heartbeats (status, last_heartbeat DESC);

-- 3. STRATEGY PERFORMANCES TABLE
CREATE TABLE IF NOT EXISTS public.strategy_performances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    strategy_id INTEGER NOT NULL UNIQUE,
    strategy_name TEXT NOT NULL,
    category TEXT NOT NULL,
    sample_size INTEGER NOT NULL DEFAULT 0,
    gross_win_rate NUMERIC(6, 2) NOT NULL DEFAULT 0.00,
    net_win_rate NUMERIC(6, 2) NOT NULL DEFAULT 0.00,
    profit_factor NUMERIC(6, 2) NOT NULL DEFAULT 0.00,
    max_drawdown_percent NUMERIC(6, 2) NOT NULL DEFAULT 0.00,
    total_trades INTEGER NOT NULL DEFAULT 0,
    winning_trades INTEGER NOT NULL DEFAULT 0,
    losing_trades INTEGER NOT NULL DEFAULT 0,
    net_expectancy_points NUMERIC(8, 2) NOT NULL DEFAULT 0.00,
    validation_status TEXT NOT NULL CHECK (validation_status IN ('VERIFIED', 'UNVERIFIED', 'DISABLED')) DEFAULT 'UNVERIFIED',
    test_period_start TIMESTAMPTZ,
    test_period_end TIMESTAMPTZ,
    cost_model_applied JSONB DEFAULT '{"brokeragePerOrder": 20, "slippagePoints": 0.5, "turnoverTaxesPct": 0.05}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_strategy_perf_status ON public.strategy_performances (validation_status, net_win_rate DESC);

-- 4. FORWARD PAPER TRADES TABLE (Tracking hypothetical trades with 0 real orders)
CREATE TABLE IF NOT EXISTS public.paper_trades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    signal_id UUID REFERENCES public.market_signals(id) ON DELETE SET NULL,
    instrument TEXT NOT NULL,
    contract_symbol TEXT,
    action TEXT NOT NULL CHECK (action IN ('BUY_CE', 'BUY_PE', 'BUY', 'SELL')),
    entry_time TIMESTAMPTZ NOT NULL,
    entry_price NUMERIC(12, 2) NOT NULL,
    stop_loss NUMERIC(12, 2) NOT NULL,
    target_1 NUMERIC(12, 2) NOT NULL,
    target_2 NUMERIC(12, 2) NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 50, -- 1 lot Nifty (50) or BankNifty (15)
    exit_time TIMESTAMPTZ,
    exit_price NUMERIC(12, 2),
    outcome TEXT CHECK (outcome IN ('WIN_T1', 'WIN_T2', 'LOSS_SL', 'EXPIRED_EOD', 'INVALIDATED', 'OPEN')) DEFAULT 'OPEN',
    pnl_points NUMERIC(10, 2) DEFAULT 0.00,
    gross_pnl_inr NUMERIC(12, 2) DEFAULT 0.00,
    net_pnl_inr NUMERIC(12, 2) DEFAULT 0.00,
    status TEXT NOT NULL CHECK (status IN ('OPEN', 'CLOSED', 'CANCELLED')) DEFAULT 'OPEN',
    strategy_id INTEGER,
    strategy_name TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_paper_trades_status ON public.paper_trades (status, entry_time DESC);
CREATE INDEX IF NOT EXISTS idx_paper_trades_instrument ON public.paper_trades (instrument, entry_time DESC);

-- 5. ROW LEVEL SECURITY (RLS) FOR NEW TABLES
ALTER TABLE public.worker_heartbeats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.strategy_performances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.paper_trades ENABLE ROW LEVEL SECURITY;

-- Public select policies so the dashboard portal can read status
CREATE POLICY "Allow public read on worker_heartbeats" ON public.worker_heartbeats FOR SELECT USING (true);
CREATE POLICY "Allow public read on strategy_performances" ON public.strategy_performances FOR SELECT USING (true);
CREATE POLICY "Allow public read on paper_trades" ON public.paper_trades FOR SELECT USING (true);

-- Authenticated and Service Role write policies
CREATE POLICY "Allow service role manage worker_heartbeats" ON public.worker_heartbeats FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow service role manage strategy_performances" ON public.strategy_performances FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow service role manage paper_trades" ON public.paper_trades FOR ALL USING (true) WITH CHECK (true);
