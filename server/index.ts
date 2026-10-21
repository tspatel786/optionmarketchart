import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { worker } from './worker';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.resolve(__dirname, '../dist');

const PORT = Number(process.env.PORT) || 3000;

// Simple MIME map for static file serving
const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // 1. Health check endpoint (for Render / UptimeRobot)
  if (pathname === '/healthz' || pathname === '/health') {
    const report = worker.getStatusReport();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'OK',
      worker: report.status,
      broker: report.brokerStatus,
      uptimeSeconds: report.uptimeSeconds,
      lastHeartbeatIST: report.lastHeartbeatIST,
      activeRegime: report.currentRegime,
      memoryMb: report.memoryUsageMb,
    }));
    return;
  }

  // 2. Worker Status API endpoint
  if (pathname === '/api/status') {
    const report = worker.getStatusReport();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(report, null, 2));
    return;
  }

  // 3. Manual trigger endpoint (POST /api/trigger)
  if (pathname === '/api/trigger' && req.method === 'POST') {
    try {
      await worker.tick();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, message: 'Evaluation tick completed successfully.' }));
    } catch (err: any) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err.message || String(err) }));
    }
    return;
  }

  // 4. Secure Market Data Endpoints (keeps credentials strictly on the backend)
  if (pathname === '/api/candles' && req.method === 'GET') {
    const symbolParam = url.searchParams.get('symbol') || 'NIFTY';
    const cleanSymbol: 'NIFTY' | 'BANKNIFTY' = (symbolParam === 'BANK NIFTY' || symbolParam === 'BANKNIFTY') ? 'BANKNIFTY' : 'NIFTY';

    try {
      const now = new Date();
      const istNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
      const yyyy = istNow.getFullYear();
      const mm = String(istNow.getMonth() + 1).padStart(2, '0');
      const dd = String(istNow.getDate()).padStart(2, '0');
      const startTime = `${yyyy}-${mm}-${dd} 09:15:00`;
      const endTime = `${yyyy}-${mm}-${dd} 15:30:00`;

      const { activeMarketDataProvider } = await import('../src/services/marketDataProvider');
      const candles = await activeMarketDataProvider.get5mClosedCandles(cleanSymbol, startTime, endTime);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, provider: activeMarketDataProvider.name, symbol: cleanSymbol, candles }));
    } catch (err: any) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err.message || String(err) }));
    }
    return;
  }

  if (pathname === '/api/quote' && req.method === 'GET') {
    const symbolParam = url.searchParams.get('symbol') || 'NIFTY';
    const cleanSymbol = (symbolParam === 'BANK NIFTY' || symbolParam === 'BANKNIFTY') ? 'BANKNIFTY' : 'NIFTY';

    try {
      const { activeMarketDataProvider } = await import('../src/services/marketDataProvider');
      const quote = await activeMarketDataProvider.getQuote(cleanSymbol);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, provider: activeMarketDataProvider.name, quote }));
    } catch (err: any) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err.message || String(err) }));
    }
    return;
  }

  if (pathname === '/api/option-chain' && req.method === 'GET') {
    const underlying = url.searchParams.get('underlying') || 'NIFTY';
    const expiryDate = url.searchParams.get('expiry_date') || url.searchParams.get('expiryDate') || '';

    if (!expiryDate) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Missing expiry_date query parameter (YYYY-MM-DD)' }));
      return;
    }

    try {
      const { growwClient } = await import('./worker');
      const chain = await growwClient.getOptionChain(underlying, expiryDate);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, data: chain }));
    } catch (err: any) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err.message || String(err) }));
    }
    return;
  }

  // 4. Static frontend file server (Serves dist folder)
  let filePath = path.join(distDir, pathname);
  
  // Security check: prevent directory traversal
  if (!filePath.startsWith(distDir)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (!err && stats.isFile()) {
      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': contentType });
      fs.createReadStream(filePath).pipe(res);
    } else {
      // Fallback to index.html for SPA (Single Page Application) routing
      const indexPath = path.join(distDir, 'index.html');
      fs.stat(indexPath, (indexErr, indexStats) => {
        if (!indexErr && indexStats.isFile()) {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          fs.createReadStream(indexPath).pipe(res);
        } else {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('Dashboard build not found. Run npm run build first.');
        }
      });
    }
  });
});

// Start HTTP server & background worker
server.listen(PORT, '0.0.0.0', async () => {
  console.log(`[Server] Web Dashboard & Autonomous API listening on port ${PORT}`);
  console.log(`[Server] Health Check available at http://localhost:${PORT}/healthz`);
  console.log(`[Server] Live Status API available at http://localhost:${PORT}/api/status`);

  // Start background worker
  await worker.start();
});

// Graceful shutdown handlers
process.on('SIGTERM', async () => {
  console.log('[Server] SIGTERM received. Shutting down worker...');
  await worker.stop();
  server.close(() => process.exit(0));
});

process.on('SIGINT', async () => {
  console.log('[Server] SIGINT received. Shutting down worker...');
  await worker.stop();
  server.close(() => process.exit(0));
});
