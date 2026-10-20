import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { worker } from './worker';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.resolve(__dirname, '../dist');

const PORT = process.env.PORT || 3000;

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
server.listen(PORT, async () => {
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
