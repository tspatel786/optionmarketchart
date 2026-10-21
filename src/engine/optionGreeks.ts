/**
 * Option Greeks Pricing & Analytical Sensitivity Engine
 * Implements Black-Scholes-Merton (BSM) closed-form formulas for Indian Index Options (NIFTY 50 & BANK NIFTY).
 *
 * Implements:
 * 1. Delta (Δ): Rate of change of option price w.r.t underlying spot (Range: 0 to 1 for CE, -1 to 0 for PE).
 * 2. Gamma (Γ): Rate of change of Delta w.r.t underlying spot (Acceleration of Delta, peaks ATM).
 * 3. Theta (Θ): 1-day time decay penalty (Negative for option buyers, accelerates near expiry).
 * 4. Vega (ν): Sensitivity to 1% shift in Implied Volatility / India VIX.
 * 5. Rho (ρ): Sensitivity to 1% shift in RBI Repo Interest Rate.
 * 6. Greeks-Adjusted Target & Stop-Loss Estimator: Computes exact projected option premium at Target 1, Target 2, and SL.
 */

export interface BSMOptionGreeks {
  delta: number;      // e.g. 0.52 (ATM CE) or -0.48 (ATM PE)
  gamma: number;      // e.g. 0.0018 per index point
  theta: number;      // e.g. -14.50 ₹/day
  vega: number;       // e.g. 18.20 ₹ per 1% IV change
  rho: number;        // e.g. 3.40 ₹ per 1% interest rate change
  theoreticalPrice: number; // Fair market BSM value
  impliedVolatility: number;// e.g. 14.5% (annualized)
  daysToExpiry: number;     // e.g. 2.5 days
  moneyness: 'DEEP_ITM' | 'ITM' | 'ATM' | 'OTM' | 'DEEP_OTM';
}

export interface OptionTargetProjection {
  currentEstimatedPremium: number;
  target1EstimatedPremium: number; // Premium when underlying hits Target 1
  target2EstimatedPremium: number; // Premium when underlying hits Target 2
  stopLossEstimatedPremium: number;// Premium when underlying hits Stop Loss
  expectedThetaDragPerDay: number; // Daily decay in points
  deltaGainPointsT1: number;       // Delta-driven index points contribution
}

export class OptionGreeksEngine {
  public static readonly DEFAULT_RISK_FREE_RATE = 0.065; // RBI Repo Rate: 6.5%

