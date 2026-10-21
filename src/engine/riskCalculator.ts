/**
 * Position Sizing & Risk Management Calculator for Indian Index Options
 *
 * Official NSE & BSE Lot Sizes:
 * - NIFTY 50: 25 (or 50)
 * - BANK NIFTY: 15
 * - FINNIFTY: 25
 * - SENSEX: 10
 */

export interface PositionSizingInput {
  capital: number;           // Total trading capital in ₹ (e.g. 50,000)
  riskPercentage: number;    // Max risk per trade % (e.g. 2%)
  instrument: 'NIFTY 50' | 'BANK NIFTY' | 'FINNIFTY' | 'SENSEX';
  optionEntryPrice: number;  // Estimated Option Entry Premium (₹)
  optionStopLossPrice: number; // Option SL Premium (₹)
  optionTarget1Price?: number; // Option Target 1 Premium (₹)
  optionTarget2Price?: number; // Option Target 2 Premium (₹)
}

export interface PositionSizingResult {
  lotSize: number;           // Quantity per lot (e.g. 25, 15, 10)
  maxAllowedRiskAmount: number; // Capital * (Risk % / 100)
  pointsAtRisk: number;      // Entry - SL
  riskPerLot: number;        // pointsAtRisk * lotSize
  recommendedLots: number;   // Max lots within risk and capital constraints
  totalQuantity: number;     // recommendedLots * lotSize
  totalCapitalRequired: number; // totalQuantity * optionEntryPrice
  totalActualRiskAmount: number; // totalQuantity * pointsAtRisk
  target1RewardAmount: number; // totalQuantity * (T1 - Entry)
  target2RewardAmount: number; // totalQuantity * (T2 - Entry)
  riskRewardRatio: string;
  advice: string;
}

export class RiskCalculator {
  public static readonly LOT_SIZES: Record<string, number> = {
    'NIFTY 50': 25,
    'BANK NIFTY': 15,
    'FINNIFTY': 25,
    'SENSEX': 10,
  };

  public static calculate(input: PositionSizingInput): PositionSizingResult {
    const {
      capital,
      riskPercentage,
      instrument,
      optionEntryPrice,
      optionStopLossPrice,
      optionTarget1Price,
      optionTarget2Price,
    } = input;

    const lotSize = this.LOT_SIZES[instrument] || 25;
    const maxAllowedRiskAmount = Number(((capital * riskPercentage) / 100).toFixed(2));
    
    // Points at risk per option share (minimum 1.0 point to prevent div by zero)
    const pointsAtRisk = Math.max(1, Number((optionEntryPrice - optionStopLossPrice).toFixed(2)));
    const riskPerLot = Number((pointsAtRisk * lotSize).toFixed(2));

    // Calculate maximum lots by risk limit
    let lotsByRisk = Math.floor(maxAllowedRiskAmount / riskPerLot);

    // Calculate maximum lots by total capital available
    const costPerLot = optionEntryPrice * lotSize;
    let lotsByCapital = costPerLot > 0 ? Math.floor(capital / costPerLot) : 1;

    // Constrained recommended lots (at least 1 lot if affordable, capped by risk)
    let recommendedLots = Math.max(1, Math.min(lotsByRisk > 0 ? lotsByRisk : 1, lotsByCapital));

    // If even 1 lot exceeds 100% capital, cap to 0 or 1
    if (costPerLot > capital) {
      recommendedLots = 1;
    }

    const totalQuantity = recommendedLots * lotSize;
    const totalCapitalRequired = Number((totalQuantity * optionEntryPrice).toFixed(2));
    const totalActualRiskAmount = Number((totalQuantity * pointsAtRisk).toFixed(2));

    const t1 = optionTarget1Price || (optionEntryPrice + pointsAtRisk * 1.5);
    const t2 = optionTarget2Price || (optionEntryPrice + pointsAtRisk * 2.0);

    const target1RewardAmount = Number((totalQuantity * Math.max(0, t1 - optionEntryPrice)).toFixed(2));
    const target2RewardAmount = Number((totalQuantity * Math.max(0, t2 - optionEntryPrice)).toFixed(2));

    let advice = '✅ योग्य पोझिशन साईझिंग. भांडवलाच्या २% पेक्षा कमी जोखीम आहे.';
    if (totalActualRiskAmount > maxAllowedRiskAmount * 1.5) {
      advice = '⚠️ सावध: १ लॉट घेतल्यास रिस्क बजेटपेक्षा जास्त होत आहे. स्टॉप लॉस लहान ठेवा.';
    }

    return {
      lotSize,
      maxAllowedRiskAmount,
      pointsAtRisk,
      riskPerLot,
      recommendedLots,
      totalQuantity,
      totalCapitalRequired,
      totalActualRiskAmount,
      target1RewardAmount,
      target2RewardAmount,
      riskRewardRatio: '1:1.5 - 1:2.0',
      advice,
    };
  }
}
