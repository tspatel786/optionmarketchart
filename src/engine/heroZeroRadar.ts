/**
 * Expiry Day "Hero or Zero" Setup Radar Engine
 * Identifies high-risk high-reward gamma squeeze momentum setups on weekly expiry afternoons.
 *
 * Updated Weekly Expiry Calendar (SEBI & Indian Exchanges Rules):
 * - Monday: MIDCPNIFTY
 * - Tuesday: NIFTY 50 (मंगळवार)
 * - Wednesday: BANK NIFTY (बुधवार)
 * - Thursday: SENSEX (गुरूवार)
 * - Friday: FINNIFTY (शुक्रवार)
 */

export interface HeroZeroSetup {
  instrument: string;
  strike: number;
  optionType: 'CE' | 'PE';
  contractName: string;
  currentPremium: number;      // ₹15 - ₹35 entry zone
  stopLoss: number;            // ₹5 - ₹8 strictly defined SL
  target1: number;             // 2x Return (₹40 - ₹55)
  target2: number;             // 3x-5x Return (₹70 - ₹120)
  riskReward: string;          // e.g. "1:3.5"
  maxRiskPerLot: number;       // ₹ (Entry - SL) * LotSize
  potentialProfitPerLot: number; // ₹ (T1 - Entry) * LotSize
  triggerCondition: string;    // Trigger rule
  status: 'ACTIVE_RADAR' | 'WATCHING' | 'TRIGGERED';
}

export interface HeroZeroRadarResult {
  isExpiryDay: boolean;
  expiryInstrument: string;
  todayDayName: string;
  isPowerHourActive: boolean;  // 1:15 PM - 3:15 PM IST
  powerHourMessage: string;
  setups: HeroZeroSetup[];
  rulesAndPrecautions: string[];
}

export class HeroZeroRadarEngine {
  public static readonly EXPIRY_DAYS: Record<number, string> = {
    1: 'MIDCPNIFTY', // Monday (सोमवार)
    2: 'NIFTY 50',   // Tuesday (मंगळवार - SEBI New Rules & User Specification)
    3: 'BANK NIFTY', // Wednesday (बुधवार)
    4: 'SENSEX',     // Thursday (गुरूवार - BSE Update & User Specification)
    5: 'FINNIFTY',   // Friday (शुक्रवार)
  };

  public static readonly LOT_SIZES: Record<string, number> = {
    'NIFTY 50': 25,
    'BANK NIFTY': 15,
    'FINNIFTY': 25,
    'SENSEX': 10,
  };

