/**
 * Option Chain Analytics & Put-Call Ratio (PCR) Engine
 *
 * Implements:
 * 1. Total Put OI / Total Call OI (PCR) Calculation
 * 2. Real-time Sentiment Classification:
 *    - PCR > 1.25: EXTREME_BULLISH (Heavy Put writing / strong floor)
 *    - PCR 1.05 - 1.25: BULLISH_BIAS (Puts outnumber Calls)
 *    - PCR 0.85 - 1.05: NEUTRAL_BALANCED (Equal Call/Put contest)
 *    - PCR 0.70 - 0.85: BEARISH_BIAS (Call writers dominant)
 *    - PCR < 0.70: EXTREME_BEARISH (Heavy Call writing / strong ceiling)
 * 3. Max Pain Strike calculation (Strike minimizing option writers' total payout)
 * 4. Highest Call OI Strike (Major Resistance Level)
 * 5. Highest Put OI Strike (Major Support Level)
 */

export interface OptionStrikeData {
  strike: number;
  callOI: number;
  putOI: number;
  callLtp: number;
  putLtp: number;
  callChangeOI: number;
  putChangeOI: number;
  isAtm?: boolean;
}

export type PcrSentiment = 'EXTREME_BULLISH' | 'BULLISH' | 'NEUTRAL' | 'BEARISH' | 'EXTREME_BEARISH';

export interface OptionChainAnalysis {
  pcr: number;
  sentiment: PcrSentiment;
  sentimentLabel: string;
  recommendation: string;
  maxPainStrike: number;
  highestCallOIStrike: number; // Primary Resistance
  highestPutOIStrike: number;  // Primary Support
  totalCallOI: number;
  totalPutOI: number;
  underlyingPrice: number;
  atmStrike: number;
  strikes: OptionStrikeData[];
}

export class OptionChainEngine {
  /**
   * Evaluate full option chain data and compute PCR + Max Pain
   */
  public static analyze(underlyingPrice: number, strikesData: OptionStrikeData[]): OptionChainAnalysis {
    if (!strikesData || strikesData.length === 0) {
      return this.generateSyntheticChain(underlyingPrice);
    }

    let totalCallOI = 0;
    let totalPutOI = 0;
    let maxCallOI = 0;
    let maxPutOI = 0;
    let highestCallOIStrike = strikesData[0].strike;
    let highestPutOIStrike = strikesData[0].strike;

    // Find ATM strike
    let closestDiff = Infinity;
    let atmStrike = strikesData[0].strike;

    for (const item of strikesData) {
      totalCallOI += item.callOI;
      totalPutOI += item.putOI;

      if (item.callOI > maxCallOI) {
        maxCallOI = item.callOI;
        highestCallOIStrike = item.strike;
      }

      if (item.putOI > maxPutOI) {
        maxPutOI = item.putOI;
        highestPutOIStrike = item.strike;
      }

      const diff = Math.abs(item.strike - underlyingPrice);
      if (diff < closestDiff) {
        closestDiff = diff;
        atmStrike = item.strike;
      }
    }

    // Mark ATM
    strikesData.forEach(s => {
      s.isAtm = s.strike === atmStrike;
    });

    const pcr = totalCallOI > 0 ? Number((totalPutOI / totalCallOI).toFixed(2)) : 1.0;

    // Calculate Max Pain
    const maxPainStrike = this.calculateMaxPain(strikesData);

    // Sentiment Classification
    let sentiment: PcrSentiment = 'NEUTRAL';
    let sentimentLabel = 'तटस्थ (Neutral)';
    let recommendation = 'कॉल आणि पुट रायटर्समध्ये समान स्पर्धा आहे. ब्रेकआउटची वाट पहा.';

    if (pcr >= 1.25) {
      sentiment = 'EXTREME_BULLISH';
      sentimentLabel = 'अतिशय बुलिश (Extreme Bullish)';
      recommendation = 'मोठे पुट रायटिंग (Strong Support). मार्केटमध्ये खालून मोठी खरेदी येण्याची दाट शक्यता.';
    } else if (pcr >= 1.05) {
      sentiment = 'BULLISH';
      sentimentLabel = 'बुलिश (Bullish Bias)';
      recommendation = 'पुट रायटर्सचे वर्चस्व आहे. डिप्सवर खरेदी करणे (Buy on Dips) फायदेशीर ठरेल.';
    } else if (pcr <= 0.65) {
      sentiment = 'EXTREME_BEARISH';
      sentimentLabel = 'अतिशय बेअरिश (Extreme Bearish)';
      recommendation = 'मोठे कॉल रायटिंग (Strong Resistance). वरच्या पातळीवर जोरदार विक्रीचा दबाव राहील.';
    } else if (pcr <= 0.85) {
      sentiment = 'BEARISH';
      sentimentLabel = 'बेअरिश (Bearish Bias)';
      recommendation = 'कॉल रायटर्सचे वर्चस्व. रॅलीवर पुट (Sell on Rise / Buy PE) चा विचार करा.';
    }

    return {
      pcr,
      sentiment,
      sentimentLabel,
      recommendation,
      maxPainStrike,
      highestCallOIStrike,
      highestPutOIStrike,
      totalCallOI,
      totalPutOI,
      underlyingPrice,
      atmStrike,
      strikes: strikesData,
    };
  }

