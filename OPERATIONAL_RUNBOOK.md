# Market Signal Application — Operational Runbook & Deployment Guide

## 1. Project Overview & Architecture
* **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS + TradingView Lightweight Charts
* **Market Data Provider**: Groww Trade API (Official 5m Closed Candles & LTP)
* **Rule Engine**: 8 Price Action Candlestick Patterns + Pivot Support/Resistance (R1, R2, S1, S2, PP)
* **Database & Source of Truth**: Supabase PostgreSQL + RLS + Realtime
* **Alert Delivery**: Telegram Bot API with Exponential Retry Backoff & Idempotency Keying

---

## 2. Free-Tier Honesty Report (Section 11)

| Platform | Free Tier Capability | Real-world Limitation | Mitigation Strategy |
|---|---|---|---|
| **Render Static Site** | 100 GB bandwidth / mo, Unlimited free deploys | Zero cost, fast CDN | Deploy frontend as Static Site (`optionmarketchart-web`). |
| **Render Web Service** (if using worker) | 750 free hours / mo | Spins down (sleeps) after 15 mins of inactivity; takes ~50s to wake up | Frontend executes evaluations on closed 5m candles in browser; alternatively use UptimeRobot / Cron to keep active. |
| **Supabase Free** | 500 MB DB storage, 50k monthly active users | Project is automatically paused after 7 days of complete inactivity | A weekly signal evaluation or dashboard visit resets the 7-day activity counter. |
| **Groww / Broker API** | Free market data quote & 5m historical candles | Daily session access token expires | Enter / update bearer token in morning before 09:15 IST using the Dashboard modal. |

---

## 3. Daily Operational Checklist (09:00 - 09:15 IST)

1. **09:05 AM IST**: Open the Dashboard URL.
2. **09:07 AM IST**: Check **Groww API** status:
   * Click **Enter/Update** and paste your valid Bearer Access Token.
   * Verify the indicator turns green: `LIVE DATA (GROWW API)`.
3. **09:10 AM IST**: Verify Telegram Bot status:
   * Verify status says `Telegram: Active` (Bot Token & Chat ID).
   * Click **Send Test Alert** to verify bot communication.
4. **09:15 AM - 03:30 PM IST**: System automatically evaluates closed 5m candles:
   * First candle evaluates at 09:20:00 IST (first closed 5m candle).
   * Minimum 15-minute cooldown between same-direction signals.
   * Maximum 3 signals per instrument per trading day.

---

## 4. Render Deployment via Python Script

### Command:
```bash
python scripts/deploy_render.py <YOUR_RENDER_API_KEY>
```

Or set the environment variable:
```bash
$env:RENDER_API_KEY="rnd_xxxxxxx"
python scripts/deploy_render.py
```

The script will:
1. Authenticate with Render REST API (`https://api.render.com/v1`).
2. Verify project `prj-dbbhf4e7bikc738j76a0`.
3. Create or trigger live deployment for Static Site `optionmarketchart-web`.
4. Output your live production URL.

---

## 5. Verification & Testing

To run the automated test suite locally:
```bash
npm test
```
Result: 9 / 9 Unit tests passing.

To test production build:
```bash
npm run build
```
Result: Minified bundle in `dist/` ready for global CDN delivery.
