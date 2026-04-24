import type { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { URL } from 'url';
import { verifyToken } from '../auth/jwt';
import { getDb } from '../db';
import { log } from '../logger';

interface Client {
  ws: WebSocket;
  channels: Set<string>;
  kind: 'display' | 'admin';
  id: number;
  isAlive: boolean;
}

const clients = new Set<Client>();

export interface BroadcastMessage {
  channel: string;  // 'all' | 'zone:N' | 'display:N' | 'admin'
  event: Record<string, unknown>;
}

export function attachWsServer(httpServer: HttpServer) {
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', (ws, req) => {
    try {
      const url = new URL(req.url ?? '/', 'http://localhost');
      const token = url.searchParams.get('token');
      if (!token) {
        ws.close(4001, 'token required');
        return;
      }
      const payload = verifyToken(token);
      const kind: 'display' | 'admin' = payload.type === 'display' ? 'display' : 'admin';
      const client: Client = {
        ws,
        channels: new Set(),
        kind,
        id: payload.sub,
        isAlive: true,
      };

      if (kind === 'display') {
        client.channels.add(`display:${payload.sub}`);
        // Add zone channel
        const row = getDb().prepare('SELECT zone_id FROM displays WHERE id = ?').get(payload.sub) as { zone_id: number | null } | undefined;
        if (row?.zone_id) client.channels.add(`zone:${row.zone_id}`);
        client.channels.add('all');
      } else {
        client.channels.add('admin');
        client.channels.add('all');
      }

      clients.add(client);
      log.info('ws.connect', { kind, id: payload.sub, channels: [...client.channels] });

      ws.send(JSON.stringify({ type: 'hello', serverTime: new Date().toISOString() }));

      ws.on('pong', () => { client.isAlive = true; });

      ws.on('message', raw => handleMessage(client, raw.toString()));

      ws.on('close', () => {
        clients.delete(client);
        if (kind === 'display') {
          try {
            getDb().prepare("UPDATE displays SET status = 'offline', updated_at = datetime('now') WHERE id = ?").run(payload.sub);
          } catch { /* ignore */ }
        }
        log.info('ws.disconnect', { kind, id: payload.sub });
      });

      ws.on('error', (err) => log.warn('ws.error', err));
    } catch (err) {
      log.warn('ws.handshake failed', err);
      try { ws.close(4002, 'invalid token'); } catch { /* ignore */ }
    }
  });

  // Keep-alive ping
  const interval = setInterval(() => {
    for (const c of clients) {
      if (!c.isAlive) {
        c.ws.terminate();
        clients.delete(c);
        continue;
      }
      c.isAlive = false;
      try { c.ws.ping(); } catch { /* ignore */ }
    }
  }, 30_000);

  wss.on('close', () => clearInterval(interval));

  return wss;
}

function handleMessage(client: Client, raw: string) {
  try {
    const msg = JSON.parse(raw);
    if (msg.type === 'subscribe' && typeof msg.channel === 'string') {
      // Only allow admin to subscribe to arbitrary channels
      if (client.kind === 'admin') {
        client.channels.add(msg.channel);
      }
    } else if (msg.type === 'unsubscribe' && typeof msg.channel === 'string') {
      client.channels.delete(msg.channel);
    } else if (msg.type === 'heartbeat' && client.kind === 'display') {
      try {
        getDb().prepare(`
          UPDATE displays SET status = 'online', last_seen_at = datetime('now') WHERE id = ?
        `).run(client.id);
      } catch { /* ignore */ }
    }
  } catch (err) {
    log.debug('ws.message parse failed', err);
  }
}

export function broadcast(message: BroadcastMessage): number {
  const payload = JSON.stringify(message.event);
  let sent = 0;
  for (const c of clients) {
    if (c.ws.readyState !== WebSocket.OPEN) continue;
    if (message.channel === 'all' || c.channels.has(message.channel) || c.channels.has('all')) {
      try {
        c.ws.send(payload);
        sent++;
      } catch { /* ignore */ }
    }
  }
  return sent;
}

export function getConnectedClients(): { total: number; displays: number; admins: number } {
  let displays = 0;
  let admins = 0;
  for (const c of clients) {
    if (c.kind === 'display') displays++;
    else admins++;
  }
  return { total: clients.size, displays, admins };
}
