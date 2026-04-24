import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { getApp, http_, resetRateLimits, tokenForRole } from './_helpers';

describe('auth', () => {
  before(async () => { await getApp(); resetRateLimits(); });
  after(() => { resetRateLimits(); });

  it('logs in with valid credentials', async () => {
    const r = await http_('POST', '/api/auth/login', {
      body: { email: 'admin@test.local', password: 'testpassword123' },
    });
    assert.equal(r.status, 200);
    assert.ok(r.json.token);
    assert.equal(r.json.user.role, 'admin');
  });

  it('rejects wrong password', async () => {
    const r = await http_('POST', '/api/auth/login', {
      body: { email: 'admin@test.local', password: 'wrong-password' },
    });
    assert.equal(r.status, 401);
  });

  it('rejects unknown email', async () => {
    const r = await http_('POST', '/api/auth/login', {
      body: { email: 'ghost@test.local', password: 'whatever' },
    });
    assert.equal(r.status, 401);
  });

  it('rejects malformed body', async () => {
    const r = await http_('POST', '/api/auth/login', { body: { email: 'not-an-email', password: 'x' } });
    assert.equal(r.status, 400);
  });

  it('returns user info for /me with valid token', async () => {
    const token = await tokenForRole('admin');
    const r = await http_('GET', '/api/auth/me', { token });
    assert.equal(r.status, 200);
    assert.equal(r.json.user.role, 'admin');
  });

  it('rejects /me without token', async () => {
    const r = await http_('GET', '/api/auth/me');
    assert.equal(r.status, 401);
  });

  it('rejects /me with display token (wrong type)', async () => {
    const { signDisplayToken } = await import('../src/auth/jwt');
    const token = signDisplayToken(999);
    const r = await http_('GET', '/api/auth/me', { token });
    assert.equal(r.status, 401);
  });

  it('rate-limits brute-force login attempts', async () => {
    resetRateLimits();
    let blocked = false;
    for (let i = 0; i < 8; i++) {
      const r = await http_('POST', '/api/auth/login', {
        body: { email: 'admin@test.local', password: 'wrong-attempt' },
      });
      if (r.status === 429) { blocked = true; break; }
    }
    assert.equal(blocked, true, 'expected at least one request to be rate-limited');
  });
});
