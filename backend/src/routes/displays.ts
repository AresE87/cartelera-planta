import { Router } from 'express';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { getDb } from '../db';
import { authRequired, roleRequired } from '../auth/middleware';
import { parseBody, nameSchema, idParamSchema } from '../util/validators';
import { NotFound, Conflict, BadRequest } from '../util/errors';
import { logAudit } from '../util/audit';
import { signDisplayToken } from '../auth/jwt';
import { broadcast } from '../ws/server';

const router: Router = Router();

const writeSchema = z.object({
  name: nameSchema,
  description: z.string().max(1000).optional().nullable(),
  zone_id: z.number().int().positive().optional().nullable(),
  resolution: z.string().regex(/^\d+x\d+$/).optional(),
  orientation: z.enum(['landscape', 'portrait']).optional(),
});

router.use(authRequired);

router.get('/', (_req, res, next) => {
  try {
    const db = getDb();
    const displays = db.prepare(`
      SELECT d.*, z.name AS zone_name, l.name AS current_layout_name
      FROM displays d
      LEFT JOIN zones   z ON z.id = d.zone_id
      LEFT JOIN layouts l ON l.id = d.current_layout_id
      ORDER BY d.name
    `).all();
    res.json({ displays });
  } catch (err) { next(err); }
});

router.post('/', roleRequired('admin', 'comunicaciones'), (req, res, next) => {
  try {
    const data = parseBody(writeSchema, req.body);
    const db = getDb();
    const code = genPairingCode();
    const info = db.prepare(`
      INSERT INTO displays (name, description, zone_id, resolution, orientation, pairing_code, pairing_expires_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now', '+30 minutes'))
    `).run(
      data.name,
      data.description ?? null,
      data.zone_id ?? null,
      data.resolution ?? '1920x1080',
      data.orientation ?? 'landscape',
      code,
    );
    logAudit(req, 'display.create', 'display', Number(info.lastInsertRowid), data);
    res.status(201).json({ id: info.lastInsertRowid, pairing_code: code });
  } catch (err) { next(err); }
});

router.get('/:id', (req, res, next) => {
  try {
    const { id } = parseBody(idParamSchema, req.params);
    const db = getDb();
    const display = db.prepare(`
      SELECT d.*, z.name AS zone_name, l.name AS current_layout_name
      FROM displays d
      LEFT JOIN zones   z ON z.id = d.zone_id
      LEFT JOIN layouts l ON l.id = d.current_layout_id
      WHERE d.id = ?
    `).get(id);
    if (!display) throw NotFound();
    const heartbeats = db.prepare('SELECT * FROM heartbeats WHERE display_id = ? ORDER BY created_at DESC LIMIT 20').all(id);
    res.json({ display, heartbeats });
  } catch (err) { next(err); }
});

router.patch('/:id', roleRequired('admin', 'comunicaciones'), (req, res, next) => {
  try {
    const { id } = parseBody(idParamSchema, req.params);
    const data = parseBody(writeSchema.partial(), req.body);
    const db = getDb();
    const display = db.prepare('SELECT id FROM displays WHERE id = ?').get(id);
    if (!display) throw NotFound();

    const updates: string[] = [];
    const values: unknown[] = [];
    for (const [k, v] of Object.entries(data)) {
      updates.push(`${k} = ?`);
      values.push(v);
    }
    if (updates.length === 0) return res.json({ ok: true });
    updates.push("updated_at = datetime('now')");
    values.push(id);
    db.prepare(`UPDATE displays SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    logAudit(req, 'display.update', 'display', id, data);
    broadcast({ channel: `display:${id}`, event: { type: 'refresh' } });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.delete('/:id', roleRequired('admin'), (req, res, next) => {
  try {
    const { id } = parseBody(idParamSchema, req.params);
    const db = getDb();
    const info = db.prepare('DELETE FROM displays WHERE id = ?').run(id);
    if (info.changes === 0) throw NotFound();
    logAudit(req, 'display.delete', 'display', id);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.post('/:id/regenerate-pairing', roleRequired('admin', 'comunicaciones'), (req, res, next) => {
  try {
    const { id } = parseBody(idParamSchema, req.params);
    const db = getDb();
    const code = genPairingCode();
    const info = db.prepare(`
      UPDATE displays
      SET pairing_code = ?,
          pairing_expires_at = datetime('now', '+30 minutes'),
          api_token = NULL,
          updated_at = datetime('now')
      WHERE id = ?
    `).run(code, id);
    if (info.changes === 0) throw NotFound();
    logAudit(req, 'display.regenerate_pairing', 'display', id);
    res.json({ pairing_code: code });
  } catch (err) { next(err); }
});

router.post('/:id/set-layout', roleRequired('admin', 'comunicaciones', 'rrhh', 'produccion', 'seguridad'), (req, res, next) => {
  try {
    const { id } = parseBody(idParamSchema, req.params);
    const { layout_id } = parseBody(z.object({ layout_id: z.number().int().positive() }), req.body);
    const db = getDb();
    const layout = db.prepare('SELECT id FROM layouts WHERE id = ?').get(layout_id);
    if (!layout) throw BadRequest('Layout not found');
    const info = db.prepare('UPDATE displays SET current_layout_id = ?, updated_at = datetime(\'now\') WHERE id = ?').run(layout_id, id);
    if (info.changes === 0) throw NotFound();
    logAudit(req, 'display.set_layout', 'display', id, { layout_id });
    broadcast({ channel: `display:${id}`, event: { type: 'layout_change', layoutId: layout_id } });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.post('/:id/reload', roleRequired('admin', 'comunicaciones'), (req, res, next) => {
  try {
    const { id } = parseBody(idParamSchema, req.params);
    const db = getDb();
    const display = db.prepare('SELECT id FROM displays WHERE id = ?').get(id);
    if (!display) throw NotFound();
    broadcast({ channel: `display:${id}`, event: { type: 'refresh' } });
    logAudit(req, 'display.reload', 'display', id);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// Public pairing endpoint (no auth) — players use this with their pairing code
const pairSchema = z.object({
  code: z.string().length(6),
  hardware_info: z.record(z.unknown()).optional(),
});

router.post('/pair', (req, res, next) => {
  // NB: this sub-route is mounted under '/displays' but auth middleware above
  // won't match since we redefined the router. Keeping it public requires
  // re-mounting; see index router wiring.
  next(new Error('pair should be mounted under /api/player/pair'));
});

export { pairSchema, writeSchema as displayWriteSchema };

function genPairingCode(): string {
  // 6 chars, easy to read on a TV (no 0/O, I/L ambiguous)
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export default router;
