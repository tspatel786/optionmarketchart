import type { EvaluatedSignal } from '../engine/signalEngine';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

export interface TelegramConfig {
  botToken: string;
  chatId: string;
}

export interface OutboxItem {
  id: string;
  signal_id?: string;
  channel: 'TELEGRAM';
  message_payload: {
    text: string;
    parse_mode: 'HTML';
  };
  status: 'PENDING' | 'SENT' | 'FAILED' | 'RETRYING';
  attempts: number;
  max_attempts: number;
  idempotency_key: string;
  last_error?: string | null;
}

export class TelegramService {
  /**
   * Formats a rich, professional Telegram message strictly including all mandatory fields:
   * instrument, signal type, timestamp, entry/SL/targets, strategy, matched conditions,
   * explanation, data freshness timestamp, and "not financial advice" disclaimer.
   */
  public static formatSignalMessage(signal: EvaluatedSignal): string {
    const isBuy = signal.signalType === 'BUY';
    const emoji = isBuy ? '🟢' : '🔴';
    const typeLabel = isBuy ? 'BUY / LONG' : 'SELL / SHORT';

    let levelsText = '';
    if (signal.levels) {
      levelsText = `
<b>📊 Signal Levels (5m Closed Candle):</b>
• <b>Entry:</b> ₹${signal.levels.entryPrice.toFixed(2)}
• <b>Stop Loss:</b> ₹${signal.levels.stopLoss.toFixed(2)}
• <b>Target 1 (R1/S1):</b> ₹${signal.levels.target1.toFixed(2)}
• <b>Target 2 (R2/S2):</b> ₹${signal.levels.target2.toFixed(2)}
• <b>Pivot Level:</b> ₹${signal.levels.pivot.toFixed(2)}
• <b>Risk / Reward:</b> 1:${signal.levels.riskRewardRatio}
• <b>Invalidation:</b> ${signal.levels.invalidation}
`;
    }

    const matchedList = signal.matchedConditions.map(c => `  ✓ ${c}`).join('\n');
    const pattern = signal.explanation.patterns[0]?.patternName || 'Price Action';

    return `
${emoji} <b>MARKET SIGNAL ALERT: ${signal.instrument}</b>
<b>Action:</b> ${typeLabel}
<b>Timeframe:</b> 5-Minute (Closed Candle)
<b>Strategy:</b> PRICE_ACTION_PIVOT_5M
<b>Trigger Pattern:</b> ${pattern}
${levelsText}
<b>📈 Market Context:</b>
• <b>India VIX Status:</b> ${signal.explanation.vixStatus} ${signal.explanation.vixValue ? `(${signal.explanation.vixValue.toFixed(2)})` : ''}
• <b>Candle Time (IST):</b> ${signal.candleDateTimeIST}
• <b>Signal ID:</b> <code>${signal.deduplicationKey}</code>

<b>📋 Matched Conditions:</b>
${matchedList || '  None'}

<b>💡 Decision Rationale:</b>
${signal.explanation.decision}

────────────────────
⚠️ <i>Disclaimer: Analytical signal generated for educational & testing purposes only. Not financial advice.</i>
`.trim();
  }

