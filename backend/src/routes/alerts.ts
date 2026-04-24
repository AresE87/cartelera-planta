import { Router } from 'express';
import { z } from 'zod';
import { getDb } from '../db';
import { authRequired, roleRequired } from '../auth/middleware';
import { parseBody, idParamSchema } from '../util/validators';
import { logAudit } from '../util/audit';
import { broadcast } from '../ws/server';
import { NotFound } from '../util/errors';

const router: Router = Router();

const writeSchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().max(5000).optional().nullable(),
  severity: z.enum(['info', 'warn', 'critical', 'emergency']),
  target_type: z.enum(['all', 'zone', 'display']),
  target_id: z.number().int().positive().optional().nullable(),
  icon: z.string().max(64).optional().nullable(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().nullable(),
  duration_seconds: z.number().int().min(5).max(86400).optional().nullable(),
  play_sound: z.boolean().optional(),
});

router.use(authRequired);

router.get('/', (req, res, next) => {
  try {
    const query = z.object({
      active: z.coerce.boolean().optional(),
    }).parse(req.query);
    const db = getDb();
    let sql = `
      SELECT a.*, u.name AS sent_by_name
      FROM alerts a LEFT JOIN users u ON u.id = a.sent_by
      WHERE 1=1
    `;
    const args: unknown[] = [];
    if (query.active !== undefined) {
      sql += ' AND a.active = ?';
      args.push(query.active ? 1 : 0);
    }
    sql += ' ORDER BY a.created_at DESC LIMIT 200';
    const alerts = db.prepare(sql).all(...args);
    res.json({ alerts });
  } catch (err) { next(err); }
});

router.post('/', roleRequired('admin', 'comunicaciones', 'seguridad'), (req, res, next) => {
  try {
    const data = parseBody(writeSchema, req.body);
    const db = getDb();

    const endsAt = data.duration_seconds
      ? new Date(Date.now() + data.duration_seconds * 1000).toISOString()
      : null;

    const info = db.prepare(`
      INSERT INTO alerts
        (title, body, severity, target_type, target_id, icon, color, duration_seconds, play_sound, ends_at, sent_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      data.title,
      data.body ?? null,
      data.severity,
      data.target_type,
      data.target_id ?? null,
      data.icon ?? null,
      data.color ?? null,
      data.duration_seconds ?? null,
      data.play_sound ? 1 : 0,
      endsAt,
      req.user!.sub,
    );

    const id = Number(info.lastInsertRowid);
    const alert = db.prepare('SELECT * FROM alerts WHERE id = ?').get(id);
    logAudit(req, 'alert.create', 'alert', id, { severity: data.severity, target: data.target_type });

    // Broadcast push
    if (data.target_type === 'all') {
      broadcast({ channel: 'all', event: { type: 'alert', alert } });
    } else if (data.target_type === 'zone') {
      broadcast({ channel: `zone:${data.target_id}`, event: { type: 'alert', alert } });
    } else if (data.target_type === 'display') {
      broadcast({ channel: `display:${data.target_id}`, event: { type: 'alert', alert } });
    }

    res.status(201).json({ id, alert });
  } catch (err) { next(err); }
});

router.post('/:id/dismiss', roleRequired('admin', 'comunicaciones', 'seguridad'), (req, res, next) => {
  try {
    const { id } = parseBody(idParamSchema, req.params);
    const db = getDb();
    const info = db.prepare('UPDATE alerts SET active = 0 WHERE id = ?').run(id);
    if (info.changes === 0) throw NotFound();
    logAudit(req, 'alert.dismiss', 'alert', id);
    broadcast({ channel: 'all', event: { type: 'alert_dismiss', id } });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

export default router;
