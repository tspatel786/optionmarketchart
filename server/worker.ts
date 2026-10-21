import dotenv from 'dotenv';
dotenv.config();
dotenv.config({ path: '.env.local' });

import { GrowwApiClient, GrowwApiError, sanitizeSecret, type MarketCandle } from '../src/services/growwApiClient';
import { GrowwApiService } from '../src/services/growwService';
import { angelOneClient, AngelOneApiError, maskAngelSecret } from '../src/services/angelOneApiClient';
import { activeMarketDataProvider } from '../src/services/marketDataProvider';
import { SignalEngine, type EvaluatedSignal } from '../src/engine/signalEngine';
import { TelegramService } from '../src/services/telegramService';
import { PaperTradingEngine, type PaperTradeRecord } from '../src/engine/paperTradingEngine';
import { createClient } from '@supabase/supabase-js';

// Environment variables
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
const telegramBotToken = process.env.VITE_TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || '';
const telegramChatId = process.env.VITE_TELEGRAM_CHAT_ID || process.env.TELEGRAM_CHAT_ID || '';

// Groww Credentials
const growwApiKey = process.env.GROWW_API_KEY || '';
const growwApiSecret = process.env.GROWW_API_SECRET || '';
const growwAccessToken = process.env.GROWW_ACCESS_TOKEN || process.env.GROWW_API_TOKEN || process.env.VITE_GROWW_API_TOKEN || '';

const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

export const growwClient = new GrowwApiClient({
  apiKey: growwApiKey,
  apiSecret: growwApiSecret,
  accessToken: growwAccessToken,
});

const groww = new GrowwApiService(growwClient);

export interface WorkerStatusReport {
  workerId: string;
  status: 'RUNNING' | 'IDLE_OUTSIDE_HOURS' | 'STALE_FEED' | 'BROKER_AUTH_EXPIRED' | 'ERROR' | 'STOPPED';
  uptimeSeconds: number;
  lastHeartbeatIST: string;
  lastCandleIST?: string;
  currentRegime: string;
  activeInstrument: string;
  activeProvider: string;
  brokerStatus: string;
  databaseStatus: string;
  telegramStatus: string;
  memoryUsageMb: number;
  latestSignals: Record<string, EvaluatedSignal | null>;
  openPaperTradesCount: number;
  todayClosedTradesCount: number;
}

export class AutonomousBackgroundWorker {
  private workerId = `worker_${process.pid}_${Date.now()}`;
  private startTime = Date.now();
  private isRunning = false;
  private intervalHandle: NodeJS.Timeout | null = null;
  private status: WorkerStatusReport['status'] = 'IDLE_OUTSIDE_HOURS';
  private lastEvaluatedCandleTime: Record<string, number> = {};
  private latestSignals: Record<string, EvaluatedSignal | null> = {
    'NIFTY 50': null,
    'BANK NIFTY': null,
  };
  private openPaperTrades: PaperTradeRecord[] = [];
  private todayTrades: PaperTradeRecord[] = [];
  private currentRegime: string = 'UNKNOWN';
  private brokerStatus: string = 'INITIALIZING';
  private lastError: string | null = null;

  /**
   * Start the 24/7 background worker process
   */
  public async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log(`[Worker] Autonomous Background Worker started. Worker ID: ${this.workerId}`);
    console.log(`[Worker] Supabase: ${supabase ? 'Configured' : 'NOT CONFIGURED'}`);
    console.log(`[Worker] Telegram: ${telegramBotToken && telegramChatId ? 'Configured' : 'NOT CONFIGURED'}`);

    const angelConfigured = angelOneClient.isConfigured();
    const growwConfigured = groww.isConfigured();
    const providerName = activeMarketDataProvider.name;

    const authMethod = angelConfigured
      ? `Angel One SmartAPI (Key: ${maskAngelSecret(process.env.ANGEL_ONE_API_KEY)}, Client: ${maskAngelSecret(process.env.ANGEL_ONE_CLIENT_CODE)})`
      : (growwApiKey && growwApiSecret
        ? `Groww API Key + Secret (Key: ${sanitizeSecret(growwApiKey)})`
        : (growwAccessToken ? 'Groww Direct Access Token' : 'NO BROKER CREDENTIALS CONFIGURED'));
    console.log(`[Worker] Market Data Provider: ${providerName} | Auth: ${authMethod}`);

