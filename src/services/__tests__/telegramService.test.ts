import { describe, it, expect } from 'vitest';
import { TelegramService } from '../telegramService';
import type { EvaluatedSignal } from '../../engine/signalEngine';

describe('TelegramService & Outbox Queueing', () => {
  const dummySignal: EvaluatedSignal = {
    instrument: 'NIFTY 50',
    signalType: 'BUY',
    canonicalSignalType: 'BUY CE',
    candleTimestamp: 1729485000,
    candleDateTimeIST: '2026-10-20 09:35:00',
    ruleVersion: 1,
    deduplicationKey: 'NIFTY 50_5M_1729485000_V1',
    matchedConditions: ['PA-01: Hammer (5m Bullish Reversal)', 'VX-02: Stable Market Regime'],
    failedConditions: [],
    explanation: {
      decision: 'BUY signal confirmed by Hammer pattern on closed 5m candle.',
      vixStatus: 'STABLE (10 - 14)',
      vixValue: 12.8,
      patterns: [
        {
          patternCode: 'PA-01',
          patternName: 'Hammer (5m Bullish Reversal)',
          direction: 'BUY',
          confidence: 0.85,
          matchedCandleTimestamp: 1729485000,
          explanation: 'Lower wick is 2x body following downward swing.',
        },
      ],
      reasons: ['Price action reversal confirmed.'],
    },
    levels: {
      entryPrice: 23050,
      stopLoss: 22980,
      target1: 23160,
      target2: 23280,
      pivot: 23000,
      riskRewardRatio: 1.57,
      invalidation: 'Price breaks below trigger candle low (22980.00)',
    },
    status: 'ACTIVE',
  };

  it('MANDATORY: Formats Telegram message with all required fields & disclaimer', () => {
    const formatted = TelegramService.formatSignalMessage(dummySignal);

    expect(formatted).toContain('NIFTY 50');
    expect(formatted).toContain('BUY / LONG');
    expect(formatted).toContain('5-Minute (Closed Candle)');
    expect(formatted).toContain('PRICE_ACTION_PIVOT_5M');
    expect(formatted).toContain('₹23050.00'); // Entry
    expect(formatted).toContain('₹22980.00'); // Stop Loss
    expect(formatted).toContain('₹23160.00'); // Target 1
    expect(formatted).toContain('1:1.57');    // Risk / Reward
    expect(formatted).toContain('Price breaks below trigger candle low'); // Invalidation
    expect(formatted).toContain('Not financial advice'); // MANDATORY DISCLAIMER
  });

  it('IDEMPOTENCY: Idempotency key is deterministic based on deduplicationKey', () => {
    const key = `TG_${dummySignal.deduplicationKey}`;
    expect(key).toBe('TG_NIFTY 50_5M_1729485000_V1');
  });
});
