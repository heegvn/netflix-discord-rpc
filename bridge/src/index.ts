import http from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import dotenv from 'dotenv';
import { DiscordBridge } from './discord.js';
import { BridgeMessage, BridgeStatusResponse } from './types.js';

dotenv.config();

const PORT = parseInt(process.env.PORT || '7777', 10);
const HOST = '127.0.0.1';

const discord = new DiscordBridge();
let activeClients = new Set<WebSocket>();
let idleTimeout: NodeJS.Timeout | null = null;

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.url === '/status' || req.url === '/') {
    const status = discord.getStatus();
    const response: BridgeStatusResponse = {
      type: 'STATUS',
      discordConnected: status.isConnected,
      activePresence: status.hasActivePresence,
      clientCount: activeClients.size
    };
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(response, null, 2));
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Netflix RPC Bridge Server');
});

const wss = new WebSocketServer({ server });

function resetIdleTimeout() {
  if (idleTimeout) {
    clearTimeout(idleTimeout);
  }
  idleTimeout = setTimeout(() => {
    console.log('[Bridge] No signal received for 12s, clearing Discord presence.');
    discord.clearPresence();
  }, 12000);
}

wss.on('connection', (ws) => {
  activeClients.add(ws);
  console.log(`[Bridge] Client connected (Total active: ${activeClients.size})`);

  const status = discord.getStatus();
  const welcomeMsg: BridgeStatusResponse = {
    type: 'STATUS',
    discordConnected: status.isConnected,
    activePresence: status.hasActivePresence,
    clientCount: activeClients.size
  };
  ws.send(JSON.stringify(welcomeMsg));

  ws.on('message', async (raw) => {
    try {
      const message = JSON.parse(raw.toString()) as BridgeMessage;

      if (message.type === 'UPDATE_PRESENCE' && message.data) {
        resetIdleTimeout();
        await discord.updatePresence(message.data);
      } else if (message.type === 'CLEAR_PRESENCE') {
        if (idleTimeout) clearTimeout(idleTimeout);
        await discord.clearPresence();
      } else if (message.type === 'PING') {
        const curStatus = discord.getStatus();
        ws.send(JSON.stringify({
          type: 'PONG',
          discordConnected: curStatus.isConnected,
          activePresence: curStatus.hasActivePresence
        }));
      }
    } catch (err: any) {
      console.error('[Bridge] Error parsing incoming message:', err?.message || err);
    }
  });

  ws.on('close', () => {
    activeClients.delete(ws);
    console.log(`[Bridge] Client disconnected (Remaining: ${activeClients.size})`);
    if (activeClients.size === 0) {
      setTimeout(() => {
        if (activeClients.size === 0) {
          discord.clearPresence();
        }
      }, 3000);
    }
  });

  ws.on('error', (err) => {
    console.error('[Bridge] WebSocket error:', err.message);
  });
});

server.listen(PORT, HOST, async () => {
  console.log('====================================================');
  console.log(`🚀 Netflix Discord RPC Bridge running on http://${HOST}:${PORT}`);
  console.log(`📡 Local WebSocket listening on ws://${HOST}:${PORT}`);
  console.log('====================================================');

  await discord.connect();
});

const shutdown = async () => {
  console.log('\n[Bridge] Shutting down server...');
  if (idleTimeout) clearTimeout(idleTimeout);
  await discord.destroy();
  wss.close();
  server.close(() => {
    console.log('[Bridge] Server stopped.');
    process.exit(0);
  });
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