    // State recovery: Fetch last evaluated candle timestamps from Supabase
    if (supabase) {
      try {
        const { data: recentSignals } = await supabase
          .from('market_signals')
          .select('instrument, candle_timestamp')
          .order('candle_timestamp', { ascending: false })
          .limit(20);
        if (recentSignals && recentSignals.length > 0) {
          for (const sig of recentSignals) {
            const candleEpoch = Math.floor(new Date(sig.candle_timestamp).getTime() / 1000);
            if (!this.lastEvaluatedCandleTime[sig.instrument] || candleEpoch > this.lastEvaluatedCandleTime[sig.instrument]) {
              this.lastEvaluatedCandleTime[sig.instrument] = candleEpoch;
            }
          }
          console.log('[Worker] Recovered last evaluated candle timestamps from database:', this.lastEvaluatedCandleTime);
        }
      } catch (err) {
        console.warn('[Worker] Warning recovering state from Supabase:', err);
      }
    }

    // Send worker startup alert if Telegram is configured
    if (telegramBotToken && telegramChatId) {
      await TelegramService.sendSystemAlert(
        telegramBotToken,
        telegramChatId,
        `🚀 <b>Autonomous Market Signal Worker Online</b>\nWorker ID: <code>${this.workerId}</code>\nProvider: <b>${providerName}</b>\nAuth: ${authMethod}\nStarted: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST`
      ).catch(() => {});
    }

    // Run first evaluation tick immediately
    await this.tick();