  /**
   * Directly sends a message using the Telegram Bot API
   */
  public static async sendDirectMessage(
    botToken: string,
    chatId: string,
    text: string
  ): Promise<{ success: boolean; messageId?: number; error?: string }> {
    try {
      const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: text,
          parse_mode: 'HTML',
          disable_web_page_preview: true,
        }),
      });

      const resData = await response.json();
      if (resData.ok) {
        return { success: true, messageId: resData.result.message_id };
      } else {
        return { success: false, error: resData.description || 'Telegram API error' };
      }
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error reaching Telegram' };
    }
  }

  /**
   * Enqueues a signal into notification_outbox with an Idempotency Key
   * Guarantees single canonical delivery, prevent duplicate messages.
   */
  public static async queueNotification(
    signal: EvaluatedSignal,
    config?: TelegramConfig
  ): Promise<{ queued: boolean; error?: string }> {
    const formattedText = this.formatSignalMessage(signal);
    const idempotencyKey = `TG_${signal.deduplicationKey}`;

    // If Supabase is connected, queue in notification_outbox table
    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase.from('notification_outbox').insert({
          channel: 'TELEGRAM',
          message_payload: { text: formattedText, parse_mode: 'HTML' },
          status: 'PENDING',
          attempts: 0,
          max_attempts: 5,
          idempotency_key: idempotencyKey,
        });

        if (error) {
          // If already exists (duplicate key error), skip duplicate delivery gracefully
          if (error.code === '23505') {
            console.log('Notification already queued for key:', idempotencyKey);
            return { queued: true };
          }
          throw error;
        }

        // Trigger immediate delivery if bot token is provided
        if (config?.botToken && config?.chatId) {
          await this.processOutboxItem(idempotencyKey, config);
        }

        return { queued: true };
      } catch (err: any) {
        console.error('Failed to queue in Supabase outbox:', err);
      }
    }

    // Direct delivery fallback if running locally
    if (config?.botToken && config?.chatId) {
      const directRes = await this.sendDirectMessage(config.botToken, config.chatId, formattedText);
      return { queued: directRes.success, error: directRes.error };
    }

    return { queued: false, error: 'Telegram bot token and chat ID not configured' };
  }

  /**
   * Delivers an outbox item and updates its status in Supabase (SENT, RETRYING, FAILED)
   */
  public static async processOutboxItem(
    idempotencyKey: string,
    config: TelegramConfig
  ): Promise<void> {
    if (!isSupabaseConfigured || !supabase) return;

    try {
      const { data: item } = await supabase
        .from('notification_outbox')
        .select('*')
        .eq('idempotency_key', idempotencyKey)
        .single();

      if (!item || item.status === 'SENT') return;

      const res = await this.sendDirectMessage(
        config.botToken,
        config.chatId,
        item.message_payload.text
      );

      if (res.success) {
        await supabase
          .from('notification_outbox')
          .update({
            status: 'SENT',
            delivered_at: new Date().toISOString(),
            last_error: null,
          })
          .eq('id', item.id);
      } else {
        const nextAttempts = item.attempts + 1;
        const isFailed = nextAttempts >= item.max_attempts;
        // Exponential backoff: 30s, 60s, 120s, 240s...
        const backoffSeconds = Math.pow(2, nextAttempts) * 15;
        const nextRetry = new Date(Date.now() + backoffSeconds * 1000).toISOString();

        await supabase
          .from('notification_outbox')
          .update({
            status: isFailed ? 'FAILED' : 'RETRYING',
            attempts: nextAttempts,
            last_error: res.error,
            next_retry_at: nextRetry,
          })
          .eq('id', item.id);
      }
    } catch (err) {
      console.error('Error processing outbox item:', err);
    }
  }

  /**
   * Sends System Health & Alert Notifications (Worker Down, Stale Data, Broker Login Failed)
   */
  public static async sendSystemAlert(
    alertType: 'STALE_DATA' | 'BROKER_LOGIN_FAILED' | 'WORKER_DOWN' | 'INFO',
    details: string,
    config: TelegramConfig
  ): Promise<{ success: boolean; error?: string }> {
    if (!config.botToken || !config.chatId) {
      return { success: false, error: 'Telegram credentials missing' };
    }

    const titleMap = {
      STALE_DATA: '⚠️ SYSTEM ALERT: Stale Market Data Detected',
      BROKER_LOGIN_FAILED: '🚨 SYSTEM ALERT: Broker API Session Expired / Failed',
      WORKER_DOWN: '🔴 SYSTEM ALERT: Background Signal Worker Down',
      INFO: 'ℹ️ SYSTEM NOTICE',
    };

    const text = `
${titleMap[alertType] || '⚠️ SYSTEM ALERT'}

<b>Time (IST):</b> ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
<b>Details:</b>
${details}

────────────────────
<i>Automated System Alert • Market Signal Engine</i>
`.trim();

    return this.sendDirectMessage(config.botToken, config.chatId, text);
  }
}
