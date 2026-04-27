import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { getApp, getDb, http_, loginAdmin, resetRateLimits } from './_helpers';

describe('display pairing flow', () => {
  let adminToken: string;

  before(async () => {
    await getApp();
    resetRateLimits();
    adminToken = await loginAdmin();
  });

  it('admin creates a display, pairing returns a token bound to api_token', async () => {
    const create = await http_('POST', '/api/displays', {
      token: adminToken,
      body: { name: 'TV pair test', resolution: '1920x1080', orientation: 'landscape' },
    });
    assert.equal(create.status, 201);
    const code = create.json.pairing_code;
    assert.match(code, /^[A-Z0-9]{6}$/);

    const pair = await http_('POST', '/api/player/pair', {
      body: { code, hardware_info: { rev: 1 }, user_agent: 'test-agent' },
    });
    assert.equal(pair.status, 200);
    assert.ok(pair.json.token);

    // Verify api_token persisted to DB
    const row = getDb().prepare('SELECT api_token FROM displays WHERE id = ?').get(create.json.id) as { api_token: string };
    assert.equal(row.api_token, pair.json.token);

    // Same code should no longer work (was consumed)
    const second = await http_('POST', '/api/player/pair', { body: { code } });
    assert.equal(second.status, 400);
  });

  it('rejects invalid pairing code', async () => {
    const r = await http_('POST', '/api/player/pair', { body: { code: 'ZZZZZZ' } });
    assert.equal(r.status, 400);
  });

  it('regenerate-pairing invalidates the previous api_token', async () => {
    const create = await http_('POST', '/api/displays', {
      token: adminToken,
      body: { name: 'TV regen test' },
    });
    const id = create.json.id;
    const pair1 = await http_('POST', '/api/player/pair', { body: { code: create.json.pairing_code } });
    assert.equal(pair1.status, 200);
    const config1 = await http_('GET', '/api/player/config', { token: pair1.json.token });
    assert.equal(config1.status, 200);

    const regen = await http_('POST', `/api/displays/${id}/regenerate-pairing`, {
      token: adminToken,
      body: {},
    });
    assert.equal(regen.status, 200);

    const row = getDb().prepare('SELECT api_token FROM displays WHERE id = ?').get(id) as { api_token: string | null };
    assert.equal(row.api_token, null);

    const staleConfig = await http_('GET', '/api/player/config', { token: pair1.json.token });
    assert.equal(staleConfig.status, 401);
    const staleHeartbeat = await http_('POST', '/api/player/heartbeat', {
      token: pair1.json.token,
      body: { version: 'test' },
    });
    assert.equal(staleHeartbeat.status, 401);
    const staleWidget = await http_('GET', '/api/player/widget/1/data', { token: pair1.json.token });
    assert.equal(staleWidget.status, 401);

    const pair2 = await http_('POST', '/api/player/pair', { body: { code: regen.json.pairing_code } });
    assert.equal(pair2.status, 200);
    const config2 = await http_('GET', '/api/player/config', { token: pair2.json.token });
    assert.equal(config2.status, 200);
  });

  it('rejects a validly signed display token for a display that does not exist', async () => {
    const { signDisplayToken } = await import('../src/auth/jwt');
    const r = await http_('GET', '/api/player/config', { token: signDisplayToken(999999) });
    assert.equal(r.status, 401);
  });

  it('does not leak api_token through admin display list', async () => {
    const list = await http_('GET', '/api/displays', { token: adminToken });
    assert.equal(list.status, 200);
    for (const d of list.json.displays) {
      assert.equal('api_token' in d, false, 'api_token must not be exposed via API');
    }
  });

  it('does not leak api_token through admin display detail', async () => {
    const create = await http_('POST', '/api/displays', {
      token: adminToken,
      body: { name: 'TV no-leak' },
    });
    await http_('POST', '/api/player/pair', { body: { code: create.json.pairing_code } });
    const detail = await http_('GET', `/api/displays/${create.json.id}`, { token: adminToken });
    assert.equal(detail.status, 200);
    assert.equal('api_token' in detail.json.display, false);
  });

  it('player /config requires display token, not user token', async () => {
    const userR = await http_('GET', '/api/player/config', { token: adminToken });
    assert.equal(userR.status, 401);
  });
});
