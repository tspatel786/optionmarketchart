-- SUPABASE MIGRATION: Automated Live Market Signal Application
-- Timeframe: 5m (Strictly 5-minute candles as specified)
-- Market: NIFTY 50, BANK NIFTY, INDIA VIX
-- Timezone: Asia/Kolkata (09:15 - 15:30 IST)

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. TRADING RULES TABLE
CREATE TABLE IF NOT EXISTS public.trading_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    strategy TEXT NOT NULL DEFAULT 'PRICE_ACTION_PIVOT_5M',
    instrument_scope TEXT[] NOT NULL DEFAULT ARRAY['NIFTY 50', 'BANK NIFTY'],
    timeframe TEXT NOT NULL DEFAULT '5m',
    evaluation_mode TEXT NOT NULL CHECK (evaluation_mode IN ('ALL', 'ANY', 'MINIMUM_MATCH', 'MANDATORY_CONDITIONS')),
    min_match_count INTEGER DEFAULT NULL,
    priority INTEGER DEFAULT 1,
    enabled BOOLEAN NOT NULL DEFAULT true,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- 2. RULE CONDITION GROUPS
CREATE TABLE IF NOT EXISTS public.rule_condition_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_id UUID NOT NULL REFERENCES public.trading_rules(id) ON DELETE CASCADE,
    parent_group_id UUID REFERENCES public.rule_condition_groups(id) ON DELETE CASCADE,
    logical_operator TEXT NOT NULL CHECK (logical_operator IN ('AND', 'OR')),
    group_order INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- 3. TRADING CONDITIONS TABLE
CREATE TABLE IF NOT EXISTS public.trading_conditions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_id UUID NOT NULL REFERENCES public.trading_rules(id) ON DELETE CASCADE,
    group_id UUID REFERENCES public.rule_condition_groups(id) ON DELETE SET NULL,
    condition_code TEXT NOT NULL,
    name TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('PRE_MARKET', 'MARKET_BREADTH', 'VOLATILITY', 'RISK_FILTER', 'PRICE_ACTION', 'LEVELS')),
    indicator TEXT NOT NULL,
    condition_type TEXT NOT NULL CHECK (condition_type IN ('MANDATORY_FILTER', 'BIAS_FILTER', 'TRIGGER', 'CAUTION')),
    operator TEXT NOT NULL CHECK (operator IN ('EQUALS', 'GREATER_THAN', 'LESS_THAN', 'BETWEEN', 'PATTERN_MATCH', 'IN')),
    threshold_values JSONB NOT NULL,
    instrument TEXT,
    timeframe TEXT DEFAULT '5m',
    is_required BOOLEAN NOT NULL DEFAULT false,
    enabled BOOLEAN NOT NULL DEFAULT true,
    source_screenshot_ref TEXT,
    validation_status TEXT NOT NULL DEFAULT 'VERIFIED',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- 4. MARKET CANDLES (5m Closed Candles)
CREATE TABLE IF NOT EXISTS public.market_candles (
    id BIGSERIAL PRIMARY KEY,
    instrument TEXT NOT NULL,
    timeframe TEXT NOT NULL DEFAULT '5m',
    timestamp TIMESTAMPTZ NOT NULL,
    open NUMERIC(12, 2) NOT NULL,
    high NUMERIC(12, 2) NOT NULL,
    low NUMERIC(12, 2) NOT NULL,
    close NUMERIC(12, 2) NOT NULL,
    volume BIGINT DEFAULT 0,
    source_metadata JSONB DEFAULT '{"provider": "AngelOne"}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    CONSTRAINT uq_candle UNIQUE (instrument, timeframe, timestamp)
);

CREATE INDEX IF NOT EXISTS idx_candles_lookup ON public.market_candles (instrument, timeframe, timestamp DESC);

