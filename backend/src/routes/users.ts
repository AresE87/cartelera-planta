import { Router } from 'express';
import { z } from 'zod';
import { getDb } from '../db';
import { authRequired, adminOnly } from '../auth/middleware';
import { parseBody, emailSchema, passwordSchema, nameSchema, roleSchema, idParamSchema } from '../util/validators';
import { hashPassword } from '../auth/passwords';
import { NotFound, Conflict, BadRequest } from '../util/errors';
import { logAudit } from '../util/audit';
import { validatePassword } from '../auth/password-policy';

const router: Router = Router();

const createSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: nameSchema,
  role: roleSchema,
});

const updateSchema = z.object({
  name: nameSchema.optional(),
  role: roleSchema.optional(),
  active: z.boolean().optional(),
  password: passwordSchema.optional(),
});

router.use(authRequired, adminOnly);

router.get('/', (_req, res, next) => {
  try {
    const db = getDb();
    const users = db.prepare('SELECT id, email, name, role, active, last_login_at, created_at FROM users ORDER BY created_at DESC').all();
    res.json({ users });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const data = parseBody(createSchema, req.body);
    const policy = validatePassword(data.password);
    if (!policy.ok) throw BadRequest(policy.reason ?? 'Weak password');

    const db = getDb();
    const normEmail = data.email.toLowerCase();
    const exists = db.prepare('SELECT 1 FROM users WHERE email = ?').get(normEmail);
    if (exists) throw Conflict('Email already registered');
    const hash = await hashPassword(data.password);
    const info = db.prepare('INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, ?)')
      .run(normEmail, hash, data.name, data.role);
    logAudit(req, 'user.create', 'user', Number(info.lastInsertRowid), { email: normEmail, role: data.role });
    res.status(201).json({ id: info.lastInsertRowid });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', (req, res, next) => {
  try {
    const { id } = parseBody(idParamSchema, req.params);
    const db = getDb();
    const user = db.prepare('SELECT id, email, name, role, active, last_login_at, created_at FROM users WHERE id = ?').get(id);
    if (!user) throw NotFound();
    res.json({ user });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const { id } = parseBody(idParamSchema, req.params);
    const data = parseBody(updateSchema, req.body);
    const db = getDb();
    const user = db.prepare('SELECT id FROM users WHERE id = ?').get(id);
    if (!user) throw NotFound();

    const updates: string[] = [];
    const values: unknown[] = [];
    if (data.name !== undefined) { updates.push('name = ?'); values.push(data.name); }
    if (data.role !== undefined) { updates.push('role = ?'); values.push(data.role); }
    if (data.active !== undefined) { updates.push('active = ?'); values.push(data.active ? 1 : 0); }
    if (data.password !== undefined) {
      const policy = validatePassword(data.password);
      if (!policy.ok) throw BadRequest(policy.reason ?? 'Weak password');
      updates.push('password_hash = ?');
      values.push(await hashPassword(data.password));
    }
    if (updates.length === 0) return res.json({ ok: true });
    updates.push("updated_at = datetime('now')");
    values.push(id);
    db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    logAudit(req, 'user.update', 'user', id, data);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', (req, res, next) => {
  try {
    const { id } = parseBody(idParamSchema, req.params);
    if (id === req.user!.sub) {
      return res.status(400).json({ error: 'Cannot delete yourself' });
    }
    const db = getDb();
    const info = db.prepare('DELETE FROM users WHERE id = ?').run(id);
    if (info.changes === 0) throw NotFound();
    logAudit(req, 'user.delete', 'user', id);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
