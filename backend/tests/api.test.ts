import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

/**
 * Smoke tests — verify basic shape of the API surface without running the server.
 * Runs with: npm test (from backend/)
 *
 * These tests focus on pure utilities; full e2e tests require a running server.
 */

import { hashPassword, verifyPassword } from '../src/auth/passwords';
import { signUserToken, verifyToken } from '../src/auth/jwt';
import { resolveCurrentLayout } from '../src/services/scheduler';
import { getDb } from '../src/db';

// Force test DB
process.env.DB_PATH = ':memory:';
process.env.JWT_SECRET = 'test-secret-test-secret-test-secret-test';

describe('auth', () => {
  it('hashes and verifies passwords', async () => {
    const hash = await hashPassword('hola123');
    assert.notEqual(hash, 'hola123');
    assert.ok(await verifyPassword('hola123', hash));
    assert.ok(!(await verifyPassword('wrong', hash)));
  });

  it('signs and verifies JWT', () => {
    const token = signUserToken({ sub: 42, email: 'a@b.c', role: 'admin' });
    const payload = verifyToken(token);
    assert.equal(payload.sub, 42);
    assert.equal(payload.type, 'user');
  });
});

describe('scheduler', () => {
  it('returns fallback when no schedules exist', () => {
    getDb().exec(`INSERT INTO displays (id, name, resolution, orientation) VALUES (1, 'test', '1920x1080', 'landscape')`);
    const layout = resolveCurrentLayout(1, null);
    assert.equal(layout.source, 'fallback');
    assert.equal(layout.id, null);
  });
});
