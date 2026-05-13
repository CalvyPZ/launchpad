/**
 * CalvyBots Launchpad — API sidecar
 *
 * Runs on port 3000 inside the Docker network; nginx proxies /api/* to this process.
 * No external dependencies — plain Node.js http module only.
 *
 * Routes (see data/schema.md for response shapes):
 *   GET /api/health  — liveness check
 *   GET /api/system  — runtime diagnostics
 *   GET /api/config  — serves ../data/config.json
 *   *                — 404 JSON
 */

'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT) || 3000;
const CONFIG_PATH = path.resolve(__dirname, '..', 'data', 'config.json');
const startTime = Date.now();

function uptime() {
  return Math.floor((Date.now() - startTime) / 1000);
}

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
    'Cache-Control': 'no-store',
  });
  res.end(payload);
}

function handleHealth(res) {
  sendJson(res, 200, {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: uptime(),
  });
}

function handleSystem(res) {
  const mem = process.memoryUsage();
  sendJson(res, 200, {
    timestamp: new Date().toISOString(),
    uptime: uptime(),
    node: process.version,
    memory: {
      heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
      heapTotal: Math.round(mem.heapTotal / 1024 / 1024),
      rss: Math.round(mem.rss / 1024 / 1024),
    },
  });
}

function handleConfig(res) {
  fs.readFile(CONFIG_PATH, 'utf8', (err, data) => {
    if (err) {
      sendJson(res, 500, { error: 'Failed to read config', detail: err.message });
      return;
    }
    let parsed;
    try {
      parsed = JSON.parse(data);
    } catch (parseErr) {
      sendJson(res, 500, { error: 'Failed to read config', detail: parseErr.message });
      return;
    }
    sendJson(res, 200, parsed);
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = url.pathname.replace(/\/$/, '') || '/';

  if (req.method !== 'GET') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  switch (pathname) {
    case '/api/health':
      handleHealth(res);
      break;
    case '/api/system':
      handleSystem(res);
      break;
    case '/api/config':
      handleConfig(res);
      break;
    default:
      sendJson(res, 404, { error: 'Not found' });
  }
});

server.listen(PORT, () => {
  console.log(`[api] CalvyBots API listening on port ${PORT}`);
});

server.on('error', (err) => {
  console.error('[api] Server error:', err);
  process.exit(1);
});
