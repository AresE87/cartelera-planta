import { Router } from 'express';
import { z } from 'zod';
import { getDb } from '../db';
import { parseBody } from '../util/validators';
import { BadRequest, NotFound } from '../util/errors';
import { signDisplayToken } from '../auth/jwt';
import { displayAuthRequired } from '../auth/middleware';
import { getWidgetData } from '../widgets';
import { resolveCurrentLayout } from '../services/scheduler';
import { log } from '../logger';

const router: Router = Router();

const pairSchema = z.object({
  code: z.string().length(6),
  hardware_info: z.record(z.unknown()).optional(),
  user_agent: z.string().optional(),
});

/**
 * Public: a player sends its pairing code to get an api_token.
 */
router.post('/pair', (req, res, next) => {
  try {
    const data = parseBody(pairSchema, req.body);
    const db = getDb();
    const display = db.prepare(`
      SELECT id, pairing_expires_at FROM displays
      WHERE pairing_code = ?
        AND pairing_expires_at > datetime('now')
    `).get(data.code) as { id: number; pairing_expires_at: string } | undefined;

    if (!display) throw BadRequest('Invalid or expired pairing code');

    const token = signDisplayToken(display.id);
    db.prepare(`
      UPDATE displays SET
        api_token = ?,
        pairing_code = NULL,
        pairing_expires_at = NULL,
        status = 'online',
        last_seen_at = datetime('now'),
        ip_address = ?,
        user_agent = ?,
        hardware_info = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `).run(
      token,
      req.ip ?? null,
      data.user_agent ?? req.headers['user-agent'] ?? null,
      data.hardware_info ? JSON.stringify(data.hardware_info) : null,
      display.id,
    );

    log.info('Display paired', { displayId: display.id });
    res.json({ token, display_id: display.id });
  } catch (err) { next(err); }
});

router.use(displayAuthRequired);

router.get('/config', (req, res, next) => {
  try {
    const displayId = req.displayId!;
    const db = getDb();
    const display = db.prepare(`
      SELECT d.*, z.name AS zone_name
      FROM displays d
      LEFT JOIN zones z ON z.id = d.zone_id
      WHERE d.id = ?
    `).get(displayId) as any;
    if (!display) throw NotFound('Display not found');

    const layout = resolveCurrentLayout(displayId, display.zone_id);

    // Active alerts targeted to this display or its zone or "all"
    const alerts = db.prepare(`
      SELECT * FROM alerts
      WHERE active = 1
        AND (ends_at IS NULL OR ends_at > datetime('now'))
        AND starts_at <= datetime('now')
        AND (
          target_type = 'all'
          OR (target_type = 'zone' AND target_id = ?)
          OR (target_type = 'display' AND target_id = ?)
        )
      ORDER BY CASE severity
        WHEN 'emergency' THEN 0 WHEN 'critical' THEN 1 WHEN 'warn' THEN 2 ELSE 3 END
    `).all(display.zone_id, displayId);

    res.json({
      display: {
        id: display.id,
        name: display.name,
        zone_id: display.zone_id,
        zone_name: display.zone_name,
        resolution: display.resolution,
        orientation: display.orientation,
      },
      layout,
      alerts,
      server_time: new Date().toISOString(),
    });
  } catch (err) { next(err); }
});

const heartbeatSchema = z.object({
  cpu: z.number().optional(),
  memory: z.number().optional(),
  uptime_s: z.number().int().optional(),
  version: z.string().max(32).optional(),
});

router.post('/heartbeat', (req, res, next) => {
  try {
    const data = parseBody(heartbeatSchema, req.body);
    const displayId = req.displayId!;
    const db = getDb();
    db.prepare(`
      UPDATE displays SET
        status = 'online',
        last_seen_at = datetime('now'),
        ip_address = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `).run(req.ip ?? null, displayId);

    db.prepare(`
      INSERT INTO heartbeats (display_id, cpu, memory, uptime_s, version)
      VALUES (?, ?, ?, ?, ?)
    `).run(displayId, data.cpu ?? null, data.memory ?? null, data.uptime_s ?? null, data.version ?? null);

    res.json({ ok: true, server_time: new Date().toISOString() });
  } catch (err) { next(err); }
});

router.get('/widget/:id/data', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) throw BadRequest('Invalid widget id');
    const payload = await getWidgetData(id);
    res.json(payload);
  } catch (err) { next(err); }
});

export default router;
