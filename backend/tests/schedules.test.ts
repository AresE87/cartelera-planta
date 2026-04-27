import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { getApp, getDb, http_, loginAdmin } from './_helpers';

describe('schedule target validation', () => {
  let adminToken: string;

  before(async () => {
    await getApp();
    adminToken = await loginAdmin();
  });

  function seedLayout(): number {
    const info = getDb().prepare(`
      INSERT INTO layouts (name, width, height, background_color, definition, published)
      VALUES (?, 1920, 1080, '#000000', ?, 1)
    `).run(`Layout ${Date.now()}-${Math.random()}`, JSON.stringify({ regions: [] }));
    return Number(info.lastInsertRowid);
  }

  function seedZone(): number {
    const info = getDb().prepare("INSERT INTO zones (name) VALUES (?)").run(`Zona ${Date.now()}-${Math.random()}`);
    return Number(info.lastInsertRowid);
  }

  function seedDisplay(): number {
    const info = getDb().prepare("INSERT INTO displays (name) VALUES (?)").run(`Display ${Date.now()}-${Math.random()}`);
    return Number(info.lastInsertRowid);
  }

  function scheduleBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      layout_id: seedLayout(),
      name: `Schedule ${Date.now()}-${Math.random()}`,
      zone_id: seedZone(),
      ...overrides,
    };
  }

  it('creates schedules for exactly one zone or display', async () => {
    const zone = await http_('POST', '/api/schedules', {
      token: adminToken,
      body: scheduleBody(),
    });
    assert.equal(zone.status, 201);
    const zoneRow = getDb().prepare('SELECT zone_id, display_id FROM schedules WHERE id = ?').get(zone.json.id) as any;
    assert.ok(zoneRow.zone_id);
    assert.equal(zoneRow.display_id, null);

    const displayId = seedDisplay();
    const display = await http_('POST', '/api/schedules', {
      token: adminToken,
      body: scheduleBody({ zone_id: undefined, display_id: displayId }),
    });
    assert.equal(display.status, 201);
    const displayRow = getDb().prepare('SELECT zone_id, display_id FROM schedules WHERE id = ?').get(display.json.id) as any;
    assert.equal(displayRow.zone_id, null);
    assert.equal(displayRow.display_id, displayId);
  });

  it('rejects schedules with both or neither target', async () => {
    const both = await http_('POST', '/api/schedules', {
      token: adminToken,
      body: scheduleBody({ display_id: seedDisplay() }),
    });
    assert.equal(both.status, 400);

    const neither = await http_('POST', '/api/schedules', {
      token: adminToken,
      body: scheduleBody({ zone_id: undefined, display_id: undefined }),
    });
    assert.equal(neither.status, 400);
  });

  it('rejects missing layout, zone, and display references', async () => {
    const layout = await http_('POST', '/api/schedules', {
      token: adminToken,
      body: scheduleBody({ layout_id: 999999 }),
    });
    assert.equal(layout.status, 400);

    const zone = await http_('POST', '/api/schedules', {
      token: adminToken,
      body: scheduleBody({ zone_id: 999999 }),
    });
    assert.equal(zone.status, 400);

    const display = await http_('POST', '/api/schedules', {
      token: adminToken,
      body: scheduleBody({ zone_id: undefined, display_id: 999999 }),
    });
    assert.equal(display.status, 400);
  });

  it('patches a zone schedule to a display schedule and clears zone_id', async () => {
    const create = await http_('POST', '/api/schedules', {
      token: adminToken,
      body: scheduleBody(),
    });
    assert.equal(create.status, 201);

    const displayId = seedDisplay();
    const patch = await http_('PATCH', `/api/schedules/${create.json.id}`, {
      token: adminToken,
      body: { display_id: displayId },
    });
    assert.equal(patch.status, 200);

    const row = getDb().prepare('SELECT zone_id, display_id FROM schedules WHERE id = ?').get(create.json.id) as any;
    assert.equal(row.zone_id, null);
    assert.equal(row.display_id, displayId);
  });

  it('patches a display schedule to a zone schedule and clears display_id', async () => {
    const displayId = seedDisplay();
    const create = await http_('POST', '/api/schedules', {
      token: adminToken,
      body: scheduleBody({ zone_id: undefined, display_id: displayId }),
    });
    assert.equal(create.status, 201);

    const zoneId = seedZone();
    const patch = await http_('PATCH', `/api/schedules/${create.json.id}`, {
      token: adminToken,
      body: { zone_id: zoneId },
    });
    assert.equal(patch.status, 200);

    const row = getDb().prepare('SELECT zone_id, display_id FROM schedules WHERE id = ?').get(create.json.id) as any;
    assert.equal(row.zone_id, zoneId);
    assert.equal(row.display_id, null);
  });

  it('rejects patches that remove or duplicate the target', async () => {
    const create = await http_('POST', '/api/schedules', {
      token: adminToken,
      body: scheduleBody(),
    });
    assert.equal(create.status, 201);

    const noTarget = await http_('PATCH', `/api/schedules/${create.json.id}`, {
      token: adminToken,
      body: { zone_id: null, display_id: null },
    });
    assert.equal(noTarget.status, 400);

    const both = await http_('PATCH', `/api/schedules/${create.json.id}`, {
      token: adminToken,
      body: { zone_id: seedZone(), display_id: seedDisplay() },
    });
    assert.equal(both.status, 400);
  });
});
