-- SUPABASE SEED DATA: Pre-populating verified trading rules and conditions from user screenshots
-- Timeframe: 5m

INSERT INTO public.trading_rules (id, name, description, strategy, instrument_scope, timeframe, evaluation_mode, min_match_count, priority, enabled, version)
VALUES (
    'a0000000-0000-0000-0000-000000000001',
    'NIFTY 50 & BANK NIFTY 5-Minute Price Action & Pivot Strategy',
    'Evaluates 5m closed candles on NIFTY 50 and BANK NIFTY with India VIX, Market Breadth, and Pivot Levels.',
    'PRICE_ACTION_PIVOT_5M',
    ARRAY['NIFTY 50', 'BANK NIFTY'],
    '5m',
    'MANDATORY_CONDITIONS',
    NULL,
    1,
    true,
    1
) ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    timeframe = EXCLUDED.timeframe,
    evaluation_mode = EXCLUDED.evaluation_mode;

-- Insert Groups
INSERT INTO public.rule_condition_groups (id, rule_id, parent_group_id, logical_operator, group_order)
VALUES 
    ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', NULL, 'AND', 1), -- Mandatory Filters Group
    ('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', NULL, 'OR', 2)   -- Trigger Patterns Group
ON CONFLICT (id) DO NOTHING;

