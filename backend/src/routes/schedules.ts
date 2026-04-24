import { Router } from 'express';
import { z } from 'zod';
import { getDb } from '../db';
import { authRequired, roleRequired } from '../auth/middleware';
import { parseBody, nameSchema, idParamSchema } from '../util/validators';
import { NotFound, BadRequest } from '../util/errors';
import { logAudit } from '../util/audit';
import { broadcast } from '../ws/server';

const router: Router = Router();

const writeSchema = z.object({
  layout_id: z.number().int().positive(),
  zone_id: z.number().int().positive().optional().nullable(),
  display_id: z.number().int().positive().optional().nullable(),
  name: nameSchema,
  starts_at: z.string().datetime().optional().nullable(),
  ends_at: z.string().datetime().optional().nullable(),
  days_of_week: z.string().regex(/^[0-6](,[0-6])*$/).optional().nullable(),
  start_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional().nullable(),
  end_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional().nullable(),
  priority: z.number().int().min(0).max(100).optional(),
  active: z.boolean().optional(),
}).refine(d => d.zone_id || d.display_id, { message: 'Must target zone_id or display_id' });

router.use(authRequired);

router.get('/', (req, res, next) => {
  try {
    const db = getDb();
    const query = z.object({
      zone_id: z.coerce.number().int().positive().optional(),
      display_id: z.coerce.number().int().positive().optional(),
      active: z.coerce.boolean().optional(),
    }).parse(req.query);

    let sql = `
      SELECT s.*, l.name AS layout_name, z.name AS zone_name, d.name AS display_name
      FROM schedules s
      JOIN layouts l ON l.id = s.layout_id
      LEFT JOIN zones z ON z.id = s.zone_id
      LEFT JOIN displays d ON d.id = s.display_id
      WHERE 1=1
    `;
    const args: unknown[] = [];
    if (query.zone_id) { sql += ' AND s.zone_id = ?'; args.push(query.zone_id); }
    if (query.display_id) { sql += ' AND s.display_id = ?'; args.push(query.display_id); }
    if (query.active !== undefined) { sql += ' AND s.active = ?'; args.push(query.active ? 1 : 0); }
    sql += ' ORDER BY s.priority DESC, s.created_at DESC';

    const schedules = db.prepare(sql).all(...args);
    res.json({ schedules });
  } catch (err) { next(err); }
});

router.post('/', roleRequired('admin', 'comunicaciones', 'rrhh', 'produccion', 'seguridad'), (req, res, next) => {
  try {
    const data = parseBody(writeSchema, req.body);
    const db = getDb();

    const layout = db.prepare('SELECT id FROM layouts WHERE id = ?').get(data.layout_id);
    if (!layout) throw BadRequest('Layout not found');

    const info = db.prepare(`
      INSERT INTO schedules
        (layout_id, zone_id, display_id, name, starts_at, ends_at, days_of_week, start_time, end_time, priority, active, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      data.layout_id,
      data.zone_id ?? null,
      data.display_id ?? null,
      data.name,
      data.starts_at ?? null,
      data.ends_at ?? null,
      data.days_of_week ?? null,
      data.start_time ?? null,
      data.end_time ?? null,
      data.priority ?? 10,
      data.active !== false ? 1 : 0,
      req.user!.sub,
    );
    logAudit(req, 'schedule.create', 'schedule', Number(info.lastInsertRowid), data);
    notifyAffected(data.zone_id, data.display_id);
    res.status(201).json({ id: info.lastInsertRowid });
  } catch (err) { next(err); }
});

router.get('/:id', (req, res, next) => {
  try {
    const { id } = parseBody(idParamSchema, req.params);
    const db = getDb();
    const schedule = db.prepare('SELECT * FROM schedules WHERE id = ?').get(id);
    if (!schedule) throw NotFound();
    res.json({ schedule });
  } catch (err) { next(err); }
});

router.patch('/:id', roleRequired('admin', 'comunicaciones', 'rrhh', 'produccion', 'seguridad'), (req, res, next) => {
  try {
    const { id } = parseBody(idParamSchema, req.params);
    const data = parseBody(writeSchema.partial(), req.body);
    const db = getDb();
    const schedule = db.prepare('SELECT zone_id, display_id FROM schedules WHERE id = ?').get(id) as any;
    if (!schedule) throw NotFound();

    const updates: string[] = [];
    const values: unknown[] = [];
    for (const [k, v] of Object.entries(data)) {
      updates.push(`${k} = ?`);
      if (k === 'active') values.push(v ? 1 : 0);
      else values.push(v);
    }
    if (updates.length === 0) return res.json({ ok: true });
    updates.push("updated_at = datetime('now')");
    values.push(id);
    db.prepare(`UPDATE schedules SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    logAudit(req, 'schedule.update', 'schedule', id, data);
    notifyAffected(schedule.zone_id, schedule.display_id);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.delete('/:id', roleRequired('admin', 'comunicaciones'), (req, res, next) => {
  try {
    const { id } = parseBody(idParamSchema, req.params);
    const db = getDb();
    const schedule = db.prepare('SELECT zone_id, display_id FROM schedules WHERE id = ?').get(id) as any;
    if (!schedule) throw NotFound();
    db.prepare('DELETE FROM schedules WHERE id = ?').run(id);
    logAudit(req, 'schedule.delete', 'schedule', id);
    notifyAffected(schedule.zone_id, schedule.display_id);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

function notifyAffected(zone_id: number | null | undefined, display_id: number | null | undefined) {
  if (display_id) {
    broadcast({ channel: `display:${display_id}`, event: { type: 'refresh' } });
  } else if (zone_id) {
    broadcast({ channel: `zone:${zone_id}`, event: { type: 'refresh' } });
  } else {
    broadcast({ channel: 'all', event: { type: 'refresh' } });
  }
}

export default router;