  /**
   * Scan and evaluate Hero-Zero setups for given instrument and spot price
   */
  public static evaluateRadar(
    currentInstrument: string,
    spotPrice: number
  ): HeroZeroRadarResult {
    const now = new Date();
    const istString = now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });
    const istDate = new Date(istString);
    const dayOfWeek = istDate.getDay();
    const hours = istDate.getHours();
    const minutes = istDate.getMinutes();
    const timeInMins = hours * 60 + minutes;

    const expiryInstrument = this.EXPIRY_DAYS[dayOfWeek] || 'NIFTY 50';
    const isExpiryDay = currentInstrument.toUpperCase().includes(expiryInstrument.toUpperCase()) ||
                        expiryInstrument.toUpperCase().includes(currentInstrument.toUpperCase());

    const days = ['रविवार', 'सोमवार', 'मंगळवार', 'बुधवार', 'गुरूवार', 'शुक्रवार', 'शनिवार'];
    const todayDayName = days[dayOfWeek] || 'आज';

    // Power hour: 13:15 to 15:15 IST
    const powerHourStart = 13 * 60 + 15;
    const powerHourEnd = 15 * 60 + 15;
    const isPowerHourActive = timeInMins >= powerHourStart && timeInMins <= powerHourEnd;

    let powerHourMessage = 'दुपारी ०१:१५ ते ०३:१५ हा गॅमा मोमेंटमसाठी गोल्डन टाईम असतो.';
    if (isPowerHourActive) {
      powerHourMessage = '⚡ पॉवर अवर सुरू आहे (1:15 PM - 3:15 PM)! शॉर्ट कव्हरिंग गॅमा स्पाइक सक्रिय होऊ शकतो.';
    } else if (timeInMins < powerHourStart) {
      powerHourMessage = 'पॉवर अवर दुपारी ०१:१५ वाजता सुरू होईल. तोपर्यंत ओव्हरट्रेडिंग टाळा.';
    } else {
      powerHourMessage = 'आजचे एक्सपायरी सेशन पूर्ण झाले आहे.';
    }

    const step = spotPrice > 35000 ? 100 : 50;
    const atmStrike = Math.round(spotPrice / step) * step;
    const lotSize = this.LOT_SIZES[currentInstrument] || 25;

    const setups: HeroZeroSetup[] = [];

    // Setup 1: Call Option (CE) Hero-Zero (1 strike OTM)
    const ceStrike = atmStrike + step;
    const ceEntry = 22;
    const ceSl = 7;
    const ceT1 = 55;
    const ceT2 = 90;
    const ceRiskPerLot = (ceEntry - ceSl) * lotSize;
    const ceProfitT1 = (ceT1 - ceEntry) * lotSize;

    setups.push({
      instrument: currentInstrument,
      strike: ceStrike,
      optionType: 'CE',
      contractName: `${currentInstrument} ${ceStrike} CE`,
      currentPremium: ceEntry,
      stopLoss: ceSl,
      target1: ceT1,
      target2: ceT2,
      riskReward: '1:3.2',
      maxRiskPerLot: ceRiskPerLot,
      potentialProfitPerLot: ceProfitT1,
      triggerCondition: `Spot ₹${(ceStrike - step * 0.3).toFixed(0)} च्या वर टिकल्यास आणि १५-मिनिट डे हाय ब्रेक झाल्यावर.`,
      status: isPowerHourActive ? 'ACTIVE_RADAR' : 'WATCHING',
    });

    // Setup 2: Put Option (PE) Hero-Zero (1 strike OTM)
    const peStrike = atmStrike - step;
    const peEntry = 24;
    const peSl = 8;
    const peT1 = 60;
    const peT2 = 105;
    const peRiskPerLot = (peEntry - peSl) * lotSize;
    const peProfitT1 = (peT1 - peEntry) * lotSize;

    setups.push({
      instrument: currentInstrument,
      strike: peStrike,
      optionType: 'PE',
      contractName: `${currentInstrument} ${peStrike} PE`,
      currentPremium: peEntry,
      stopLoss: peSl,
      target1: peT1,
      target2: peT2,
      riskReward: '1:3.3',
      maxRiskPerLot: peRiskPerLot,
      potentialProfitPerLot: peProfitT1,
      triggerCondition: `Spot ₹${(peStrike + step * 0.3).toFixed(0)} च्या खाली घसरल्यास आणि १५-मिनिट डे लो तुटल्यावर.`,
      status: isPowerHourActive ? 'ACTIVE_RADAR' : 'WATCHING',
    });

    const rulesAndPrecautions = [
      'फक्त अतिरिक्त / रिस्क घेऊ शकता अशाच भांडवलाने (₹५०० ते ₹१,५००) ट्रेड करा.',
      'कधीही मोठे लॉट्स घेऊ नका; १ किंवा २ लॉट पुरेसे असतात.',
      'दुपारी १:१५ नंतर मार्केट एका दिशेने ब्रेकआउट देत असतानाच एन्ट्री घ्या.',
      'प्रीमियम दुप्पट (Target 1) होताच ५०% नफा बुक करा आणि उर्वरित कॉस्टवर ट्रेल करा.',
    ];

    return {
      isExpiryDay,
      expiryInstrument,
      todayDayName,
      isPowerHourActive,
      powerHourMessage,
      setups,
      rulesAndPrecautions,
    };
  }
}