  /**
   * Cumulative Standard Normal Distribution Function Φ(x)
   * Using Abramowitz and Stegun rational approximation (accuracy: 1e-7).
   */
  public static normalCDF(x: number): number {
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;

    const sign = x < 0 ? -1 : 1;
    const absX = Math.abs(x) / Math.SQRT2;

    const t = 1.0 / (1.0 + p * absX);
    const y = 1.0 - (((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t) * Math.exp(-absX * absX);

    return 0.5 * (1.0 + sign * y);
  }

  /**
   * Standard Normal Probability Density Function φ(x)
   */
  public static normalPDF(x: number): number {
    return (1 / Math.sqrt(2 * Math.PI)) * Math.exp(-0.5 * x * x);
  }

  /**
   * Calculate full suite of Option Greeks for an Indian Index contract
   *
   * @param spotPrice Current underlying index spot (e.g. 24,500)
   * @param strike Strike price of option (e.g. 24,500)
   * @param optionType 'CE' or 'PE'
   * @param daysToExpiry Days until weekly/monthly expiry (e.g. 3.0 days; min: 0.05)
   * @param ivPercent Implied volatility % (e.g. 14.5% from India VIX)
   * @param riskFreeRate Annualized interest rate (default: 6.5%)
   */
  public static calculateGreeks(
    spotPrice: number,
    strike: number,
    optionType: 'CE' | 'PE',
    daysToExpiry: number = 2.0,
    ivPercent: number = 14.0,
    riskFreeRate: number = OptionGreeksEngine.DEFAULT_RISK_FREE_RATE
  ): BSMOptionGreeks {
    const S = Math.max(1, spotPrice);
    const K = Math.max(1, strike);
    const T = Math.max(0.0001, daysToExpiry / 365.0); // Time in years
    const sigma = Math.max(0.01, ivPercent / 100.0);   // Volatility
    const r = riskFreeRate;

    const sqrtT = Math.sqrt(T);
    const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * sqrtT);
    const d2 = d1 - sigma * sqrtT;

    const Nd1 = this.normalCDF(d1);
    const Nd2 = this.normalCDF(d2);
    const N_neg_d1 = this.normalCDF(-d1);
    const N_neg_d2 = this.normalCDF(-d2);
    const pdfD1 = this.normalPDF(d1);
    const exp_rT = Math.exp(-r * T);

    let theoreticalPrice: number;
    let delta: number;
    let theta: number;
    let rho: number;

    // Gamma & Vega are identical for CE and PE
    const gamma = Number((pdfD1 / (S * sigma * sqrtT)).toFixed(5));
    const vega = Number(((S * sqrtT * pdfD1) / 100).toFixed(2)); // Per 1% IV shift

    if (optionType === 'CE') {
      theoreticalPrice = S * Nd1 - K * exp_rT * Nd2;
      delta = Number(Nd1.toFixed(3));
      // 1-day theta for Call
      const thetaAnnual = -(S * pdfD1 * sigma) / (2 * sqrtT) - r * K * exp_rT * Nd2;
      theta = Number((thetaAnnual / 365).toFixed(2));
      rho = Number(((K * T * exp_rT * Nd2) / 100).toFixed(2));
    } else {
      theoreticalPrice = K * exp_rT * N_neg_d2 - S * N_neg_d1;
      delta = Number((-N_neg_d1).toFixed(3));
      // 1-day theta for Put
      const thetaAnnual = -(S * pdfD1 * sigma) / (2 * sqrtT) + r * K * exp_rT * N_neg_d2;
      theta = Number((thetaAnnual / 365).toFixed(2));
      rho = Number(((-K * T * exp_rT * N_neg_d2) / 100).toFixed(2));
    }

    theoreticalPrice = Math.max(0.05, Number(theoreticalPrice.toFixed(2)));

    // Categorize Moneyness
    const strikeDistancePct = ((S - K) / S) * 100;
    let moneyness: BSMOptionGreeks['moneyness'] = 'ATM';
    if (optionType === 'CE') {
      if (strikeDistancePct > 2.0) moneyness = 'DEEP_ITM';
      else if (strikeDistancePct > 0.4) moneyness = 'ITM';
      else if (strikeDistancePct >= -0.4) moneyness = 'ATM';
      else if (strikeDistancePct >= -2.0) moneyness = 'OTM';
      else moneyness = 'DEEP_OTM';
    } else {
      if (strikeDistancePct < -2.0) moneyness = 'DEEP_ITM';
      else if (strikeDistancePct < -0.4) moneyness = 'ITM';
      else if (strikeDistancePct <= 0.4) moneyness = 'ATM';
      else if (strikeDistancePct <= 2.0) moneyness = 'OTM';
      else moneyness = 'DEEP_OTM';
    }

    return {
      delta,
      gamma,
      theta,
      vega,
      rho,
      theoreticalPrice,
      impliedVolatility: ivPercent,
      daysToExpiry: Number(daysToExpiry.toFixed(2)),
      moneyness,
    };
  }

  /**
   * Project Option Premiums at Target 1, Target 2, and Stop Loss using 2nd-order Taylor Series (Delta + 0.5*Gamma - Theta)
   *
   * Formula:
   * dPrice ≈ (Delta * dSpot) + (0.5 * Gamma * dSpot^2) - (Theta * daysHeld)
   */
  public static projectOptionTargets(
    spotEntry: number,
    target1Spot: number,
    target2Spot: number,
    stopLossSpot: number,
    strike: number,
    action: 'BUY_CE' | 'BUY_PE',
    vix: number = 14.0,
    daysToExpiry: number = 2.0,
    expectedHoldingDays: number = 0.2 // ~1.5 hours intraday
  ): OptionTargetProjection {
    const isCE = action === 'BUY_CE';
    const greeks = this.calculateGreeks(spotEntry, strike, isCE ? 'CE' : 'PE', daysToExpiry, vix);

    const basePremium = greeks.theoreticalPrice;
    const delta = Math.abs(greeks.delta);
    const gamma = greeks.gamma;
    const thetaDrag = Math.abs(greeks.theta) * expectedHoldingDays;

    // Target 1 Spot Move
    const dSpotT1 = Math.abs(target1Spot - spotEntry);
    const premiumGainT1 = delta * dSpotT1 + 0.5 * gamma * Math.pow(dSpotT1, 2) - thetaDrag;
    const target1Premium = Number(Math.max(0.5, basePremium + premiumGainT1).toFixed(2));

    // Target 2 Spot Move
    const dSpotT2 = Math.abs(target2Spot - spotEntry);
    const premiumGainT2 = delta * dSpotT2 + 0.5 * gamma * Math.pow(dSpotT2, 2) - thetaDrag;
    const target2Premium = Number(Math.max(0.5, basePremium + premiumGainT2).toFixed(2));

    // Stop Loss Spot Move (Adverse move)
    const dSpotSL = Math.abs(spotEntry - stopLossSpot);
    const premiumLossSL = delta * dSpotSL - 0.5 * gamma * Math.pow(dSpotSL, 2) + thetaDrag;
    const stopLossPremium = Number(Math.max(0.1, basePremium - premiumLossSL).toFixed(2));

    return {
      currentEstimatedPremium: basePremium,
      target1EstimatedPremium: target1Premium,
      target2EstimatedPremium: target2Premium,
      stopLossEstimatedPremium: stopLossPremium,
      expectedThetaDragPerDay: Math.abs(greeks.theta),
      deltaGainPointsT1: Number((delta * dSpotT1).toFixed(2)),
    };
  }

  /**
   * Helper: Estimate Days Until Expiry (Assuming Thursday Weekly Expiry at 15:30 IST)
   */
  public static estimateDaysToExpiry(istDate: Date = new Date()): number {
    const day = istDate.getDay(); // 0 Sun, 1 Mon, 2 Tue, 3 Wed, 4 Thu, 5 Fri, 6 Sat
    const hours = istDate.getHours();
    const minutes = istDate.getMinutes();
    const timeOfDayFraction = (hours + minutes / 60) / 24;

    // NSE Weekly Expiry is Thursday (day 4) at 15:30 IST
    let daysUntilThursday = (4 - day + 7) % 7;
    if (daysUntilThursday === 0 && (hours > 15 || (hours === 15 && minutes >= 30))) {
      daysUntilThursday = 7; // Next week's expiry
    }

    const totalDays = Math.max(0.1, daysUntilThursday + (15.5 / 24 - timeOfDayFraction));
    return Number(totalDays.toFixed(2));
  }
}