-- Insert All Conditions from Inventory (Timeframe: 5m)
INSERT INTO public.trading_conditions (
    id, rule_id, group_id, condition_code, name, category, indicator, 
    condition_type, operator, threshold_values, instrument, timeframe, is_required, enabled, source_screenshot_ref
) VALUES
    -- 1. Risk & Volatility Filters
    ('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001',
     'VX-01', 'India VIX Below 10 (Sideways No-Trade)', 'VOLATILITY', 'INDIA_VIX',
     'MANDATORY_FILTER', 'GREATER_THAN', '{"min": 10.0}'::jsonb, 'INDIA VIX', '5m', true, true, 'batch1_img2'),

    ('c0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001',
     'RF-01', 'Friday Sideways / Weekend Hedging Caution', 'RISK_FILTER', 'CALENDAR',
     'CAUTION', 'EQUALS', '{"day": "Friday"}'::jsonb, NULL, '5m', false, true, 'batch1_img2'),

    ('c0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001',
     'RF-02', 'Consecutive Trend Days Exhaustion Filter', 'RISK_FILTER', 'TREND_FATIGUE',
     'CAUTION', 'LESS_THAN', '{"max_consecutive_days": 4}'::jsonb, NULL, '1D', false, true, 'batch1_img2'),

    ('c0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001',
     'RF-03', 'Post Big Loss 2-Day Cool-off Gap', 'RISK_FILTER', 'ACCOUNT_RISK',
     'MANDATORY_FILTER', 'EQUALS', '{"cooldown_active": false}'::jsonb, NULL, '1D', true, true, 'batch1_img2'),

    ('c0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001',
     'RF-04', 'Post Big Profit 1-Day Cool-off Gap', 'RISK_FILTER', 'ACCOUNT_RISK',
     'MANDATORY_FILTER', 'EQUALS', '{"cooldown_active": false}'::jsonb, NULL, '1D', true, true, 'batch1_img2'),

    -- 2. Market Breadth & Volatility Bias
    ('c0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000001', NULL,
     'MB-01', 'Advances > Declines (Bullish Breadth Bias)', 'MARKET_BREADTH', 'ADVANCES_DECLINES',
     'BIAS_FILTER', 'GREATER_THAN', '{"ratio": 1.0}'::jsonb, 'NSE', '5m', false, true, 'batch1_img1'),

    ('c0000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000001', NULL,
     'MB-02', 'Declines > Advances (Bearish Breadth Bias)', 'MARKET_BREADTH', 'ADVANCES_DECLINES',
     'BIAS_FILTER', 'GREATER_THAN', '{"ratio": 1.0}'::jsonb, 'NSE', '5m', false, true, 'batch1_img1'),

    ('c0000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000001', NULL,
     'VX-02', 'India VIX Stable Regime (10 - 14/15)', 'VOLATILITY', 'INDIA_VIX',
     'BIAS_FILTER', 'BETWEEN', '{"min": 10.0, "max": 15.0}'::jsonb, 'INDIA VIX', '5m', false, true, 'batch1_img4'),

    ('c0000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000001', NULL,
     'VX-03', 'India VIX High Volatility Move (>= 14/15)', 'VOLATILITY', 'INDIA_VIX',
     'BIAS_FILTER', 'GREATER_THAN', '{"min": 14.5}'::jsonb, 'INDIA VIX', '5m', false, true, 'batch1_img4'),

    -- 3. 5-Minute Candlestick Trigger Patterns (Bullish)
    ('c0000000-0000-0000-0000-000000000010', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002',
     'PA-01', 'Hammer (5m Bullish Reversal)', 'PRICE_ACTION', 'CANDLESTICK_PATTERN',
     'TRIGGER', 'PATTERN_MATCH', '{"pattern": "HAMMER", "direction": "BUY"}'::jsonb, NULL, '5m', false, true, 'batch1_img5'),

    ('c0000000-0000-0000-0000-000000000011', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002',
     'PA-03', 'Three White Soldiers (5m Bullish Reversal)', 'PRICE_ACTION', 'CANDLESTICK_PATTERN',
     'TRIGGER', 'PATTERN_MATCH', '{"pattern": "THREE_WHITE_SOLDIERS", "direction": "BUY"}'::jsonb, NULL, '5m', false, true, 'batch1_img5'),

    ('c0000000-0000-0000-0000-000000000012', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002',
     'PA-05', 'Bullish Marubozu (5m Strong Bullish)', 'PRICE_ACTION', 'CANDLESTICK_PATTERN',
     'TRIGGER', 'PATTERN_MATCH', '{"pattern": "BULLISH_MARUBOZU", "direction": "BUY"}'::jsonb, NULL, '5m', false, true, 'batch1_img5'),

    ('c0000000-0000-0000-0000-000000000013', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002',
     'PA-07', 'Bullish Engulfing (5m Bullish Reversal)', 'PRICE_ACTION', 'CANDLESTICK_PATTERN',
     'TRIGGER', 'PATTERN_MATCH', '{"pattern": "BULLISH_ENGULFING", "direction": "BUY"}'::jsonb, NULL, '5m', false, true, 'batch1_img5'),

    -- 4. 5-Minute Candlestick Trigger Patterns (Bearish)
    ('c0000000-0000-0000-0000-000000000014', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002',
     'PA-02', 'Shooting Star (5m Bearish Reversal)', 'PRICE_ACTION', 'CANDLESTICK_PATTERN',
     'TRIGGER', 'PATTERN_MATCH', '{"pattern": "SHOOTING_STAR", "direction": "SELL"}'::jsonb, NULL, '5m', false, true, 'batch1_img5'),

    ('c0000000-0000-0000-0000-000000000015', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002',
     'PA-04', 'Three Black Crows (5m Bearish Reversal)', 'PRICE_ACTION', 'CANDLESTICK_PATTERN',
     'TRIGGER', 'PATTERN_MATCH', '{"pattern": "THREE_BLACK_CROWS", "direction": "SELL"}'::jsonb, NULL, '5m', false, true, 'batch1_img5'),

    ('c0000000-0000-0000-0000-000000000016', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002',
     'PA-06', 'Bearish Marubozu (5m Strong Bearish)', 'PRICE_ACTION', 'CANDLESTICK_PATTERN',
     'TRIGGER', 'PATTERN_MATCH', '{"pattern": "BEARISH_MARUBOZU", "direction": "SELL"}'::jsonb, NULL, '5m', false, true, 'batch1_img5'),

    ('c0000000-0000-0000-0000-000000000017', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002',
     'PA-08', 'Bearish Engulfing (5m Bearish Reversal)', 'PRICE_ACTION', 'CANDLESTICK_PATTERN',
     'TRIGGER', 'PATTERN_MATCH', '{"pattern": "BEARISH_ENGULFING", "direction": "SELL"}'::jsonb, NULL, '5m', false, true, 'batch1_img5')

ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    timeframe = EXCLUDED.timeframe,
    threshold_values = EXCLUDED.threshold_values,
    enabled = EXCLUDED.enabled;
