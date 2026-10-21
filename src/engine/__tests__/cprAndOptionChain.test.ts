import { describe, it, expect } from 'vitest';
import { CprEngine } from '../cprEngine';
import { OptionChainEngine } from '../optionChainEngine';
import { RiskCalculator } from '../riskCalculator';
import { SoundAlertService } from '../../services/soundAlertService';

describe('Central Pivot Range (CPR) Engine', () => {
  it('should calculate accurate TC, Pivot, and BC levels', () => {
    // High: 24700, Low: 24500, Close: 24600
    const high = 24700;
    const low = 24500;
    const close = 24600;

    const cpr = CprEngine.calculate(high, low, close);

    // Pivot = (24700 + 24500 + 24600) / 3 = 24600
    expect(cpr.pivot).toBe(24600);
    // BC = (24700 + 24500) / 2 = 24600
    expect(cpr.bc).toBe(24600);
    // TC = 2 * 24600 - 24600 = 24600
    expect(cpr.tc).toBe(24600);
    expect(cpr.cprWidth).toBe(0);
    expect(cpr.category).toBe('NARROW_CPR');
    expect(cpr.prediction.dayType).toBe('TRENDING_DAY');
  });

  it('should classify wide CPR as sideways chop day', () => {
    // High: 25000, Low: 24000, Close: 24200
    const high = 25000;
    const low = 24000;
    const close = 24200;

    const cpr = CprEngine.calculate(high, low, close);
    // Pivot = 73200 / 3 = 24400
    // BC = 49000 / 2 = 24500
    // TC = 2 * 24400 - 24500 = 24300
    // Width = |24300 - 24500| = 200. Width % = (200 / 24400) * 100 = 0.819% (> 0.35%)
    expect(cpr.category).toBe('WIDE_CPR');
    expect(cpr.prediction.dayType).toBe('SIDEWAYS_DAY');
  });

  it('should detect virgin CPR when candles do not breach CPR boundaries', () => {
    const cpr = CprEngine.calculate(24600, 24500, 24550, [
      { high: 24750, low: 24680 },
      { high: 24800, low: 24700 },
    ]);
    expect(cpr.isVirginCPR).toBe(true);
  });
});

describe('Option Chain & PCR Analytics Engine', () => {
  it('should compute PCR accurately and classify sentiment', () => {
    const spot = 24500;
    const strikes = [
      { strike: 24400, callOI: 20000, putOI: 80000, callLtp: 150, putLtp: 30, callChangeOI: 0, putChangeOI: 0 },
      { strike: 24500, callOI: 50000, putOI: 70000, callLtp: 80, putLtp: 75, callChangeOI: 0, putChangeOI: 0 },
      { strike: 24600, callOI: 90000, putOI: 30000, callLtp: 30, putLtp: 140, callChangeOI: 0, putChangeOI: 0 },
    ];

    const result = OptionChainEngine.analyze(spot, strikes);

    // Total Call OI = 160000, Total Put OI = 180000
    // PCR = 180000 / 160000 = 1.125 -> toFixed(2) = 1.13
    expect(result.pcr).toBe(1.13);
    expect(result.sentiment).toBe('BULLISH');
    expect(result.highestCallOIStrike).toBe(24600); // Resistance
    expect(result.highestPutOIStrike).toBe(24400);  // Support
  });

  it('should generate synthetic option chain centered at ATM strike', () => {
    const analysis = OptionChainEngine.generateSyntheticChain(24535);
    expect(analysis.strikes.length).toBe(9);
    expect(analysis.atmStrike).toBe(24550); // Closest 50-point step
    expect(analysis.maxPainStrike).toBeGreaterThan(0);
  });
});

describe('Position Sizing & Risk Calculator', () => {
  it('should calculate lots and risk correctly for NIFTY 50 (lot 25)', () => {
    const calc = RiskCalculator.calculate({
      capital: 100000,
      riskPercentage: 2, // ₹2,000 risk
      instrument: 'NIFTY 50',
      optionEntryPrice: 120,
      optionStopLossPrice: 90, // ₹30 risk per qty
    });

    // Risk per lot = 30 * 25 = ₹750
    // Recommended lots = floor(2000 / 750) = 2 lots (50 qty)
    expect(calc.lotSize).toBe(25);
    expect(calc.riskPerLot).toBe(750);
    expect(calc.recommendedLots).toBe(2);
    expect(calc.totalQuantity).toBe(50);
    expect(calc.totalActualRiskAmount).toBe(1500); // 50 * 30
    expect(calc.totalCapitalRequired).toBe(6000);  // 50 * 120
  });

  it('should calculate lots and risk correctly for BANK NIFTY (lot 15)', () => {
    const calc = RiskCalculator.calculate({
      capital: 50000,
      riskPercentage: 3, // ₹1,500 risk
      instrument: 'BANK NIFTY',
      optionEntryPrice: 300,
      optionStopLossPrice: 250, // ₹50 risk per qty
    });

    // Risk per lot = 50 * 15 = ₹750
    // Recommended lots = floor(1500 / 750) = 2 lots (30 qty)
    expect(calc.lotSize).toBe(15);
    expect(calc.riskPerLot).toBe(750);
    expect(calc.recommendedLots).toBe(2);
    expect(calc.totalQuantity).toBe(30);
  });

  it('should support SENSEX (lot 10) and FINNIFTY (lot 25)', () => {
    const sensex = RiskCalculator.calculate({
      capital: 100000,
      riskPercentage: 2,
      instrument: 'SENSEX',
      optionEntryPrice: 200,
      optionStopLossPrice: 150,
    });
    expect(sensex.lotSize).toBe(10);

    const finnifty = RiskCalculator.calculate({
      capital: 100000,
      riskPercentage: 2,
      instrument: 'FINNIFTY',
      optionEntryPrice: 100,
      optionStopLossPrice: 80,
    });
    expect(finnifty.lotSize).toBe(25);
  });
});
