import { Router } from 'express';
import { z } from 'zod';
import { getDb } from '../db';
import { authRequired, roleRequired } from '../auth/middleware';
import { parseBody, nameSchema, idParamSchema } from '../util/validators';
import { BadRequest, NotFound } from '../util/errors';
import { logAudit } from '../util/audit';
import { getWidgetData } from '../widgets';
import { broadcast } from '../ws/server';
import { assertHttpUrl, SafeFetchError } from '../util/safe-fetch';
import type { WidgetType } from '../types';

const router: Router = Router();

const widgetTypeSchema = z.enum([
  'beneficios', 'cumpleanos', 'avisos', 'kpis', 'alertas',
  'clima', 'reloj', 'rss', 'texto', 'imagen_url', 'youtube', 'iframe',
]);

const writeSchema = z.object({
  type: widgetTypeSchema,
  name: nameSchema,
  description: z.string().max(1000).optional().nullable(),
  config: z.record(z.unknown()),
  data_source_url: z.string().max(2048).optional().nullable(),
  refresh_seconds: z.number().int().min(10).max(86400).optional(),
});

function validateUrlField(value: unknown, label: string): void {
  if (value === undefined || value === null || value === '') return;
  if (typeof value !== 'string') {
    throw BadRequest(`${label} must be a string URL`);
  }
  try {
    assertHttpUrl(value);
  } catch (err) {
    if (err instanceof SafeFetchError) {
      throw BadRequest(`${label}: ${err.message}`);
    }
    throw err;
  }
}

function validateWidgetConfig(type: WidgetType, config: Record<string, unknown> | undefined, dataSourceUrl: string | null | undefined): void {
  if (dataSourceUrl) validateUrlField(dataSourceUrl, 'data_source_url');
  if (!config) return;

  switch (type) {
    case 'iframe':
      validateUrlField(config.url, 'config.url');
      break;
    case 'imagen_url':
      validateUrlField(config.url, 'config.url');
      break;
    case 'clima':
      if (config.provider === 'custom') validateUrlField(config.customUrl, 'config.customUrl');
      break;
    case 'rss':
    case 'beneficios':
    case 'cumpleanos':
    case 'avisos':
    case 'kpis':
      if (config.source === 'url') validateUrlField(config.url, 'config.url');
      break;
    case 'youtube':
      if (config.url !== undefined && config.url !== null && config.url !== '') {
        // Accept arbitrary YouTube share URLs (extracted to videoId server-side)
        if (typeof config.url !== 'string') throw BadRequest('config.url must be a string');
      }
      break;
    default:
      // No URL fields expected
      break;
  }
}

router.use(authRequired);

router.get('/', (_req, res, next) => {
  try {
    const db = getDb();
    const widgets = db.prepare(`
      SELECT id, type, name, description, refresh_seconds, cached_at, created_at, updated_at
      FROM widgets ORDER BY updated_at DESC
    `).all();
    res.json({ widgets });
  } catch (err) { next(err); }
});

router.post('/', roleRequired('admin', 'comunicaciones', 'rrhh', 'produccion', 'seguridad'), (req, res, next) => {
  try {
    const data = parseBody(writeSchema, req.body);
    validateWidgetConfig(data.type, data.config, data.data_source_url);
    const db = getDb();
    const info = db.prepare(`
      INSERT INTO widgets (type, name, description, config, data_source_url, refresh_seconds, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      data.type,
      data.name,
      data.description ?? null,
      JSON.stringify(data.config),
      data.data_source_url ?? null,
      data.refresh_seconds ?? 300,
      req.user!.sub,
    );
    logAudit(req, 'widget.create', 'widget', Number(info.lastInsertRowid), { type: data.type });
    res.status(201).json({ id: info.lastInsertRowid });
  } catch (err) { next(err); }
});

router.get('/:id', (req, res, next) => {
  try {
    const { id } = parseBody(idParamSchema, req.params);
    const db = getDb();
    const widget = db.prepare('SELECT * FROM widgets WHERE id = ?').get(id) as any;
    if (!widget) throw NotFound();
    try { widget.config = JSON.parse(widget.config); } catch {}
    try { widget.cached_payload = widget.cached_payload ? JSON.parse(widget.cached_payload) : null; } catch {}
    res.json({ widget });
  } catch (err) { next(err); }
});

router.patch('/:id', roleRequired('admin', 'comunicaciones', 'rrhh', 'produccion', 'seguridad'), (req, res, next) => {
  try {
    const { id } = parseBody(idParamSchema, req.params);
    const data = parseBody(writeSchema.partial(), req.body);
    const db = getDb();
    const existing = db.prepare('SELECT type, config, data_source_url FROM widgets WHERE id = ?').get(id) as
      | { type: WidgetType; config: string; data_source_url: string | null }
      | undefined;
    if (!existing) throw NotFound();

    const effectiveType = (data.type ?? existing.type) as WidgetType;
    let effectiveConfig: Record<string, unknown> | undefined;
    if (data.config !== undefined) {
      effectiveConfig = data.config;
    } else {
      try { effectiveConfig = JSON.parse(existing.config); } catch { effectiveConfig = {}; }
    }
    const effectiveDataUrl = data.data_source_url !== undefined ? data.data_source_url : existing.data_source_url;
    validateWidgetConfig(effectiveType, effectiveConfig, effectiveDataUrl);

    const updates: string[] = [];
    const values: unknown[] = [];
    if (data.name !== undefined) { updates.push('name = ?'); values.push(data.name); }
    if (data.description !== undefined) { updates.push('description = ?'); values.push(data.description); }
    if (data.config !== undefined) { updates.push('config = ?'); values.push(JSON.stringify(data.config)); }
    if (data.data_source_url !== undefined) { updates.push('data_source_url = ?'); values.push(data.data_source_url); }
    if (data.refresh_seconds !== undefined) { updates.push('refresh_seconds = ?'); values.push(data.refresh_seconds); }
    if (data.type !== undefined) { updates.push('type = ?'); values.push(data.type); }
    if (updates.length === 0) return res.json({ ok: true });
    updates.push('cached_payload = NULL');
    updates.push('cached_at = NULL');
    updates.push("updated_at = datetime('now')");
    values.push(id);
    db.prepare(`UPDATE widgets SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    logAudit(req, 'widget.update', 'widget', id);
    broadcast({ channel: 'all', event: { type: 'widget_update', widgetId: id } });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.delete('/:id', roleRequired('admin', 'comunicaciones'), (req, res, next) => {
  try {
    const { id } = parseBody(idParamSchema, req.params);
    const db = getDb();
    const info = db.prepare('DELETE FROM widgets WHERE id = ?').run(id);
    if (info.changes === 0) throw NotFound();
    logAudit(req, 'widget.delete', 'widget', id);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.get('/:id/data', async (req, res, next) => {
  try {
    const { id } = parseBody(idParamSchema, req.params);
    const payload = await getWidgetData(id);
    res.json(payload);
  } catch (err) { next(err); }
});

router.post('/:id/refresh', async (req, res, next) => {
  try {
    const { id } = parseBody(idParamSchema, req.params);
    const payload = await getWidgetData(id, true);
    broadcast({ channel: 'all', event: { type: 'widget_update', widgetId: id } });
    res.json(payload);
  } catch (err) { next(err); }
});

export default router;
