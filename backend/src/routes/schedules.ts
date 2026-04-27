import { Router } from 'express';
import { z } from 'zod';
import { getDb } from '../db';
import { authRequired, roleRequired } from '../auth/middleware';
import { parseBody, nameSchema, idParamSchema } from '../util/validators';
import { NotFound, BadRequest } from '../util/errors';
import { logAudit } from '../util/audit';
import { broadcast } from '../ws/server';
import { queryBool } from '../util/query';

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
});

type ScheduleWrite = z.infer<typeof writeSchema>;
type SchedulePatch = Partial<ScheduleWrite>;
type ScheduleTarget = { zone_id?: number | null; display_id?: number | null };
type ExistingSchedule = {
  layout_id: number;
  zone_id: number | null;
  display_id: number | null;
};

function normalizeTarget(d: ScheduleTarget): { zone_id: number | null; display_id: number | null } {
  const hasZone = d.zone_id !== null && d.zone_id !== undefined;
  const hasDisplay = d.display_id !== null && d.display_id !== undefined;
  if (hasZone === hasDisplay) {
    throw BadRequest('Must target exactly one of zone_id or display_id');
  }
  return {
    zone_id: hasZone ? d.zone_id! : null,
    display_id: hasDisplay ? d.display_id! : null,
  };
}

function ensureExists(db: ReturnType<typeof getDb>, table: 'layouts' | 'zones' | 'displays', id: number, label: string): void {
  const exists = db.prepare(`SELECT id FROM ${table} WHERE id = ?`).get(id);
  if (!exists) throw BadRequest(`${label} not found`);
}

function normalizePatchTarget(existing: ExistingSchedule, data: SchedulePatch): { zone_id: number | null; display_id: number | null } {
  const hasZoneKey = Object.prototype.hasOwnProperty.call(data, 'zone_id');
  const hasDisplayKey = Object.prototype.hasOwnProperty.call(data, 'display_id');

  if (hasZoneKey && hasDisplayKey && data.zone_id !== null && data.zone_id !== undefined && data.display_id !== null && data.display_id !== undefined) {
    throw BadRequest('Must target exactly one of zone_id or display_id');
  }

  if (hasZoneKey && data.zone_id !== null && data.zone_id !== undefined) {
    return normalizeTarget({ zone_id: data.zone_id, display_id: null });
  }
  if (hasDisplayKey && data.display_id !== null && data.display_id !== undefined) {
    return normalizeTarget({ zone_id: null, display_id: data.display_id });
  }

  return normalizeTarget({
    zone_id: hasZoneKey ? data.zone_id ?? null : existing.zone_id,
    display_id: hasDisplayKey ? data.display_id ?? null : existing.display_id,
  });
}

function notifyIfChanged(before: ScheduleTarget, after: ScheduleTarget): void {
  notifyAffected(before.zone_id, before.display_id);
  if (before.zone_id !== after.zone_id || before.display_id !== after.display_id) {
    notifyAffected(after.zone_id, after.display_id);
  }
}

router.use(authRequired);

router.get('/', (req, res, next) => {
  try {
    const db = getDb();
    const query = z.object({
      zone_id: z.coerce.number().int().positive().optional(),
      display_id: z.coerce.number().int().positive().optional(),
      active: queryBool.optional(),
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
    const target = normalizeTarget(data);

    ensureExists(db, 'layouts', data.layout_id, 'Layout');
    if (target.zone_id) ensureExists(db, 'zones', target.zone_id, 'Zone');
    if (target.display_id) ensureExists(db, 'displays', target.display_id, 'Display');

    const info = db.prepare(`
      INSERT INTO schedules
        (layout_id, zone_id, display_id, name, starts_at, ends_at, days_of_week, start_time, end_time, priority, active, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      data.layout_id,
      target.zone_id,
      target.display_id,
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
    notifyAffected(target.zone_id, target.display_id);
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
    const schedule = db.prepare('SELECT layout_id, zone_id, display_id FROM schedules WHERE id = ?').get(id) as ExistingSchedule | undefined;
    if (!schedule) throw NotFound();
    if (Object.keys(data).length === 0) return res.json({ ok: true });
    if (data.layout_id !== undefined) ensureExists(db, 'layouts', data.layout_id, 'Layout');
    const target = normalizePatchTarget(schedule, data);
    if (target.zone_id) ensureExists(db, 'zones', target.zone_id, 'Zone');
    if (target.display_id) ensureExists(db, 'displays', target.display_id, 'Display');

    const updates: string[] = [];
    const values: unknown[] = [];
    for (const [k, v] of Object.entries(data)) {
      if (k === 'zone_id' || k === 'display_id') continue;
      updates.push(`${k} = ?`);
      if (k === 'active') values.push(v ? 1 : 0);
      else values.push(v);
    }
    updates.push('zone_id = ?');
    values.push(target.zone_id);
    updates.push('display_id = ?');
    values.push(target.display_id);
    if (updates.length === 0) return res.json({ ok: true });
    updates.push("updated_at = datetime('now')");
    values.push(id);
    db.prepare(`UPDATE schedules SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    logAudit(req, 'schedule.update', 'schedule', id, data);
    notifyIfChanged(schedule, target);
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
