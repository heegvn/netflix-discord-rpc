import http from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import dotenv from 'dotenv';
import { DiscordBridge } from './discord.js';
import { BridgeMessage, BridgeStatusResponse } from './types.js';

// Charge les variables d'environnement (.env si présent)
dotenv.config();

const PORT = parseInt(process.env.PORT || '7777', 10);
const HOST = '127.0.0.1'; // Uniquement local pour la sécurité

const discord = new DiscordBridge();
let activeClients = new Set<WebSocket>();
let idleTimeout: NodeJS.Timeout | null = null;

// Création du serveur HTTP (pour le check de statut et le handshake WebSocket)
const server = http.createServer((req, res) => {
  // CORS pour autoriser l'extension locale
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

// Serveur WebSocket attaché
const wss = new WebSocketServer({ server });

function resetIdleTimeout() {
  if (idleTimeout) {
    clearTimeout(idleTimeout);
  }
  // Si aucun message n'est reçu pendant 12 secondes (onglets fermés / navigation), on efface la présence
  idleTimeout = setTimeout(() => {
    console.log('[Bridge] Aucun signal reçu depuis 12s, nettoyage de la présence Discord.');
    discord.clearPresence();
  }, 12000);
}

wss.on('connection', (ws) => {
  activeClients.add(ws);
  console.log(`[Bridge] Nouvelle connexion reçue (Clients actifs: ${activeClients.size})`);

  // Envoi du statut immédiat au client qui vient de se connecter
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
      console.error('[Bridge] Erreur lors du parsing du message:', err?.message || err);
    }
  });

  ws.on('close', () => {
    activeClients.delete(ws);
    console.log(`[Bridge] Client déconnecté (Clients restants: ${activeClients.size})`);
    if (activeClients.size === 0) {
      // Si plus aucun onglet n'est ouvert, on efface la présence après un court délai
      setTimeout(() => {
        if (activeClients.size === 0) {
          discord.clearPresence();
        }
      }, 3000);
    }
  });

  ws.on('error', (err) => {
    console.error('[Bridge] Erreur WebSocket:', err.message);
  });
});

// Démarrage du serveur
server.listen(PORT, HOST, async () => {
  console.log('====================================================');
  console.log(`🚀 Pont Netflix Discord RPC démarré sur http://${HOST}:${PORT}`);
  console.log(`📡 WebSocket local en écoute sur ws://${HOST}:${PORT}`);
  console.log('====================================================');

  // Connexion initiale à Discord
  await discord.connect();
});

// Arrêt propre
const shutdown = async () => {
  console.log('\n[Bridge] Arrêt du serveur...');
  if (idleTimeout) clearTimeout(idleTimeout);
  await discord.destroy();
  wss.close();
  server.close(() => {
    console.log('[Bridge] Serveur arrêté.');
    process.exit(0);
  });
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
