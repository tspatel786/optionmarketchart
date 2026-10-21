import { describe, it, expect } from 'vitest';
import { OptionGreeksEngine } from '../optionGreeks';
import { BreakoutValidator } from '../breakoutValidator';
import { CandlestickPatternEvaluator } from '../candlestickPatterns';
import type { MarketCandle } from '../../services/growwService';

function makeCandle(
  timestamp: number,
  open: number,
  high: number,
  low: number,
  close: number,
  volume = 20000,
  isClosed = true
): MarketCandle {
  return {
    timestamp,
    datetime: new Date(timestamp * 1000).toISOString(),
    open,
    high,
    low,
    close,
    volume,
    isClosed,
  };
}

describe('OptionGreeksEngine (BSM Closed-Form Pricing & Greeks)', () => {
  it('should accurately calculate Delta, Gamma, Theta, Vega, and Rho for ATM NIFTY contracts', () => {
    const spot = 24500;
    const strike = 24500;
    const daysToExpiry = 2.0; // 2 days to weekly expiry
    const vix = 14.0;

    const callGreeks = OptionGreeksEngine.calculateGreeks(spot, strike, 'CE', daysToExpiry, vix);
    const putGreeks = OptionGreeksEngine.calculateGreeks(spot, strike, 'PE', daysToExpiry, vix);

    // Call Delta should be ~0.50
    expect(callGreeks.delta).toBeGreaterThanOrEqual(0.45);
    expect(callGreeks.delta).toBeLessThanOrEqual(0.55);

    // Put Delta should be ~ -0.50
    expect(putGreeks.delta).toBeLessThanOrEqual(-0.45);
    expect(putGreeks.delta).toBeGreaterThanOrEqual(-0.55);

    // Gamma must be strictly positive and identical for CE and PE
    expect(callGreeks.gamma).toBeGreaterThan(0);
    expect(callGreeks.gamma).toBe(putGreeks.gamma);

    // Theta must be negative (time decay)
    expect(callGreeks.theta).toBeLessThan(0);
    expect(putGreeks.theta).toBeLessThan(0);

    // Vega must be strictly positive
    expect(callGreeks.vega).toBeGreaterThan(0);
    expect(callGreeks.vega).toBe(putGreeks.vega);

    // Moneyness must be ATM
    expect(callGreeks.moneyness).toBe('ATM');
    expect(putGreeks.moneyness).toBe('ATM');
  });

  it('should project accurate Option Premiums at Target 1, Target 2, and Stop Loss', () => {
    const spot = 24500;
    const strike = 24500;
    const target1 = 24575; // +75 index points
    const target2 = 24650; // +150 index points
    const stopLoss = 24450;// -50 index points

    const proj = OptionGreeksEngine.projectOptionTargets(
      spot,
      target1,
      target2,
      stopLoss,
      strike,
      'BUY_CE',
      14.0,
      2.0
    );

    expect(proj.target1EstimatedPremium).toBeGreaterThan(proj.currentEstimatedPremium);
    expect(proj.target2EstimatedPremium).toBeGreaterThan(proj.target1EstimatedPremium);
    expect(proj.stopLossEstimatedPremium).toBeLessThan(proj.currentEstimatedPremium);
    expect(proj.deltaGainPointsT1).toBeGreaterThan(30); // ~75 * 0.50 = ~37.5 pts
  });
});

