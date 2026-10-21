/**
 * Central Pivot Range (CPR) & Daily Trend Predictor Engine
 *
 * Formulas:
 * Pivot (P) = (High + Low + Close) / 3
 * Bottom Central Pivot (BC) = (High + Low) / 2
 * Top Central Pivot (TC) = (Pivot - BC) + Pivot = 2 * Pivot - BC
 *
 * Width Classification:
 * CPR Width % = (|TC - BC| / Pivot) * 100
 * - Narrow CPR (< 0.15%): High probability Trending / Momentum Day (Breakout setups favored)
 * - Medium CPR (0.15% - 0.35%): Normal Day with balanced trend and pullbacks
 * - Wide CPR (> 0.35%): High probability Sideways / Chop / Range-bound Day (Mean reversion favored)
 *
 * Virgin CPR:
 * A CPR band that has not been touched by any candle in the session acts as a high-probability magnet and support/resistance.
 */

export type CprWidthCategory = 'NARROW_CPR' | 'MEDIUM_CPR' | 'WIDE_CPR';

export interface CprLevels {
  pivot: number;
  bc: number; // Bottom Central
  tc: number; // Top Central
  cprTop: number; // Max(TC, BC)
  cprBottom: number; // Min(TC, BC)
  cprWidth: number;
  cprWidthPercent: number;
  category: CprWidthCategory;
  prediction: {
    dayType: 'TRENDING_DAY' | 'NORMAL_DAY' | 'SIDEWAYS_DAY';
    recommendation: string;
    bias: 'FAVOR_BREAKOUTS' | 'FAVOR_PULLBACKS' | 'FAVOR_REVERSALS_SELL_HIGH_BUY_LOW';
  };
  r1: number;
  r2: number;
  r3: number;
  s1: number;
  s2: number;
  s3: number;
  isVirginCPR?: boolean;
}

export class CprEngine {
  /**
   * Calculate Central Pivot Range from previous session's High, Low, Close
   */
  public static calculate(high: number, low: number, close: number, currentCandleHighLow?: { high: number; low: number }[]): CprLevels {
    const pivot = (high + low + close) / 3;
    const bc = (high + low) / 2;
    const tc = 2 * pivot - bc;

    const cprTop = Math.max(tc, bc);
    const cprBottom = Math.min(tc, bc);
    const cprWidth = Math.abs(tc - bc);
    const cprWidthPercent = Number(((cprWidth / pivot) * 100).toFixed(3));

    // Classical Floor Pivot Support & Resistance
    const r1 = 2 * pivot - low;
    const s1 = 2 * pivot - high;
    const r2 = pivot + (high - low);
    const s2 = pivot - (high - low);
    const r3 = high + 2 * (pivot - low);
    const s3 = low - 2 * (high - pivot);

    let category: CprWidthCategory = 'MEDIUM_CPR';
    let dayType: 'TRENDING_DAY' | 'NORMAL_DAY' | 'SIDEWAYS_DAY' = 'NORMAL_DAY';
    let recommendation = 'संतुलित दिवस: ब्रेकआउट आणि पुलबॅक दोन्ही ट्रेड शक्य आहेत.';
    let bias: 'FAVOR_BREAKOUTS' | 'FAVOR_PULLBACKS' | 'FAVOR_REVERSALS_SELL_HIGH_BUY_LOW' = 'FAVOR_PULLBACKS';

    if (cprWidthPercent < 0.15) {
      category = 'NARROW_CPR';
      dayType = 'TRENDING_DAY';
      recommendation = '🚀 बारीक CPR (Narrow Range): आज मार्केट मोठा एका दिशेचा ट्रेंड (Trending Move) देण्याची दाट शक्यता आहे. ब्रेकआउटवर लक्ष ठेवा.';
      bias = 'FAVOR_BREAKOUTS';
    } else if (cprWidthPercent > 0.35) {
      category = 'WIDE_CPR';
      dayType = 'SIDEWAYS_DAY';
      recommendation = '↔ रुंद CPR (Wide Range): आज मार्केट दोन्ही बाजूंनी रेंजबाउंड / चॉपी (Sideways) राहण्याची शक्यता आहे. सपोर्टवर बाय आणि रेझिस्टन्सवर सेल करा.';
      bias = 'FAVOR_REVERSALS_SELL_HIGH_BUY_LOW';
    } else {
      category = 'MEDIUM_CPR';
      dayType = 'NORMAL_DAY';
      recommendation = '⚖ मध्यम CPR (Average Range): सामान्य मार्केट ट्रेंड. २-३ चांगल्या मूव्ह्स मिळतील.';
      bias = 'FAVOR_PULLBACKS';
    }

    // Check if CPR is Virgin (Untested)
    let isVirginCPR = true;
    if (currentCandleHighLow && currentCandleHighLow.length > 0) {
      for (const bar of currentCandleHighLow) {
        if (bar.high >= cprBottom && bar.low <= cprTop) {
          isVirginCPR = false;
          break;
        }
      }
    }

    return {
      pivot: Number(pivot.toFixed(2)),
      bc: Number(bc.toFixed(2)),
      tc: Number(tc.toFixed(2)),
      cprTop: Number(cprTop.toFixed(2)),
      cprBottom: Number(cprBottom.toFixed(2)),
      cprWidth: Number(cprWidth.toFixed(2)),
      cprWidthPercent,
      category,
      prediction: {
        dayType,
        recommendation,
        bias,
      },
      r1: Number(r1.toFixed(2)),
      r2: Number(r2.toFixed(2)),
      r3: Number(r3.toFixed(2)),
      s1: Number(s1.toFixed(2)),
      s2: Number(s2.toFixed(2)),
      s3: Number(s3.toFixed(2)),
      isVirginCPR,
    };
  }
}
