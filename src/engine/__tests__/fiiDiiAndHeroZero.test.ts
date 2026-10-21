import { describe, it, expect } from 'vitest';
import { FiiDiiEngine } from '../fiiDiiEngine';
import { HeroZeroRadarEngine } from '../heroZeroRadar';

describe('FII / DII Institutional Flow & Long-Short Radar', () => {
  it('should return valid institutional flow data and positive totals', () => {
    const flow = FiiDiiEngine.getDailyFlow();

    expect(flow.fiiCashNet).toBeDefined();
    expect(flow.diiCashNet).toBeDefined();
    expect(flow.totalNetInstitutional).toBe(Number((flow.fiiCashNet + flow.diiCashNet).toFixed(2)));
    expect(flow.fiiFuturesLongContracts).toBeGreaterThan(0);
    expect(flow.fiiFuturesShortContracts).toBeGreaterThan(0);
    expect(flow.fiiLongPercentage).toBeGreaterThan(0);
    expect(flow.fiiLongPercentage).toBeLessThan(100);
    expect(flow.fiiLongShortRatio).toBeGreaterThan(0);
    expect(flow.bias).toBeDefined();
    expect(flow.marathiInsight).toBeTruthy();
  });
});

describe('Expiry Day Hero-Zero Setup Radar', () => {
  it('should calculate accurate weekly expiry instruments per user & SEBI rules', () => {
    expect(HeroZeroRadarEngine.EXPIRY_DAYS[1]).toBe('MIDCPNIFTY'); // Monday
    expect(HeroZeroRadarEngine.EXPIRY_DAYS[2]).toBe('NIFTY 50');    // Tuesday (मंगळवार)
    expect(HeroZeroRadarEngine.EXPIRY_DAYS[3]).toBe('BANK NIFTY');  // Wednesday (बुधवार)
    expect(HeroZeroRadarEngine.EXPIRY_DAYS[4]).toBe('SENSEX');      // Thursday (गुरूवार)
    expect(HeroZeroRadarEngine.EXPIRY_DAYS[5]).toBe('FINNIFTY');    // Friday (शुक्रवार)
  });

  it('should generate CE and PE Hero-Zero setups with bounded risk', () => {
    const radar = HeroZeroRadarEngine.evaluateRadar('NIFTY 50', 24200);

    expect(radar.setups.length).toBe(2);
    const ce = radar.setups.find((s) => s.optionType === 'CE');
    const pe = radar.setups.find((s) => s.optionType === 'PE');

    expect(ce).toBeDefined();
    expect(pe).toBeDefined();

    // Entry should be between ₹15 and ₹35
    expect(ce?.currentPremium).toBeGreaterThanOrEqual(15);
    expect(ce?.currentPremium).toBeLessThanOrEqual(35);

    // Stop Loss should be strictly defined and lower than entry
    expect(ce?.stopLoss).toBeLessThan(ce!.currentPremium);
    expect(ce?.target1).toBeGreaterThan(ce!.currentPremium);
    expect(ce?.target2).toBeGreaterThan(ce!.target1);

    // Risk per lot should be bounded to safe retail risk (< ₹1000)
    expect(ce?.maxRiskPerLot).toBeLessThan(1000);
    expect(pe?.maxRiskPerLot).toBeLessThan(1000);

    // Should include clear rules and precautions
    expect(radar.rulesAndPrecautions.length).toBeGreaterThan(0);
  });

  it('should correctly adapt strike steps for high-value indices (BankNifty/Sensex)', () => {
    const bankRadar = HeroZeroRadarEngine.evaluateRadar('BANK NIFTY', 51250);
    const ce = bankRadar.setups.find((s) => s.optionType === 'CE');
    // Step should be 100
    expect(ce?.strike).toBe(51400);
  });
});
