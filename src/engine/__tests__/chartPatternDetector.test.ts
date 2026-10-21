import { describe, it, expect } from 'vitest';
import { ChartPatternDetector, type SwingPivot } from '../chartPatternDetector';
import { SignalEngine } from '../signalEngine';
import type { MarketCandle } from '../../services/growwService';

// Helper to create synthetic 5m candles
function createCandle(
  timestamp: number,
  open: number,
  high: number,
  low: number,
  close: number,
  volume = 15000,
  isClosed = true
): MarketCandle {
  const d = new Date(timestamp * 1000);
  return {
    timestamp,
    datetime: d.toISOString(),
    open,
    high,
    low,
    close,
    volume,
    isClosed,
  };
}

describe('ChartPatternDetector (M, W, Head & Shoulders, Retests & Traps)', () => {
  describe('Resampling & Zero Look-Ahead Bias', () => {
    it('should aggregate 5m closed candles into 15m bars strictly without look-ahead bias', () => {
      const baseTime = 1792500300; // 900s epoch aligned (1792500300 / 900 = 1991667)
      const candles5m: MarketCandle[] = [];

      // Create 9 5m candles (3 complete 15m intervals)
      for (let i = 0; i < 9; i++) {
        const t = baseTime + i * 300;
        candles5m.push(createCandle(t, 24000 + i * 10, 24020 + i * 10, 23990 + i * 10, 24010 + i * 10));
      }

      const candles15m = ChartPatternDetector.resample5mTo15m(candles5m);
      expect(candles15m.length).toBe(3);

      // Verify first 15m bar aggregates first 3 5m bars:
      expect(candles15m[0].open).toBe(candles5m[0].open);
      expect(candles15m[0].high).toBe(Math.max(...candles5m.slice(0, 3).map(c => c.high)));
      expect(candles15m[0].low).toBe(Math.min(...candles5m.slice(0, 3).map(c => c.low)));
      expect(candles15m[0].close).toBe(candles5m[2].close);
      expect(candles15m[0].volume).toBe(candles5m[0].volume! + candles5m[1].volume! + candles5m[2].volume!);
    });

    it('should ignore incomplete 15m candle buckets with fewer than 3 closed 5m bars', () => {
      const baseTime = 1792500300;
      const candles5m: MarketCandle[] = [];

      // 4 5m candles -> 1 complete 15m (3 bars) + 1 incomplete (1 bar)
      for (let i = 0; i < 4; i++) {
        candles5m.push(createCandle(baseTime + i * 300, 24000, 24020, 23990, 24010));
      }

      const candles15m = ChartPatternDetector.resample5mTo15m(candles5m);
      expect(candles15m.length).toBe(1);
    });

    it('should confirm swing pivots strictly AFTER right-side confirmation bars close (zero lookahead)', () => {
      const candles: MarketCandle[] = [
        createCandle(1000, 24000, 24010, 23990, 24005), // 0
        createCandle(1900, 24005, 24030, 24000, 24025), // 1
        createCandle(2800, 24025, 24100, 24020, 24090), // 2: PEAK (High = 24100)
        createCandle(3700, 24090, 24080, 24040, 24050), // 3: right bar 1
        createCandle(4600, 24050, 24060, 24030, 24040), // 4: right bar 2 (Pivot at idx 2 confirmed here)
        createCandle(5500, 24040, 24050, 24020, 24030), // 5
      ];

      const pivots = ChartPatternDetector.detectSwingPivots(candles, 2, 2);
      expect(pivots.length).toBe(1);
      expect(pivots[0].type).toBe('HIGH');
      expect(pivots[0].index).toBe(2);
      expect(pivots[0].price).toBe(24100);
      expect(pivots[0].confirmedAtIndex).toBe(4); // Only known at bar 4!
    });
  });

  describe('M Pattern (Double Top) Breakdown', () => {
    it('should detect a Double Top breakdown when 5m candle closes below neckline', () => {
      const baseTime = 1792500300;
      const candles5m: MarketCandle[] = [];

      // Construct a sequence creating Peak 1 (~24500), Valley (~24350), Peak 2 (~24500), Breakdown (< 24350)
      // We will generate 30 15m intervals = 90 5m candles
      const prices: number[] = [];

      // Up to Peak 1 at 15m bar 4 (candles 0-11)
      for (let i = 0; i < 12; i++) prices.push(24200 + i * 25); // reaches 24475 -> 24500
      // Down to Valley at 15m bar 9 (candles 12-26)
      for (let i = 0; i < 15; i++) prices.push(24500 - i * 10); // drops to 24350
      // Up to Peak 2 at 15m bar 14 (candles 27-41)
      for (let i = 0; i < 15; i++) prices.push(24350 + i * 10); // rises to 24500
      // Down to Neckline at 15m bar 19 (candles 42-56)
      for (let i = 0; i < 15; i++) prices.push(24500 - i * 10); // drops back to 24350
      // Breakdown below neckline at candles 57+
      for (let i = 0; i < 10; i++) prices.push(24350 - 10 - i * 15); // drops to 24200

      for (let i = 0; i < prices.length; i++) {
        const p = prices[i];
        candles5m.push(createCandle(baseTime + i * 300, p - 5, p + 8, p - 8, p, 20000));
      }

      const patterns = ChartPatternDetector.detect(candles5m);
      const dt = patterns.find(p => p.patternType === 'DOUBLE_TOP_M' || p.patternType === 'NECKLINE_RETEST_BOUNCE');

      expect(dt).toBeDefined();
      if (dt) {
        expect(dt.direction).toBe('BEARISH');
        expect(dt.necklinePrice).toBeGreaterThan(24300);
        expect(dt.necklinePrice).toBeLessThan(24400);
        expect(dt.geometry.target1).toBeLessThan(dt.necklinePrice);
        expect(dt.geometry.stopLoss).toBeGreaterThan(dt.necklinePrice);
        expect(dt.confidence).toBeGreaterThanOrEqual(80);
      }
    });
  });

  describe('W Pattern (Double Bottom) Breakout', () => {
    it('should detect a Double Bottom breakout when 5m candle closes above neckline', () => {
      const baseTime = 1792500300;
      const candles5m: MarketCandle[] = [];
      const prices: number[] = [];

      // Down to Trough 1 at ~24100
      for (let i = 0; i < 12; i++) prices.push(24400 - i * 25); // drops to 24125
      // Up to Neckline Peak at ~24250
      for (let i = 0; i < 15; i++) prices.push(24125 + i * 8.5); // rises to 24250
      // Down to Trough 2 at ~24120
      for (let i = 0; i < 15; i++) prices.push(24250 - i * 8.5); // drops to 24125
      // Up to Neckline and Breakout > 24250
      for (let i = 0; i < 20; i++) prices.push(24125 + i * 15); // rises to 24425

      for (let i = 0; i < prices.length; i++) {
        const p = prices[i];
        candles5m.push(createCandle(baseTime + i * 300, p - 5, p + 8, p - 8, p, 25000));
      }

      const patterns = ChartPatternDetector.detect(candles5m);
      const db = patterns.find(p => p.patternType === 'DOUBLE_BOTTOM_W' || p.patternType === 'NECKLINE_RETEST_BOUNCE');

      expect(db).toBeDefined();
      if (db) {
        expect(db.direction).toBe('BULLISH');
        expect(db.necklinePrice).toBeGreaterThan(24200);
        expect(db.geometry.target1).toBeGreaterThan(db.necklinePrice);
        expect(db.geometry.stopLoss).toBeLessThan(db.necklinePrice);
        expect(db.confidence).toBeGreaterThanOrEqual(80);
      }
    });
  });

  describe('Head and Shoulders & Inverse H&S', () => {
    it('should detect Head and Shoulders breakdown with higher central peak', () => {
      const baseTime = 1792500300;
      const candles5m: MarketCandle[] = [];
      const prices: number[] = [];

      // Left shoulder peak ~24400
      for (let i = 0; i < 12; i++) prices.push(24200 + i * 18);
      // Trough 1 ~24300
      for (let i = 0; i < 10; i++) prices.push(24400 - i * 10);
      // Head peak ~24550 (strictly higher)
      for (let i = 0; i < 15; i++) prices.push(24300 + i * 17);
      // Trough 2 ~24300
      for (let i = 0; i < 15; i++) prices.push(24550 - i * 17);
      // Right shoulder peak ~24400 (similar to LS)
      for (let i = 0; i < 12; i++) prices.push(24300 + i * 8.5);
      // Breakdown below neckline 24300
      for (let i = 0; i < 15; i++) prices.push(24400 - i * 15);

      for (let i = 0; i < prices.length; i++) {
        const p = prices[i];
        candles5m.push(createCandle(baseTime + i * 300, p - 4, p + 6, p - 6, p, 22000));
      }

      const patterns = ChartPatternDetector.detect(candles5m);
      const hs = patterns.find(p => p.patternType === 'HEAD_AND_SHOULDERS');

      expect(hs).toBeDefined();
      if (hs) {
        expect(hs.direction).toBe('BEARISH');
        expect(hs.pivots.length).toBe(5); // LS, T1, Head, T2, RS
        expect(hs.geometry.target1).toBeLessThan(hs.necklinePrice);
      }
    });

    it('should detect Inverse Head and Shoulders breakout with lower central trough', () => {
      const baseTime = 1792500300;
      const candles5m: MarketCandle[] = [];
      const prices: number[] = [];

      // Left shoulder trough ~24200
      for (let i = 0; i < 12; i++) prices.push(24400 - i * 17);
      // Peak 1 ~24300
      for (let i = 0; i < 10; i++) prices.push(24200 + i * 10);
      // Head trough ~24050 (strictly lower)
      for (let i = 0; i < 15; i++) prices.push(24300 - i * 17);
      // Peak 2 ~24300
      for (let i = 0; i < 15; i++) prices.push(24050 + i * 17);
      // Right shoulder trough ~24200
      for (let i = 0; i < 12; i++) prices.push(24300 - i * 8.5);
      // Breakout above neckline 24300
      for (let i = 0; i < 15; i++) prices.push(24200 + i * 15);

      for (let i = 0; i < prices.length; i++) {
        const p = prices[i];
        candles5m.push(createCandle(baseTime + i * 300, p - 4, p + 6, p - 6, p, 24000));
      }

      const patterns = ChartPatternDetector.detect(candles5m);
      const invHs = patterns.find(p => p.patternType === 'INVERSE_HEAD_AND_SHOULDERS');

      expect(invHs).toBeDefined();
      if (invHs) {
        expect(invHs.direction).toBe('BULLISH');
        expect(invHs.pivots.length).toBe(5);
        expect(invHs.geometry.target1).toBeGreaterThan(invHs.necklinePrice);
      }
    });
  });

  describe('Failed Breakout / Bear & Bull Trap Reversal', () => {
    it('should detect Bear Trap when Double Top breakdown fails and reclaims neckline', () => {
      const baseTime = 1792500300;
      const candles5m: MarketCandle[] = [];
      const prices: number[] = [];

      // Peak 1
      for (let i = 0; i < 12; i++) prices.push(24200 + i * 25);
      // Valley ~24350
      for (let i = 0; i < 15; i++) prices.push(24500 - i * 10);
      // Peak 2 ~24500
      for (let i = 0; i < 15; i++) prices.push(24350 + i * 10);
      // Drop to breakdown
      for (let i = 0; i < 15; i++) prices.push(24500 - i * 10);
      // Pierces neckline to 24300 (breakdown)
      prices.push(24300);
      // Sharp reversal back above neckline to 24420 (Trap!)
      prices.push(24380);
      prices.push(24420);

      for (let i = 0; i < prices.length; i++) {
        const p = prices[i];
        candles5m.push(createCandle(baseTime + i * 300, p - 4, p + 6, p - 6, p, 28000));
      }

      const patterns = ChartPatternDetector.detect(candles5m);
      const trap = patterns.find(p => p.patternType === 'FAILED_BREAKOUT_TRAP');

      expect(trap).toBeDefined();
      if (trap) {
        expect(trap.direction).toBe('BULLISH');
        expect(trap.status).toBe('FAILED_BREAKOUT');
        expect(trap.explanation).toContain('Bear Trap');
      }
    });
  });

  describe('SignalEngine Integration with 80% Win Rate Gate', () => {
    it('should generate BUY PE when Double Top breakdown aligns with trend & key levels', () => {
      const baseTime = 1792500300;
      const candles5m: MarketCandle[] = [];
      const prices: number[] = [];

      for (let i = 0; i < 12; i++) prices.push(24200 + i * 25);
      for (let i = 0; i < 15; i++) prices.push(24500 - i * 10);
      for (let i = 0; i < 15; i++) prices.push(24350 + i * 10);
      for (let i = 0; i < 15; i++) prices.push(24500 - i * 10);
      for (let i = 0; i < 10; i++) prices.push(24350 - 10 - i * 15);

      for (let i = 0; i < prices.length; i++) {
        const p = prices[i];
        candles5m.push(createCandle(baseTime + i * 300, p - 5, p + 8, p - 8, p, 30000));
      }

      const signal = SignalEngine.evaluate('NIFTY 50', {
        candles: candles5m,
        vix: 14.5,
        advances: 12,
        declines: 38,
        prevDayHigh: 24520,
        prevDayLow: 24100,
        prevDayClose: 24450,
        forceMarketHoursCheck: false,
        activeConditions: [],
      });

      expect(signal.canonicalSignalType).toBe('BUY PE');
      expect(signal.isHighProbability).toBe(true);
      expect(signal.confluenceScore).toBeGreaterThanOrEqual(80);
      expect(signal.levels.target1).toBeLessThan(signal.levels.entryPrice);
    });
  });
});
