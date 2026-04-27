import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { getApp, getDb, http_, loginAdmin } from './_helpers';

describe('alert target validation', () => {
  let adminToken: string;

  before(async () => {
    await getApp();
    adminToken = await loginAdmin();
  });

  function seedZone(): number {
    const info = getDb().prepare("INSERT INTO zones (name) VALUES (?)").run(`Zona ${Date.now()}-${Math.random()}`);
    return Number(info.lastInsertRowid);
  }

  function seedDisplay(): number {
    const info = getDb().prepare("INSERT INTO displays (name) VALUES (?)").run(`Display ${Date.now()}-${Math.random()}`);
    return Number(info.lastInsertRowid);
  }

  function alertBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      title: 'Alerta test',
      severity: 'warn',
      target_type: 'all',
      ...overrides,
    };
  }

  it('accepts global alerts without target_id and stores null', async () => {
    const r = await http_('POST', '/api/alerts', { token: adminToken, body: alertBody() });
    assert.equal(r.status, 201);
    assert.equal(r.json.alert.target_type, 'all');
    assert.equal(r.json.alert.target_id, null);
  });

  it('rejects global alerts with target_id', async () => {
    const r = await http_('POST', '/api/alerts', {
      token: adminToken,
      body: alertBody({ target_id: seedZone() }),
    });
    assert.equal(r.status, 400);
  });

  it('requires target_id for zone and display alerts', async () => {
    const zone = await http_('POST', '/api/alerts', {
      token: adminToken,
      body: alertBody({ target_type: 'zone' }),
    });
    assert.equal(zone.status, 400);

    const display = await http_('POST', '/api/alerts', {
      token: adminToken,
      body: alertBody({ target_type: 'display' }),
    });
    assert.equal(display.status, 400);
  });

  it('rejects missing zone and display targets', async () => {
    const zone = await http_('POST', '/api/alerts', {
      token: adminToken,
      body: alertBody({ target_type: 'zone', target_id: 999999 }),
    });
    assert.equal(zone.status, 400);

    const display = await http_('POST', '/api/alerts', {
      token: adminToken,
      body: alertBody({ target_type: 'display', target_id: 999999 }),
    });
    assert.equal(display.status, 400);
  });

  it('accepts zone and display alerts with existing targets', async () => {
    const zoneId = seedZone();
    const zone = await http_('POST', '/api/alerts', {
      token: adminToken,
      body: alertBody({ target_type: 'zone', target_id: zoneId }),
    });
    assert.equal(zone.status, 201);
    assert.equal(zone.json.alert.target_id, zoneId);

    const displayId = seedDisplay();
    const display = await http_('POST', '/api/alerts', {
      token: adminToken,
      body: alertBody({ target_type: 'display', target_id: displayId }),
    });
    assert.equal(display.status, 201);
    assert.equal(display.json.alert.target_id, displayId);
  });
});
