import { Router } from 'express';
import { z } from 'zod';
import { getDb } from '../db';
import { hashPassword, verifyPassword } from '../auth/passwords';
import { signUserToken } from '../auth/jwt';
import { authRequired } from '../auth/middleware';
import { parseBody } from '../util/validators';
import { BadRequest, Unauthorized, NotFound } from '../util/errors';
import { logAudit } from '../util/audit';
import { recordFailed, isLocked, clearFailures } from '../auth/lockout';
import { validatePassword } from '../auth/password-policy';
import type { UserWithHash } from '../types';

const router: Router = Router();

const loginSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(1).max(256),
});

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = parseBody(loginSchema, req.body);
    const normEmail = email.toLowerCase();

    const lockState = isLocked(normEmail);
    if (lockState.locked) {
      res.setHeader('Retry-After', String(lockState.retryAfterSec ?? 900));
      return res.status(429).json({
        error: 'Cuenta temporalmente bloqueada por multiples intentos fallidos. Proba mas tarde.',
        code: 'account_locked',
        retryAfterSeconds: lockState.retryAfterSec,
      });
    }

    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE email = ? AND active = 1').get(normEmail) as UserWithHash | undefined;
    if (!user) {
      recordFailed(normEmail);
      throw Unauthorized('Invalid credentials');
    }

    const ok = await verifyPassword(password, user.password_hash);
    if (!ok) {
      const r = recordFailed(normEmail);
      if (r.locked) res.setHeader('Retry-After', String(r.retryAfterSec ?? 900));
      throw Unauthorized('Invalid credentials');
    }

    clearFailures(normEmail);
    db.prepare('UPDATE users SET last_login_at = datetime(\'now\') WHERE id = ?').run(user.id);
    try {
      db.prepare(`
        INSERT INTO audit_log (user_id, action, entity_type, entity_id, ip_address, user_agent)
        VALUES (?, 'auth.login_ok', 'user', ?, ?, ?)
      `).run(user.id, user.id, req.ip ?? null, req.headers['user-agent'] ?? null);
    } catch { /* audit best-effort */ }

    const token = signUserToken({ sub: user.id, email: user.email, role: user.role });
    res.json({
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    });
  } catch (err) {
    next(err);
  }
});

router.get('/me', authRequired, (req, res, next) => {
  try {
    const db = getDb();
    const user = db.prepare('SELECT id, email, name, role, active, last_login_at, created_at FROM users WHERE id = ?')
      .get(req.user!.sub);
    if (!user) throw NotFound('User not found');
    res.json({ user });
  } catch (err) {
    next(err);
  }
});

router.post('/logout', authRequired, (req, res) => {
  logAudit(req, 'auth.logout', 'user', req.user!.sub);
  // Stateless JWT — client discards token. Endpoint exists for symmetry.
  res.json({ ok: true });
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(256),
  newPassword: z.string().min(8).max(128),
});

router.post('/change-password', authRequired, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = parseBody(changePasswordSchema, req.body);
    const policy = validatePassword(newPassword);
    if (!policy.ok) throw BadRequest(policy.reason ?? 'Weak password');

    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user!.sub) as UserWithHash | undefined;
    if (!user) throw NotFound();

    const ok = await verifyPassword(currentPassword, user.password_hash);
    if (!ok) throw Unauthorized('Current password incorrect');

    const newHash = await hashPassword(newPassword);
    db.prepare("UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?")
      .run(newHash, user.id);
    logAudit(req, 'auth.password_change', 'user', user.id);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
