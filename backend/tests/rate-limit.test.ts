import './_env';

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import http from 'node:http';
import type { AddressInfo } from 'node:net';

import { rateLimit, _resetRateLimitForTests } from '../src/util/rate-limit';
import { HttpError } from '../src/util/errors';

function bootApp(limiter: ReturnType<typeof rateLimit>) {
  const app = express();
  app.set('trust proxy', true);
  app.use(limiter);
  app.get('/ping', (_req, res) => res.json({ ok: true }));
  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (err instanceof HttpError) {
      return res.status(err.status).json({ error: err.message, code: err.code });
    }
    res.status(500).end();
  });
  return new Promise<{ baseUrl: string; close: () => void }>(resolve => {
    const server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as AddressInfo;
      resolve({ baseUrl: `http://127.0.0.1:${addr.port}`, close: () => server.close() });
    });
  });
}

describe('rate-limit', () => {
  it('allows up to capacity, then 429', async () => {
    _resetRateLimitForTests();
    const { baseUrl, close } = await bootApp(rateLimit({ capacity: 3, refillPerSec: 0 }));
    try {
      for (let i = 0; i < 3; i++) {
        const r = await fetch(`${baseUrl}/ping`);
        assert.equal(r.status, 200, `request ${i + 1} should succeed`);
      }
      const r4 = await fetch(`${baseUrl}/ping`);
      assert.equal(r4.status, 429);
      assert.ok(r4.headers.get('retry-after'));
      const body = await r4.json() as any;
      assert.equal(body.code, 'rate_limited');
    } finally {
      close();
    }
  });

  it('refills tokens over time', async () => {
    _resetRateLimitForTests();
    const { baseUrl, close } = await bootApp(rateLimit({ capacity: 1, refillPerSec: 50 }));
    try {
      const r1 = await fetch(`${baseUrl}/ping`);
      assert.equal(r1.status, 200);
      const r2 = await fetch(`${baseUrl}/ping`);
      assert.equal(r2.status, 429);
      // Wait long enough to refill
      await new Promise(r => setTimeout(r, 100));
      const r3 = await fetch(`${baseUrl}/ping`);
      assert.equal(r3.status, 200);
    } finally {
      close();
    }
  });

  it('uses custom keyFn so different keys do not share buckets', async () => {
    _resetRateLimitForTests();
    let counter = 0;
    const limiter = rateLimit({
      capacity: 1,
      refillPerSec: 0,
      keyFn: () => `user-${counter++}`,
    });
    const { baseUrl, close } = await bootApp(limiter);
    try {
      const a = await fetch(`${baseUrl}/ping`);
      const b = await fetch(`${baseUrl}/ping`);
      assert.equal(a.status, 200);
      assert.equal(b.status, 200);
    } finally {
      close();
    }
  });
});