  /**
   * Max Pain Calculation:
   * For every strike S, calculate total loss of option buyers (or payout by writers)
   * if market expires at S:
   * Payout = Sum(CallOI * Max(0, S - Strike)) + Sum(PutOI * Max(0, Strike - S))
   * Max Pain is the strike S that MINIMIZES this payout.
   */
  public static calculateMaxPain(strikes: OptionStrikeData[]): number {
    if (!strikes || strikes.length === 0) return 0;

    let minTotalPayout = Infinity;
    let maxPainStrike = strikes[0].strike;

    for (const targetStrike of strikes) {
      let currentPayout = 0;
      for (const s of strikes) {
        // Call buyers gain if targetStrike > strike
        if (targetStrike.strike > s.strike) {
          currentPayout += s.callOI * (targetStrike.strike - s.strike);
        }
        // Put buyers gain if targetStrike < strike
        if (targetStrike.strike < s.strike) {
          currentPayout += s.putOI * (s.strike - targetStrike.strike);
        }
      }

      if (currentPayout < minTotalPayout) {
        minTotalPayout = currentPayout;
        maxPainStrike = targetStrike.strike;
      }
    }

    return maxPainStrike;
  }

  /**
   * Generate realistic option chain baseline data around spot price
   */
  public static generateSyntheticChain(spotPrice: number): OptionChainAnalysis {
    // Determine strike step (50 for Nifty, 100 for Bank Nifty / Sensex)
    const step = spotPrice > 35000 ? 100 : 50;
    const atm = Math.round(spotPrice / step) * step;
    const strikes: OptionStrikeData[] = [];

    // 9 strikes: 4 OTM Calls, ATM, 4 OTM Puts
    for (let i = -4; i <= 4; i++) {
      const strike = atm + i * step;
      const distanceFromAtm = Math.abs(i);
      
      // Typical OI distribution: higher OI at round numbers & slightly OTM
      const callBase = 120000 - i * 12000;
      const putBase = 125000 + i * 15000;
      const callOI = Math.max(15000, Math.floor(callBase * (1 - distanceFromAtm * 0.12)));
      const putOI = Math.max(18000, Math.floor(putBase * (1 - distanceFromAtm * 0.11)));

      // Approximate option premiums
      const isCallItm = strike < spotPrice;
      const isPutItm = strike > spotPrice;
      const intrinsicCall = isCallItm ? spotPrice - strike : 0;
      const intrinsicPut = isPutItm ? strike - spotPrice : 0;
      const timeVal = Math.max(25, (120 - distanceFromAtm * 20));

      strikes.push({
        strike,
        callOI,
        putOI,
        callLtp: Number((intrinsicCall + timeVal).toFixed(1)),
        putLtp: Number((intrinsicPut + timeVal * 0.95).toFixed(1)),
        callChangeOI: Math.floor((Math.random() - 0.4) * 8000),
        putChangeOI: Math.floor((Math.random() - 0.35) * 11000),
        isAtm: strike === atm,
      });
    }

    return this.analyze(spotPrice, strikes);
  }
}
