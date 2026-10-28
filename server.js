'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocket, WebSocketServer } = require('ws');

// Load local .env values without requiring an extra dependency. Existing environment
// variables always take precedence. Keep .env private and never serve it to browsers.
const envPath = path.join(__dirname, '.env');
try {
  const envText = fs.readFileSync(envPath, 'utf8');
  for (const line of envText.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!match || Object.prototype.hasOwnProperty.call(process.env, match[1])) continue;
    let value = match[2];
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    process.env[match[1]] = value;
  }
} catch (err) {
  if (err.code !== 'ENOENT') console.warn('Could not read local .env file:', err.message);
}

const HOST = process.env.HOST || '0.0.0.0';
const PORT = Number(process.env.PORT || 3000);
const INDEX = path.join(__dirname, 'index.html');

const server = http.createServer((req, res) => {
  const pathname = new URL(req.url, `http://${req.headers.host || 'localhost'}`).pathname;
  if (pathname === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ ok: true, aisKeyConfigured: Boolean(process.env.AISSTREAM_API_KEY) }));
    return;
  }
  if (pathname !== '/' && pathname !== '/index.html') {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
    return;
  }
  fs.readFile(INDEX, (err, data) => {
    if (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Could not read index.html');
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    res.end(data);
  });
});

const browserWss = new WebSocketServer({ noServer: true, perMessageDeflate: true });
server.on('upgrade', (req, socket, head) => {
  const pathname = new URL(req.url, `http://${req.headers.host || 'localhost'}`).pathname;
  if (pathname !== '/api/ais-stream') {
    socket.destroy();
    return;
  }
  browserWss.handleUpgrade(req, socket, head, ws => browserWss.emit('connection', ws, req));
});

browserWss.on('connection', browser => {
  const apiKey = process.env.AISSTREAM_API_KEY;
  if (!apiKey) {
    browser.send(JSON.stringify({ type: 'server_error', message: 'AIS API key missing. Set AISSTREAM_API_KEY in your terminal, then restart the server.' }));
    setTimeout(() => browser.close(1011, 'AIS API key missing'), 100);
    return;
  }

  const upstream = new WebSocket('wss://stream.aisstream.io/v0/stream', { perMessageDeflate: true, handshakeTimeout: 15000 });
  let subscribed = false;
  upstream.on('open', () => {
    // Global AIS subscription; this may be a high-volume feed and depends on provider coverage/limits.
    upstream.send(JSON.stringify({
      APIKey: apiKey,
      BoundingBoxes: [[[-90, -180], [90, 180]]],
      FilterMessageTypes: ['PositionReport', 'StandardClassBPositionReport', 'ExtendedClassBPositionReport']
    }));
  });
  upstream.on('message', (data) => {
    if (browser.readyState !== WebSocket.OPEN) return;
    const payload = data.toString();
    // Keep the browser feed lean: relay vessel position messages and subscription/service status only.
    try {
      const msg = JSON.parse(payload);
      if (msg.MessageType === 'SubscriptionConfirmation') {
        subscribed = true;
        browser.send(payload);
        return;
      }
      if (msg.MessageType === 'PositionReport' || msg.MessageType === 'StandardClassBPositionReport' || msg.MessageType === 'ExtendedClassBPositionReport') {
        browser.send(payload);
        return;
      }
      if (msg.error || msg.type === 'error') browser.send(JSON.stringify({ type: 'server_error', message: String(msg.error || msg.message || 'AIS provider error') }));
    } catch (_) { /* Ignore non-JSON provider frames. */ }
  });
  upstream.on('error', err => {
    if (browser.readyState === WebSocket.OPEN) browser.send(JSON.stringify({ type: 'server_error', message: 'AIS provider connection error: ' + err.message }));
  });
  upstream.on('close', (code, reason) => {
    if (browser.readyState === WebSocket.OPEN) browser.close(code || 1000, reason.toString().slice(0, 120));
  });
  browser.on('close', () => { if (upstream.readyState === WebSocket.OPEN || upstream.readyState === WebSocket.CONNECTING) upstream.close(); });
  browser.on('error', () => { if (upstream.readyState === WebSocket.OPEN || upstream.readyState === WebSocket.CONNECTING) upstream.close(); });
});

server.listen(PORT, HOST, () => {
  console.log(`Live 3D World server listening on ${HOST}:${PORT}`);
  console.log(`Local browser URL: http://127.0.0.1:${PORT}`);
  console.log(`AIS key configured: ${Boolean(process.env.AISSTREAM_API_KEY)}`);
  if (!process.env.AISSTREAM_API_KEY) console.log('Set AISSTREAM_API_KEY before connecting Live Ships.');
});
