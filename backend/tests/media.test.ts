import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { getApp, getDb, http_, loginAdmin } from './_helpers';

describe('media routes', () => {
  let adminToken: string;
  let baseUrl: string;

  before(async () => { await getApp(); });

  before(async () => {
    const app = await getApp();
    baseUrl = app.baseUrl;
    adminToken = await loginAdmin();
  });

  async function uploadBlob(mime: string, filename: string): Promise<Response> {
    const body = new FormData();
    body.append('file', new Blob(['cartelera'], { type: mime }), filename);
    return fetch(`${baseUrl}/api/media/upload`, {
      method: 'POST',
      headers: { authorization: `Bearer ${adminToken}` },
      body,
    });
  }

  it('uploads and serves safe media by id for display layouts without admin auth', async () => {
    const upload = await uploadBlob('image/png', 'safe.png');
    assert.equal(upload.status, 201);
    const json = await upload.json() as { id: number };

    const r = await http_('GET', `/api/media/${json.id}/file`);
    assert.equal(r.status, 200);
    assert.match(r.headers.get('content-type') ?? '', /image\/png/);
  });

  it('rejects executable html and svg uploads with 400', async () => {
    const html = await uploadBlob('text/html', 'bad.html');
    assert.equal(html.status, 400);

    const svg = await uploadBlob('image/svg+xml', 'bad.svg');
    assert.equal(svg.status, 400);
  });

  it('blocks legacy html media records from being served', async () => {
    const uploadsDir = process.env.UPLOADS_DIR!;
    fs.mkdirSync(uploadsDir, { recursive: true });
    const filename = `test-media-${Date.now()}.html`;
    fs.writeFileSync(path.join(uploadsDir, filename), '<strong>cartelera</strong>', 'utf8');

    const info = getDb().prepare(`
      INSERT INTO media (type, filename, original_name, mime_type, size_bytes)
      VALUES ('html', ?, 'test.html', 'text/html', ?)
    `).run(filename, Buffer.byteLength('<strong>cartelera</strong>'));

    const r = await http_('GET', `/api/media/${Number(info.lastInsertRowid)}/file`);
    assert.equal(r.status, 415);
  });

  it('blocks legacy svg media records from being served', async () => {
    const info = getDb().prepare(`
      INSERT INTO media (type, filename, original_name, mime_type, size_bytes)
      VALUES ('image', 'legacy.svg', 'legacy.svg', 'image/svg+xml', 11)
    `).run();

    const r = await http_('GET', `/api/media/${Number(info.lastInsertRowid)}/file`);
    assert.equal(r.status, 415);
  });
});
