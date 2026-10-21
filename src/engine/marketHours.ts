/**
 * Indian Stock Market (NSE) Trading Hours & Session Engine
 * Official Hours: Monday - Friday, 09:15 AM to 03:30 PM IST
 */

export interface MarketSessionInfo {
  isOpen: boolean;
  statusLabel: string;
  sessionClosingTimestamp: number; // Unix timestamp in seconds of 15:30:00 IST
  lastCandleTimestamp: number;      // Unix timestamp of the latest closed 5M candle
  formattedDateTimeIST: string;     // e.g. "03:30:00 pm (Market Close)"
  sessionDateIST: string;           // "YYYY-MM-DD"
  isWeekend: boolean;
  isHoliday: boolean;
  nextSessionOpenIST: string;
}

export const NSE_HOLIDAYS_2026: string[] = [
  '2026-01-26', // Republic Day
  '2026-02-17', // Mahashivratri
  '2026-03-03', // Holi
  '2026-03-20', // Id-ul-Fitr
  '2026-03-31', // Mahavir Jayanti
  '2026-04-03', // Good Friday
  '2026-04-14', // Dr. Ambedkar Jayanti
  '2026-05-01', // Maharashtra Day
  '2026-08-15', // Independence Day
  '2026-10-02', // Gandhi Jayanti
  '2026-10-20', // Dussehra
  '2026-11-10', // Diwali Balipratipada
  '2026-11-24', // Guru Nanak Jayanti
  '2026-12-25', // Christmas
];

export class MarketHoursHelper {
  /**
   * Check if current time in IST is within active NSE market hours (09:15 - 15:30 IST)
   */
  public static getSessionInfo(): MarketSessionInfo {
    const now = new Date();
    // Get current time in Indian Standard Time (IST)
    const istString = now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });
    const istDate = new Date(istString);
    const day = istDate.getDay(); // 0 is Sunday, 6 is Saturday
    const hours = istDate.getHours();
    const minutes = istDate.getMinutes();
    const totalMinutes = hours * 60 + minutes;

    const marketOpenMinutes = 9 * 60 + 15;  // 09:15 IST
    const marketCloseMinutes = 15 * 60 + 30; // 15:30 IST

    const isWeekend = day === 0 || day === 6;
    const yyyy = istDate.getFullYear();
    const mm = String(istDate.getMonth() + 1).padStart(2, '0');
    const dd = String(istDate.getDate()).padStart(2, '0');
    const todayStr = `${yyyy}-${mm}-${dd}`;
    const isHoliday = NSE_HOLIDAYS_2026.includes(todayStr);

    const isOpen = !isWeekend && !isHoliday && totalMinutes >= marketOpenMinutes && totalMinutes < marketCloseMinutes;

    // Determine the trading day date
    const tradingDate = new Date(istDate);
    if (isWeekend) {
      const daysBack = day === 0 ? 2 : 1;
      tradingDate.setDate(tradingDate.getDate() - daysBack);
    } else if (totalMinutes < marketOpenMinutes) {
      const daysBack = day === 1 ? 3 : 1;
      tradingDate.setDate(tradingDate.getDate() - daysBack);
    }

    const tYyyy = tradingDate.getFullYear();
    const tMm = String(tradingDate.getMonth() + 1).padStart(2, '0');
    const tDd = String(tradingDate.getDate()).padStart(2, '0');
    const sessionDateIST = `${tYyyy}-${tMm}-${tDd}`;

    // 15:30:00 IST in UTC is 10:00:00 UTC (15:30 - 5:30 = 10:00)
    const sessionCloseEpochMs = Date.UTC(
      tradingDate.getFullYear(),
      tradingDate.getMonth(),
      tradingDate.getDate(),
      10,
      0,
      0
    );
    const sessionClosingTimestamp = Math.floor(sessionCloseEpochMs / 1000);

    let lastCandleTimestamp: number;
    let formattedDateTimeIST: string;

    if (isOpen) {
      // Current live candle rounded down to last completed 5-min closed candle
      const nowSec = Math.floor(now.getTime() / 1000);
      lastCandleTimestamp = nowSec - (nowSec % 300);
      formattedDateTimeIST = new Date(lastCandleTimestamp * 1000).toLocaleTimeString('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } else {
      // Market closed -> Last candle is the 15:25-15:30 close of the trading day
      lastCandleTimestamp = sessionClosingTimestamp;
      formattedDateTimeIST = '03:30:00 pm (मार्केट बंद / Market Close)';
    }

    let statusLabel = '🔴 मार्केट बंद आहे (NSE Closed at 3:30 PM)';
    if (isOpen) {
      statusLabel = '🟢 LIVE MARKET (09:15 - 15:30 IST)';
    } else if (isWeekend) {
      statusLabel = '🔴 आठवडा सुट्टी (Weekend: NSE Closed)';
    } else if (isHoliday) {
      statusLabel = '🔴 मार्केट सुट्टी (Trading Holiday)';
    }

    return {
      isOpen,
      statusLabel,
      sessionClosingTimestamp,
      lastCandleTimestamp,
      formattedDateTimeIST,
      sessionDateIST,
      isWeekend,
      isHoliday,
      nextSessionOpenIST: 'उद्या सकाळी 09:15 AM IST',
    };
  }
}