-- 5. MARKET SIGNALS (Canonical Signal Record)
CREATE TABLE IF NOT EXISTS public.market_signals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    instrument TEXT NOT NULL,
    signal_type TEXT NOT NULL CHECK (signal_type IN ('BUY', 'SELL', 'WAIT', 'NO_DATA')),
    candle_timestamp TIMESTAMPTZ NOT NULL,
    rule_id UUID REFERENCES public.trading_rules(id) ON DELETE SET NULL,
    rule_version INTEGER NOT NULL DEFAULT 1,
    deduplication_key TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'INVALIDATED', 'COMPLETED', 'EXPIRED')) DEFAULT 'ACTIVE',
    explanation JSONB NOT NULL,
    data_freshness_timestamp TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_signals_latest ON public.market_signals (instrument, candle_timestamp DESC);

-- 6. SIGNAL LEVELS (Entry, SL, Targets, Pivot)
CREATE TABLE IF NOT EXISTS public.signal_levels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    signal_id UUID NOT NULL REFERENCES public.market_signals(id) ON DELETE CASCADE,
    entry_price NUMERIC(12, 2),
    stop_loss NUMERIC(12, 2),
    target_1 NUMERIC(12, 2),
    target_2 NUMERIC(12, 2),
    pivot_point NUMERIC(12, 2),
    risk_reward_ratio NUMERIC(6, 2),
    invalidation_condition TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- 7. SIGNAL EVALUATION LOGS
CREATE TABLE IF NOT EXISTS public.signal_evaluation_logs (
    id BIGSERIAL PRIMARY KEY,
    evaluation_timestamp TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    instrument TEXT NOT NULL,
    timeframe TEXT NOT NULL DEFAULT '5m',
    candle_timestamp TIMESTAMPTZ NOT NULL,
    decision TEXT NOT NULL CHECK (decision IN ('BUY', 'SELL', 'WAIT', 'NO_DATA')),
    matched_conditions JSONB NOT NULL DEFAULT '[]'::jsonb,
    failed_conditions JSONB NOT NULL DEFAULT '[]'::jsonb,
    missing_data JSONB NOT NULL DEFAULT '[]'::jsonb,
    full_context JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_eval_logs ON public.signal_evaluation_logs (instrument, evaluation_timestamp DESC);

-- 8. NOTIFICATION OUTBOX (Telegram Reliability Queue)
CREATE TABLE IF NOT EXISTS public.notification_outbox (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    signal_id UUID REFERENCES public.market_signals(id) ON DELETE CASCADE,
    channel TEXT NOT NULL DEFAULT 'TELEGRAM',
    message_payload JSONB NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('PENDING', 'SENT', 'FAILED', 'RETRYING')) DEFAULT 'PENDING',
    attempts INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 5,
    next_retry_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    last_error TEXT,
    idempotency_key TEXT NOT NULL UNIQUE,
    delivered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_outbox_queue ON public.notification_outbox (status, next_retry_at) WHERE status IN ('PENDING', 'RETRYING');

-- 9. SYSTEM SETTINGS
CREATE TABLE IF NOT EXISTS public.system_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- 10. ROW LEVEL SECURITY (RLS)
ALTER TABLE public.trading_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rule_condition_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trading_conditions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_candles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signal_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signal_evaluation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Read policies
CREATE POLICY "Allow public read on market_signals" ON public.market_signals FOR SELECT USING (true);
CREATE POLICY "Allow public read on signal_levels" ON public.signal_levels FOR SELECT USING (true);
CREATE POLICY "Allow public read on market_candles" ON public.market_candles FOR SELECT USING (true);
CREATE POLICY "Allow public read on trading_rules" ON public.trading_rules FOR SELECT USING (true);
CREATE POLICY "Allow public read on trading_conditions" ON public.trading_conditions FOR SELECT USING (true);
CREATE POLICY "Allow public read on system_settings" ON public.system_settings FOR SELECT USING (true);

-- Admin modification policies
CREATE POLICY "Allow admin manage trading_rules" ON public.trading_rules FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow admin manage trading_conditions" ON public.trading_conditions FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow admin manage system_settings" ON public.system_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);
