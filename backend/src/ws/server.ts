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

const ALLOWED_ADMIN_CHANNEL_RE = /^(all|admin|zone:\d+|display:\d+)$/;

export interface BroadcastMessage {
  channel: string;
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

      if (kind === 'display') {
        const row = getDb().prepare('SELECT api_token, zone_id FROM displays WHERE id = ?')
          .get(payload.sub) as { api_token: string | null; zone_id: number | null } | undefined;
        if (!row || row.api_token !== token) {
          ws.close(4003, 'display token revoked');
          return;
        }
        const client: Client = {
          ws,
          channels: new Set([`display:${payload.sub}`, 'all']),
          kind,
          id: payload.sub,
          isAlive: true,
        };
        if (row.zone_id) client.channels.add(`zone:${row.zone_id}`);

        clients.add(client);
        log.info('ws.connect', { kind, id: payload.sub, channels: [...client.channels] });
        ws.send(JSON.stringify({ type: 'hello', serverTime: new Date().toISOString() }));

        ws.on('pong', () => { client.isAlive = true; });
        ws.on('message', raw => handleMessage(client, raw.toString()));
        ws.on('close', () => {
          clients.delete(client);
          try {
            getDb().prepare("UPDATE displays SET status = 'offline', updated_at = datetime('now') WHERE id = ?").run(payload.sub);
          } catch { /* ignore */ }
          log.info('ws.disconnect', { kind, id: payload.sub });
        });
        ws.on('error', err => log.warn('ws.error', err));
        return;
      }

      // Admin
      const client: Client = {
        ws,
        channels: new Set(['admin', 'all']),
        kind,
        id: payload.sub,
        isAlive: true,
      };
      clients.add(client);
      log.info('ws.connect', { kind, id: payload.sub, channels: [...client.channels] });
      ws.send(JSON.stringify({ type: 'hello', serverTime: new Date().toISOString() }));

      ws.on('pong', () => { client.isAlive = true; });
      ws.on('message', raw => handleMessage(client, raw.toString()));
      ws.on('close', () => {
        clients.delete(client);
        log.info('ws.disconnect', { kind, id: payload.sub });
      });
      ws.on('error', err => log.warn('ws.error', err));
    } catch (err) {
      log.warn('ws.handshake failed', err);
      try { ws.close(4002, 'invalid token'); } catch { /* ignore */ }
    }
  });

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
  interval.unref();

  wss.on('close', () => clearInterval(interval));

  return wss;
}

function handleMessage(client: Client, raw: string) {
  if (raw.length > 4096) return;
  try {
    const msg = JSON.parse(raw);
    if (msg.type === 'subscribe' && typeof msg.channel === 'string') {
      if (client.kind !== 'admin') return;
      if (!ALLOWED_ADMIN_CHANNEL_RE.test(msg.channel)) return;
      client.channels.add(msg.channel);
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

/** Test-only helper to clear in-memory client state between tests. */
export function _resetWsClientsForTests(): void {
  for (const c of clients) {
    try { c.ws.terminate(); } catch { /* ignore */ }
  }
  clients.clear();
}
