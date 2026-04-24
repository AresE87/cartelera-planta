import './_env';

import express from 'express';
import http from 'http';
import { randomUUID } from 'crypto';
import type { AddressInfo } from 'net';
import apiRouter from '../src/routes';
import { registerAllWidgets } from '../src/widgets';
import { HttpError } from '../src/util/errors';
import { securityHeaders } from '../src/util/security-headers';
import { hashPassword } from '../src/auth/passwords';
import { signUserToken } from '../src/auth/jwt';
import { getDb } from '../src/db';
import { _resetRateLimitForTests } from '../src/util/rate-limit';
import type { Role } from '../src/types';

export interface TestServer {
  baseUrl: string;
  close: () => Promise<void>;
}

let cached: TestServer | null = null;

export async function getApp(): Promise<TestServer> {
  if (cached) return cached;
  registerAllWidgets();

  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', true);
  app.use(securityHeaders);
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use('/api', apiRouter);
  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (err instanceof HttpError) {
      return res.status(err.status).json({ error: err.message, code: err.code, details: err.details });
    }
    if ((err as { type?: string })?.type === 'entity.too.large') {
      return res.status(413).json({ error: 'Request body too large' });
    }
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  });

  await ensureAdmin();

  return new Promise<TestServer>(resolve => {
    const server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as AddressInfo;
      const baseUrl = `http://127.0.0.1:${addr.port}`;
      cached = {
        baseUrl,
        close: () => new Promise<void>(r => server.close(() => r())),
      };
      server.unref();
      resolve(cached);
    });
  });
}

async function ensureAdmin(): Promise<void> {
  const db = getDb();
  const exists = db.prepare('SELECT id FROM users WHERE email = ?').get('admin@test.local');
  if (!exists) {
    const hash = await hashPassword('testpassword123');
    db.prepare(`INSERT OR IGNORE INTO users (email, password_hash, name, role) VALUES (?, ?, 'Admin', 'admin')`)
      .run('admin@test.local', hash);
  }
}

export async function loginAdmin(): Promise<string> {
  const { baseUrl } = await getApp();
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'admin@test.local', password: 'testpassword123' }),
  });
  if (!res.ok) throw new Error(`login failed ${res.status} ${await res.text()}`);
  const json = await res.json() as { token: string };
  return json.token;
}

export async function tokenForRole(role: Role): Promise<string> {
  await getApp();
  const db = getDb();
  const email = `${role}_${randomUUID()}@test.local`;
  const hash = await hashPassword('passwordtest12345');
  const info = db.prepare(`INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, 'TestUser', ?)`)
    .run(email, hash, role);
  return signUserToken({ sub: Number(info.lastInsertRowid), email, role });
}

export async function http_(
  method: string,
  path: string,
  opts: { token?: string; body?: unknown; headers?: Record<string, string> } = {},
): Promise<{ status: number; ok: boolean; json: any; text: string; headers: Headers }> {
  const { baseUrl } = await getApp();
  const headers: Record<string, string> = { 'content-type': 'application/json', ...(opts.headers ?? {}) };
  if (opts.token) headers.authorization = `Bearer ${opts.token}`;
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  let json: any = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* leave null */ }
  return { status: res.status, ok: res.ok, json, text, headers: res.headers };
}

export function resetRateLimits(): void {
  _resetRateLimitForTests();
}

export { getDb };