describe('BreakoutValidator (Strong vs. Weak Breakouts per Cheat Sheet)', () => {
  it('should flag a weak bullish breakout (< 50% body penetration) as DO_NOT_ENTER', () => {
    const resistance = 24500;
    // Open 24470, Close 24510. Body = 40 pts.
    // Portion above resistance = 24510 - 24500 = 10 pts (25% above, 75% below)
    const weakCandle = makeCandle(1000, 24470, 24515, 24465, 24510);

    const result = BreakoutValidator.evaluateBreakout(weakCandle, resistance, 'BULLISH');

    expect(result.classification).toBe('WEAK_BULLISH_BREAKOUT');
    expect(result.isQualified).toBe(false);
    expect(result.penetrationPct).toBe(25.0);
    expect(result.recommendation).toBe('DO_NOT_ENTER');
  });

  it('should qualify a strong bullish breakout (>= 60% body penetration) as ENTER', () => {
    const resistance = 24500;
    // Open 24490, Close 24565. Body = 75 pts.
    // Portion above resistance = 24565 - 24500 = 65 pts. 65 / 75 = 86.7%
    const strongCandle = makeCandle(1000, 24490, 24570, 24485, 24565);

    const result = BreakoutValidator.evaluateBreakout(strongCandle, resistance, 'BULLISH');

    expect(result.classification).toBe('STRONG_BULLISH_BREAKOUT');
    expect(result.isQualified).toBe(true);
    expect(result.penetrationPct).toBeGreaterThanOrEqual(60.0);
    expect(result.recommendation).toBe('ENTER');
  });

  it('should flag a weak breakout rejected by next red candle as WEAK_BREAKOUT_REJECTED', () => {
    const resistance = 24500;
    const breakoutCandle = makeCandle(1000, 24480, 24530, 24475, 24525);
    // Follow-through candle turns red and closes below resistance
    const followThrough = makeCandle(1300, 24525, 24530, 24490, 24495);

    const result = BreakoutValidator.evaluateBreakout(breakoutCandle, resistance, 'BULLISH', followThrough);

    expect(result.classification).toBe('WEAK_BREAKOUT_REJECTED');
    expect(result.isQualified).toBe(false);
    expect(result.recommendation).toBe('DO_NOT_ENTER');
  });

  it('should qualify a strong retest bounce with rejection wick as STRONG_RETEST_BOUNCE', () => {
    const resistance = 24500;
    const breakoutCandle = makeCandle(1000, 24480, 24550, 24475, 24545);
    // Follow-through candle dips to 24502 (touches resistance zone) and bounces to close green at 24545
    const retestCandle = makeCandle(1300, 24510, 24555, 24502, 24545);

    const result = BreakoutValidator.evaluateBreakout(breakoutCandle, resistance, 'BULLISH', retestCandle);

    expect(result.classification).toBe('STRONG_RETEST_BOUNCE');
    expect(result.isQualified).toBe(true);
    expect(result.confidenceScore).toBeGreaterThanOrEqual(90);
    expect(result.recommendation).toBe('ENTER');
  });

  it('should flag weak bearish breakdown (< 50% body penetration below support) as DO_NOT_ENTER', () => {
    const support = 24300;
    // Open 24330, Close 24290. Body = 40 pts.
    // Portion below support = 24300 - 24290 = 10 pts (25% below, 75% above)
    const weakCandle = makeCandle(1000, 24330, 24335, 24285, 24290);

    const result = BreakoutValidator.evaluateBreakout(weakCandle, support, 'BEARISH');

    expect(result.classification).toBe('WEAK_BEARISH_BREAKOUT');
    expect(result.isQualified).toBe(false);
    expect(result.penetrationPct).toBe(25.0);
    expect(result.recommendation).toBe('DO_NOT_ENTER');
  });
});

describe('Expanded Candlestick Patterns (Morning Star, Evening Star, Dojis, Harami)', () => {
  it('should detect Morning Star 3-candle bullish reversal', () => {
    const candles: MarketCandle[] = [
      makeCandle(1000, 24500, 24510, 24400, 24410), // Downtrend bar 1
      makeCandle(1300, 24410, 24420, 24320, 24330), // Downtrend bar 2
      makeCandle(1600, 24330, 24335, 24220, 24230), // c2: Large red (body 100)
      makeCandle(1900, 24225, 24240, 24210, 24228), // c1: Star (small body)
      makeCandle(2200, 24235, 24300, 24230, 24295), // c0: Green closing >50% into c2
    ];

    const result = CandlestickPatternEvaluator.checkMorningStar(candles);
    expect(result).not.toBeNull();
    if (result) {
      expect(result.direction).toBe('BUY');
      expect(result.patternCode).toBe('PA-09');
    }
  });

  it('should detect Dragonfly Doji bullish rejection', () => {
    const candles: MarketCandle[] = [
      makeCandle(1000, 24500, 24510, 24400, 24410),
      makeCandle(1300, 24410, 24420, 24300, 24310),
      // Open 24300, High 24302, Low 24200, Close 24301 (Lower wick = 100, range = 102, body = 1)
      makeCandle(1600, 24300, 24302, 24200, 24301),
    ];

    const result = CandlestickPatternEvaluator.checkDragonflyDoji(candles);
    expect(result).not.toBeNull();
    if (result) {
      expect(result.direction).toBe('BUY');
      expect(result.patternCode).toBe('PA-17');
    }
  });
});
