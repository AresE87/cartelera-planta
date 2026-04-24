import { Router } from 'express';
import { z } from 'zod';
import { getDb } from '../db';
import { authRequired, roleRequired } from '../auth/middleware';
import { parseBody, nameSchema, idParamSchema } from '../util/validators';
import { NotFound } from '../util/errors';
import { logAudit } from '../util/audit';

const router: Router = Router();

const writeSchema = z.object({
  name: nameSchema,
  description: z.string().max(1000).optional().nullable(),
  parent_id: z.number().int().positive().optional().nullable(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

router.use(authRequired);

router.get('/', (_req, res, next) => {
  try {
    const db = getDb();
    const zones = db.prepare(`
      SELECT z.*,
        (SELECT COUNT(*) FROM displays d WHERE d.zone_id = z.id) AS display_count
      FROM zones z ORDER BY z.name
    `).all();
    res.json({ zones });
  } catch (err) { next(err); }
});

router.post('/', roleRequired('admin', 'comunicaciones'), (req, res, next) => {
  try {
    const data = parseBody(writeSchema, req.body);
    const db = getDb();
    const info = db.prepare(`
      INSERT INTO zones (name, description, parent_id, color)
      VALUES (?, ?, ?, ?)
    `).run(data.name, data.description ?? null, data.parent_id ?? null, data.color ?? '#3b82f6');
    logAudit(req, 'zone.create', 'zone', Number(info.lastInsertRowid), data);
    res.status(201).json({ id: info.lastInsertRowid });
  } catch (err) { next(err); }
});

router.get('/:id', (req, res, next) => {
  try {
    const { id } = parseBody(idParamSchema, req.params);
    const db = getDb();
    const zone = db.prepare('SELECT * FROM zones WHERE id = ?').get(id);
    if (!zone) throw NotFound();
    const displays = db.prepare('SELECT id, name, status, last_seen_at FROM displays WHERE zone_id = ?').all(id);
    res.json({ zone, displays });
  } catch (err) { next(err); }
});

router.patch('/:id', roleRequired('admin', 'comunicaciones'), (req, res, next) => {
  try {
    const { id } = parseBody(idParamSchema, req.params);
    const data = parseBody(writeSchema.partial(), req.body);
    const db = getDb();
    const zone = db.prepare('SELECT id FROM zones WHERE id = ?').get(id);
    if (!zone) throw NotFound();

    const updates: string[] = [];
    const values: unknown[] = [];
    for (const [k, v] of Object.entries(data)) {
      updates.push(`${k} = ?`);
      values.push(v);
    }
    if (updates.length === 0) return res.json({ ok: true });
    updates.push("updated_at = datetime('now')");
    values.push(id);
    db.prepare(`UPDATE zones SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    logAudit(req, 'zone.update', 'zone', id, data);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.delete('/:id', roleRequired('admin'), (req, res, next) => {
  try {
    const { id } = parseBody(idParamSchema, req.params);
    const db = getDb();
    const info = db.prepare('DELETE FROM zones WHERE id = ?').run(id);
    if (info.changes === 0) throw NotFound();
    logAudit(req, 'zone.delete', 'zone', id);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

export default router;
