import { Router } from 'express';
import { z } from 'zod';
import { getDb } from '../db';
import { authRequired, roleRequired } from '../auth/middleware';
import { parseBody, nameSchema, idParamSchema } from '../util/validators';
import { NotFound } from '../util/errors';
import { logAudit } from '../util/audit';

const router: Router = Router();

const layoutItemSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('media'), mediaId: z.number().int().positive(), durationMs: z.number().int().min(500) }),
  z.object({ type: z.literal('widget'), widgetId: z.number().int().positive(), durationMs: z.number().int().min(500) }),
  z.object({ type: z.literal('text'), text: z.string().max(10000), durationMs: z.number().int().min(500), style: z.record(z.string()).optional() }),
]);

const regionSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().max(128).optional(),
  x: z.number().int().min(0),
  y: z.number().int().min(0),
  w: z.number().int().min(1),
  h: z.number().int().min(1),
  items: z.array(layoutItemSchema).min(1),
  loop: z.boolean().optional(),
  transition: z.enum(['none', 'fade', 'slide']).optional(),
});

const definitionSchema = z.object({
  regions: z.array(regionSchema).min(1),
  globalStyle: z.record(z.string()).optional(),
});

const writeSchema = z.object({
  name: nameSchema,
  description: z.string().max(1000).optional().nullable(),
  width: z.number().int().min(320).max(7680).optional(),
  height: z.number().int().min(240).max(4320).optional(),
  background_color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  definition: definitionSchema,
  published: z.boolean().optional(),
});

router.use(authRequired);

router.get('/', (_req, res, next) => {
  try {
    const db = getDb();
    const layouts = db.prepare(`
      SELECT l.id, l.name, l.description, l.width, l.height, l.background_color, l.published, l.created_at, l.updated_at,
             u.name AS created_by_name
      FROM layouts l
      LEFT JOIN users u ON u.id = l.created_by
      ORDER BY l.updated_at DESC
    `).all();
    res.json({ layouts });
  } catch (err) { next(err); }
});

router.post('/', roleRequired('admin', 'comunicaciones', 'rrhh', 'produccion', 'seguridad'), (req, res, next) => {
  try {
    const data = parseBody(writeSchema, req.body);
    const db = getDb();
    const info = db.prepare(`
      INSERT INTO layouts (name, description, width, height, background_color, definition, published, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      data.name,
      data.description ?? null,
      data.width ?? 1920,
      data.height ?? 1080,
      data.background_color ?? '#000000',
      JSON.stringify(data.definition),
      data.published !== false ? 1 : 0,
      req.user!.sub,
    );
    logAudit(req, 'layout.create', 'layout', Number(info.lastInsertRowid), { name: data.name });
    res.status(201).json({ id: info.lastInsertRowid });
  } catch (err) { next(err); }
});

router.get('/:id', (req, res, next) => {
  try {
    const { id } = parseBody(idParamSchema, req.params);
    const db = getDb();
    const layout = db.prepare('SELECT * FROM layouts WHERE id = ?').get(id) as any;
    if (!layout) throw NotFound();
    try { layout.definition = JSON.parse(layout.definition); } catch {}
    res.json({ layout });
  } catch (err) { next(err); }
});

router.patch('/:id', roleRequired('admin', 'comunicaciones', 'rrhh', 'produccion', 'seguridad'), (req, res, next) => {
  try {
    const { id } = parseBody(idParamSchema, req.params);
    const data = parseBody(writeSchema.partial(), req.body);
    const db = getDb();
    const layout = db.prepare('SELECT id FROM layouts WHERE id = ?').get(id);
    if (!layout) throw NotFound();

    const updates: string[] = [];
    const values: unknown[] = [];
    if (data.name !== undefined) { updates.push('name = ?'); values.push(data.name); }
    if (data.description !== undefined) { updates.push('description = ?'); values.push(data.description); }
    if (data.width !== undefined) { updates.push('width = ?'); values.push(data.width); }
    if (data.height !== undefined) { updates.push('height = ?'); values.push(data.height); }
    if (data.background_color !== undefined) { updates.push('background_color = ?'); values.push(data.background_color); }
    if (data.definition !== undefined) { updates.push('definition = ?'); values.push(JSON.stringify(data.definition)); }
    if (data.published !== undefined) { updates.push('published = ?'); values.push(data.published ? 1 : 0); }
    if (updates.length === 0) return res.json({ ok: true });
    updates.push("updated_at = datetime('now')");
    values.push(id);
    db.prepare(`UPDATE layouts SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    logAudit(req, 'layout.update', 'layout', id);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.delete('/:id', roleRequired('admin'), (req, res, next) => {
  try {
    const { id } = parseBody(idParamSchema, req.params);
    const db = getDb();
    const info = db.prepare('DELETE FROM layouts WHERE id = ?').run(id);
    if (info.changes === 0) throw NotFound();
    logAudit(req, 'layout.delete', 'layout', id);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.post('/:id/duplicate', roleRequired('admin', 'comunicaciones', 'rrhh', 'produccion', 'seguridad'), (req, res, next) => {
  try {
    const { id } = parseBody(idParamSchema, req.params);
    const db = getDb();
    const src = db.prepare('SELECT * FROM layouts WHERE id = ?').get(id) as any;
    if (!src) throw NotFound();
    const info = db.prepare(`
      INSERT INTO layouts (name, description, width, height, background_color, definition, published, created_by)
      VALUES (?, ?, ?, ?, ?, ?, 0, ?)
    `).run(
      `${src.name} (copia)`,
      src.description,
      src.width,
      src.height,
      src.background_color,
      src.definition,
      req.user!.sub,
    );
    logAudit(req, 'layout.duplicate', 'layout', Number(info.lastInsertRowid), { from: id });
    res.status(201).json({ id: info.lastInsertRowid });
  } catch (err) { next(err); }
});

export default router;
