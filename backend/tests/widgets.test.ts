import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { getApp, http_, loginAdmin, tokenForRole, resetRateLimits } from './_helpers';

describe('widgets routes', () => {
  let adminToken: string;

  before(async () => {
    await getApp();
    resetRateLimits();
    adminToken = await loginAdmin();
  });

  it('rejects unauthenticated list', async () => {
    const r = await http_('GET', '/api/widgets');
    assert.equal(r.status, 401);
  });

  it('admin can create a reloj widget', async () => {
    const r = await http_('POST', '/api/widgets', {
      token: adminToken,
      body: { type: 'reloj', name: 'Reloj test', config: { formato: '24h' } },
    });
    assert.equal(r.status, 201);
    assert.ok(r.json.id);
  });

  it('rejects iframe with javascript: URL (SSRF guard, write-time)', async () => {
    const r = await http_('POST', '/api/widgets', {
      token: adminToken,
      body: { type: 'iframe', name: 'evil iframe', config: { url: 'javascript:alert(1)' } },
    });
    assert.equal(r.status, 400);
    assert.match(r.json.error, /url/i);
  });

  it('rejects iframe with file:// URL', async () => {
    const r = await http_('POST', '/api/widgets', {
      token: adminToken,
      body: { type: 'iframe', name: 'file iframe', config: { url: 'file:///etc/passwd' } },
    });
    assert.equal(r.status, 400);
  });

  it('rejects iframe with embedded credentials', async () => {
    const r = await http_('POST', '/api/widgets', {
      token: adminToken,
      body: { type: 'iframe', name: 'creds iframe', config: { url: 'https://user:pass@example.com' } },
    });
    assert.equal(r.status, 400);
  });

  it('accepts iframe with proper https URL', async () => {
    const r = await http_('POST', '/api/widgets', {
      token: adminToken,
      body: { type: 'iframe', name: 'good iframe', config: { url: 'https://example.com/dashboard' } },
    });
    assert.equal(r.status, 201);
  });

  it('rejects beneficios with non-http data_source_url', async () => {
    const r = await http_('POST', '/api/widgets', {
      token: adminToken,
      body: {
        type: 'beneficios',
        name: 'beneficios bad',
        config: { source: 'url', url: 'data:application/json,{"items":[]}' },
      },
    });
    assert.equal(r.status, 400);
  });

  it('rejects clima with custom URL pointing to javascript:', async () => {
    const r = await http_('POST', '/api/widgets', {
      token: adminToken,
      body: {
        type: 'clima',
        name: 'clima bad',
        config: { provider: 'custom', customUrl: 'javascript:alert(1)' },
      },
    });
    assert.equal(r.status, 400);
  });

  it('rejects imagen_url with non-http URL', async () => {
    const r = await http_('POST', '/api/widgets', {
      token: adminToken,
      body: { type: 'imagen_url', name: 'img bad', config: { url: 'file:///etc/hosts' } },
    });
    assert.equal(r.status, 400);
  });

  it('serves data for reloj widget without external fetch', async () => {
    const create = await http_('POST', '/api/widgets', {
      token: adminToken,
      body: { type: 'reloj', name: 'Reloj data', config: { formato: '24h' } },
    });
    assert.equal(create.status, 201);
    const id = create.json.id;
    const data = await http_('GET', `/api/widgets/${id}/data`, { token: adminToken });
    assert.equal(data.status, 200);
    assert.equal(data.json.type, 'reloj');
  });

  it('operator can list widgets but not create', async () => {
    const opToken = await tokenForRole('operator');
    const list = await http_('GET', '/api/widgets', { token: opToken });
    assert.equal(list.status, 200);
    const create = await http_('POST', '/api/widgets', {
      token: opToken,
      body: { type: 'reloj', name: 'op-attempt', config: {} },
    });
    assert.equal(create.status, 403);
  });

  it('blocks payloads larger than 1mb', async () => {
    const huge = 'x'.repeat(1_200_000);
    const r = await http_('POST', '/api/widgets', {
      token: adminToken,
      body: { type: 'texto', name: 'big', config: { texto: huge } },
    });
    assert.equal(r.status, 413);
  });
});