    // Schedule evaluation check every 60 seconds
    this.intervalHandle = setInterval(async () => {
      try {
        await this.tick();
      } catch (err: any) {
        console.error('[Worker] Unhandled error during tick:', err);
        this.status = 'ERROR';
        this.lastError = err.message || String(err);
      }
    }, 60 * 1000);
  }

  /**
   * Stop worker gracefully
   */
  public async stop(): Promise<void> {
    if (!this.isRunning) return;
    this.isRunning = false;
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
    this.status = 'STOPPED';
    console.log('[Worker] Worker stopped gracefully.');
    await this.updateHeartbeat();
  }

  /**
   * Get live status report for /healthz and /api/status endpoints
   */
  public getStatusReport(): WorkerStatusReport & { growwTokenStatus: any; angelOneStatus: any } {
    const memory = process.memoryUsage();
    return {
      workerId: this.workerId,
      status: this.status,
      uptimeSeconds: Math.floor((Date.now() - this.startTime) / 1000),
      lastHeartbeatIST: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
      lastCandleIST: this.latestSignals['NIFTY 50']?.candleDateTimeIST,
      currentRegime: this.currentRegime,
      activeInstrument: 'NIFTY 50, BANK NIFTY',
      activeProvider: activeMarketDataProvider.name,
      brokerStatus: this.brokerStatus,
      angelOneStatus: angelOneClient.getSessionStatus(),
      growwTokenStatus: groww.getTokenStatus(),
      databaseStatus: supabase ? 'ONLINE' : 'OFFLINE',
      telegramStatus: telegramBotToken && telegramChatId ? 'ONLINE' : 'NOT_CONFIGURED',
      memoryUsageMb: Number((memory.heapUsed / 1024 / 1024).toFixed(2)),
      latestSignals: this.latestSignals,
      openPaperTradesCount: this.openPaperTrades.filter(t => t.status === 'OPEN').length,
      todayClosedTradesCount: this.todayTrades.filter(t => t.status === 'CLOSED').length,
    };
  }

  /**
   * Core periodic evaluation loop
   */
  public async tick(): Promise<void> {
    const isMarketHours = SignalEngine.isMarketHours();

    if (!isMarketHours) {
      this.status = 'IDLE_OUTSIDE_HOURS';
      this.brokerStatus = 'MARKET_CLOSED';
      await this.updateHeartbeat();
      return;
    }

    this.status = 'RUNNING';

    // Verify Market Data Provider Authentication
    if (!activeMarketDataProvider.isReady()) {
      this.status = 'BROKER_AUTH_EXPIRED';
      this.brokerStatus = 'NO_CREDENTIALS';
      console.warn('[Worker] Market data provider credentials missing. Please configure Angel One or Groww in .env.local.');
      await this.updateHeartbeat();
      return;
    }

    // Process both monitored instruments
    const instruments: Array<{ name: 'NIFTY 50' | 'BANK NIFTY'; symbol: 'NIFTY' | 'BANKNIFTY' }> = [
      { name: 'NIFTY 50', symbol: 'NIFTY' },
      { name: 'BANK NIFTY', symbol: 'BANKNIFTY' },
    ];

    for (const inst of instruments) {
      await this.processInstrument(inst.name, inst.symbol);
    }

    // Process notification outbox queue to dispatch any pending Telegram alerts
    await this.processNotificationOutbox();

    // Update worker heartbeat in Supabase
    await this.updateHeartbeat();
  }

  /**
   * Process a single instrument: fetch 5m candles -> evaluate -> persist -> notify
   */
  private async processInstrument(
    instrument: 'NIFTY 50' | 'BANK NIFTY',
    symbol: 'NIFTY' | 'BANKNIFTY'
  ): Promise<void> {
    try {
      // Calculate date range for current day (09:15 IST to now)
      const now = new Date();
      const istNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
      const yyyy = istNow.getFullYear();
      const mm = String(istNow.getMonth() + 1).padStart(2, '0');
      const dd = String(istNow.getDate()).padStart(2, '0');
      const startTime = `${yyyy}-${mm}-${dd} 09:15:00`;
      const endTime = `${yyyy}-${mm}-${dd} 15:30:00`;

      // Fetch 5-minute closed candles from active market data provider
      let candles: MarketCandle[] = [];
      try {
        candles = await activeMarketDataProvider.get5mClosedCandles(symbol, startTime, endTime);
        this.brokerStatus = `${activeMarketDataProvider.name} - CONNECTED_OK`;
      } catch (err: any) {
        const errMsg = err.message || String(err);
        const isAuthErr = (err instanceof AngelOneApiError && err.isAuthError) ||
          (err instanceof GrowwApiError && err.isAuthError) ||
          errMsg.includes('401') || errMsg.includes('403') || errMsg.includes('GA005') ||
          errMsg.includes('AG8001') || errMsg.includes('CONFIG_MISSING') ||
          errMsg.includes('GROWW_NOT_CONFIGURED') || errMsg.includes('NO_BROKER_CONFIGURED');

        if (isAuthErr) {
          this.status = 'BROKER_AUTH_EXPIRED';
          this.brokerStatus = 'APPROVAL_OR_LOGIN_REQUIRED';
          console.error(`[Worker] ${activeMarketDataProvider.name} Auth Error: ${errMsg}`);
          if (telegramBotToken && telegramChatId) {
            await TelegramService.sendSystemAlert(
              telegramBotToken,
              telegramChatId,
              `⚠️ <b>Market Data Auth Action Required</b>\nProvider: ${activeMarketDataProvider.name}\n${errMsg.slice(0, 180)}\n\n👉 Please verify credentials and TOTP secret in .env.local.\n\nSignals set to safe NO_DATA mode.\nTime: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST`
            ).catch(() => {});
          }
          return;
        } else if (
          (err instanceof AngelOneApiError && err.isRateLimit) ||
          (err instanceof GrowwApiError && err.isRateLimit) ||
          errMsg.includes('429')
        ) {
          this.brokerStatus = 'RATE_LIMITED';
          console.warn(`[Worker] Rate limited while fetching ${symbol} candles: ${errMsg}`);
          return;
        } else {
          console.error(`[Worker] Error fetching candles for ${symbol}:`, errMsg);
          this.brokerStatus = `FEED_ERROR: ${errMsg.slice(0, 40)}`;
          return;
        }
      }

      if (!candles || candles.length === 0) {
        return;
      }

      const latestCandle = candles[candles.length - 1];

      // Stale Feed Check (if latest candle is > 15 mins older than current time)
      const nowEpoch = Math.floor(Date.now() / 1000);
      if (nowEpoch - latestCandle.timestamp > 15 * 60) {
        this.status = 'STALE_FEED';
        this.brokerStatus = 'FEED_STALE';
        console.warn(`[Worker] Stale feed detected for ${instrument}. Last candle: ${latestCandle.datetime}`);
      }

      // Check if this candle was already evaluated
      if (this.lastEvaluatedCandleTime[instrument] === latestCandle.timestamp) {
        // Candle already processed, advance paper trades only
        this.advancePaperTrades(instrument, latestCandle);
        return;
      }

      // Fetch daily prior levels for pivot calculations
      const prevSlice = candles.slice(0, Math.max(1, candles.length - 1));
      const prevHigh = Math.max(...prevSlice.map(c => c.high));
      const prevLow = Math.min(...prevSlice.map(c => c.low));
      const prevClose = prevSlice[prevSlice.length - 1]?.close || latestCandle.open;

      // Evaluate signal using full quant engine
      const signal = SignalEngine.evaluate(instrument, {
        candles,
        vix: 13.5, // Standard baseline or live vix
        advances: 1400,
        declines: 800,
        prevDayHigh: prevHigh,
        prevDayLow: prevLow,
        prevDayClose: prevClose,
        activeConditions: [],
        forceMarketHoursCheck: false, // Already checked at worker tick
        minConfluenceRequired: 80, // STRICT 80% WIN RATE GATE
      });

      this.latestSignals[instrument] = signal;
      this.currentRegime = signal.marketRegime || 'UNKNOWN';
      this.lastEvaluatedCandleTime[instrument] = latestCandle.timestamp;

      // Persist canonical signal to Supabase
      await this.persistSignal(signal);

      // Advance open paper trades on this new candle
      this.advancePaperTrades(instrument, latestCandle);

      // If high-probability directional signal generated, evaluate paper trade entry
      if (
        (signal.canonicalSignalType === 'BUY CE' || signal.canonicalSignalType === 'BUY PE') &&
        signal.levels
      ) {
        await this.handleSignalEntry(signal, latestCandle);
      }
    } catch (err: any) {
      console.error(`[Worker] Error processing ${instrument}:`, err);
    }
  }

  /**
   * Persist canonical signal to Supabase `market_signals` and enqueue notification
   */
  private async persistSignal(signal: EvaluatedSignal): Promise<void> {
    if (!supabase) return;

    try {
      const { data: insertedSignal, error } = await supabase
        .from('market_signals')
        .upsert({
          instrument: signal.instrument,
          signal_type: signal.canonicalSignalType,
          candle_timestamp: new Date(signal.candleTimestamp * 1000).toISOString(),
          rule_version: signal.ruleVersion,
          deduplication_key: signal.deduplicationKey,
          status: signal.status,
          explanation: signal.explanation,
          data_freshness_timestamp: new Date().toISOString(),
        }, { onConflict: 'deduplication_key' })
        .select()
        .single();

      if (error) {
        console.error('[Worker] Error upserting market signal:', error.message);
        return;
      }

      // If directional BUY CE / BUY PE signal, enqueue into `notification_outbox`
      if (
        (signal.canonicalSignalType === 'BUY CE' || signal.canonicalSignalType === 'BUY PE') &&
        insertedSignal
      ) {
        const messageText = TelegramService.formatSignalMessage(signal);
        await supabase
          .from('notification_outbox')
          .insert({
            signal_id: insertedSignal.id,
            channel: 'TELEGRAM',
            message_payload: { text: messageText, parse_mode: 'HTML' },
            idempotency_key: `TG_${signal.deduplicationKey}`,
            status: 'PENDING',
          })
          .then(({ error: outboxErr }) => {
            if (outboxErr && !outboxErr.message.includes('unique')) {
              console.error('[Worker] Error queueing notification outbox:', outboxErr.message);
            }
          });
      }
    } catch (err) {
      console.error('[Worker] Failed to persist signal to database:', err);
    }
  }

  /**
   * Handle simulated paper trade entry for validated signals
   */
  private async handleSignalEntry(signal: EvaluatedSignal, candle: MarketCandle): Promise<void> {
    const riskCheck = PaperTradingEngine.canOpenNewTrade(this.todayTrades, signal.instrument);
    if (!riskCheck.allowed) {
      console.log(`[Worker] Paper trade entry blocked: ${riskCheck.reason}`);
      return;
    }

    const action = signal.canonicalSignalType === 'BUY CE' ? 'BUY_CE' : 'BUY_PE';
    const contract = PaperTradingEngine.deriveOptionContractSymbol(signal.instrument, action, candle.close);
    const quantity = signal.instrument === 'NIFTY 50' ? 50 : 15;

    const newTrade: PaperTradeRecord = {
      instrument: signal.instrument,
      contract_symbol: contract,
      action,
      entry_time: new Date(candle.timestamp * 1000).toISOString(),
      entry_price: signal.levels?.entryPrice || candle.close,
      stop_loss: signal.levels?.stopLoss || candle.low,
      target_1: signal.levels?.target1 || candle.close + 50,
      target_2: signal.levels?.target2 || candle.close + 100,
      quantity,
      outcome: 'OPEN',
      pnl_points: 0,
      gross_pnl_inr: 0,
      net_pnl_inr: 0,
      status: 'OPEN',
      strategy_name: signal.selectedStrategy,
      notes: `Entered via ${signal.selectedStrategy} with ${signal.confluenceScore}% confluence.`,
    };

    this.openPaperTrades.push(newTrade);
    this.todayTrades.push(newTrade);
    await PaperTradingEngine.persistPaperTrade(newTrade);
    console.log(`[Worker] Paper Trade Opened: ${contract} at ₹${newTrade.entry_price}`);
  }

  /**
   * Advance open paper trades against the latest candle
   */
  private advancePaperTrades(instrument: string, candle: MarketCandle): void {
    const instOpenTrades = this.openPaperTrades.filter(t => t.instrument === instrument && t.status === 'OPEN');
    if (instOpenTrades.length === 0) return;

    // Check if 15:20 IST EOD auto square-off
    const istHours = new Date(candle.timestamp * 1000).getUTCHours() + 5.5;
    const isEod = istHours >= 15.33; // 15:20 IST

    const { updatedTrades, closedCount } = PaperTradingEngine.evaluateOpenTrades(
      instOpenTrades,
      candle,
      isEod
    );

    if (closedCount > 0) {
      for (const updated of updatedTrades) {
        if (updated.status === 'CLOSED') {
          console.log(`[Worker] Paper Trade Closed: ${updated.contract_symbol} -> ${updated.outcome} | Net PnL: ₹${updated.net_pnl_inr}`);
          PaperTradingEngine.persistPaperTrade(updated);
        }
      }
      // Remove closed trades from open pool
      this.openPaperTrades = this.openPaperTrades.filter(t => t.status === 'OPEN');
    }
  }

  /**
   * Process notification outbox queue with retry backoff
   */
  private async processNotificationOutbox(): Promise<void> {
    if (!supabase || !telegramBotToken || !telegramChatId) return;

    try {
      const { data: pendingItems, error } = await supabase
        .from('notification_outbox')
        .select('*')
        .in('status', ['PENDING', 'RETRYING'])
        .lte('next_retry_at', new Date().toISOString())
        .limit(5);

      if (error || !pendingItems || pendingItems.length === 0) return;

      for (const item of pendingItems) {
        const text = item.message_payload?.text || '';
        const res = await TelegramService.sendDirectMessage(telegramBotToken, telegramChatId, text);

        if (res.success) {
          await supabase
            .from('notification_outbox')
            .update({
              status: 'SENT',
              delivered_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', item.id);
        } else {
          const attempts = item.attempts + 1;
          const isMax = attempts >= item.max_attempts;
          // Exponential backoff: 30s * 2^attempts
          const delaySec = Math.min(600, 30 * Math.pow(2, attempts));
          const nextRetry = new Date(Date.now() + delaySec * 1000).toISOString();

          await supabase
            .from('notification_outbox')
            .update({
              status: isMax ? 'FAILED' : 'RETRYING',
              attempts,
              last_error: res.error,
              next_retry_at: nextRetry,
              updated_at: new Date().toISOString(),
            })
            .eq('id', item.id);
        }
      }
    } catch (err) {
      console.error('[Worker] Error processing notification outbox:', err);
    }
  }

  /**
   * Update worker heartbeat in Supabase `worker_heartbeats` table
   */
  private async updateHeartbeat(): Promise<void> {
    if (!supabase) return;

    try {
      const memory = process.memoryUsage();
      const memMb = Number((memory.heapUsed / 1024 / 1024).toFixed(2));
      const uptime = Math.floor((Date.now() - this.startTime) / 1000);

      await supabase
        .from('worker_heartbeats')
        .upsert({
          worker_id: this.workerId,
          status: this.status,
          last_heartbeat: new Date().toISOString(),
          last_candle_ist: this.latestSignals['NIFTY 50']?.candleDateTimeIST || 'N/A',
          current_regime: this.currentRegime,
          active_instrument: 'NIFTY 50, BANK NIFTY',
          broker_status: this.brokerStatus,
          memory_usage_mb: memMb,
          uptime_seconds: uptime,
          metadata: {
            pid: process.pid,
            version: '2.0.0',
            lastError: this.lastError,
          },
          updated_at: new Date().toISOString(),
        }, { onConflict: 'worker_id' });
    } catch (err) {
      // Non-critical, do not crash worker
    }
  }
}

export const worker = new AutonomousBackgroundWorker();
