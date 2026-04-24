import { Router } from 'express';
import { z } from 'zod';
import { getDb } from '../db';
import { verifyPassword } from '../auth/passwords';
import { signUserToken } from '../auth/jwt';
import { authRequired } from '../auth/middleware';
import { parseBody } from '../util/validators';
import { Unauthorized, NotFound } from '../util/errors';
import type { UserWithHash } from '../types';

const router: Router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = parseBody(loginSchema, req.body);
    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE email = ? AND active = 1').get(email) as UserWithHash | undefined;
    if (!user) throw Unauthorized('Invalid credentials');

    const ok = await verifyPassword(password, user.password_hash);
    if (!ok) throw Unauthorized('Invalid credentials');

    db.prepare('UPDATE users SET last_login_at = datetime(\'now\') WHERE id = ?').run(user.id);

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

router.post('/logout', authRequired, (_req, res) => {
  // Stateless JWT — client discards token. Endpoint exists for symmetry.
  res.json({ ok: true });
});

export default router;
