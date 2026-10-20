export type Timeframe = '5m' | '15m' | '1D';

export type EvaluationMode = 'ALL' | 'ANY' | 'MINIMUM_MATCH' | 'MANDATORY_CONDITIONS';

export type ConditionCategory = 
  | 'PRE_MARKET' 
  | 'MARKET_BREADTH' 
  | 'VOLATILITY' 
  | 'RISK_FILTER' 
  | 'PRICE_ACTION' 
  | 'LEVELS';

export type ConditionType = 'MANDATORY_FILTER' | 'BIAS_FILTER' | 'TRIGGER' | 'CAUTION';

export type ConditionOperator = 
  | 'EQUALS' 
  | 'GREATER_THAN' 
  | 'LESS_THAN' 
  | 'BETWEEN' 
  | 'PATTERN_MATCH' 
  | 'IN';

export interface TradingRule {
  id: string;
  name: string;
  description?: string;
  strategy: string;
  instrument_scope: string[];
  timeframe: Timeframe;
  evaluation_mode: EvaluationMode;
  min_match_count?: number | null;
  priority: number;
  enabled: boolean;
  version: number;
  created_at?: string;
  updated_at?: string;
}

export interface TradingCondition {
  id: string;
  rule_id: string;
  group_id?: string | null;
  condition_code: string;
  name: string;
  category: ConditionCategory;
  indicator: string;
  condition_type: ConditionType;
  operator: ConditionOperator;
  threshold_values: Record<string, any>;
  instrument?: string | null;
  timeframe: Timeframe;
  is_required: boolean;
  enabled: boolean;
  source_screenshot_ref?: string;
  validation_status: 'VERIFIED' | 'NEEDS_CLARIFICATION' | 'REJECTED';
}

export interface SystemSetting {
  key: string;
  value: any;
  description?: string;
  updated_at?: string;
}
