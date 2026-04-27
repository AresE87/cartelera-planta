import type { Request, Response, NextFunction } from 'express';
import { verifyToken } from './jwt';
import { Unauthorized, Forbidden } from '../util/errors';
import type { JwtPayload, Role } from '../types';
import { getDb } from '../db';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: JwtPayload;
      displayId?: number;
    }
  }
}

function extractToken(req: Request): string | null {
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) return auth.slice(7).trim();
  const q = req.query.token;
  if (typeof q === 'string' && q.length > 0) return q;
  return null;
}

export function authRequired(req: Request, _res: Response, next: NextFunction) {
  const token = extractToken(req);
  if (!token) return next(Unauthorized('Token required'));
  try {
    const payload = verifyToken(token);
    if (payload.type !== 'user') return next(Unauthorized('User token required'));
    req.user = payload;
    next();
  } catch {
    next(Unauthorized('Invalid or expired token'));
  }
}

export function displayAuthRequired(req: Request, _res: Response, next: NextFunction) {
  const token = extractToken(req);
  if (!token) return next(Unauthorized('Display token required'));
  try {
    const payload = verifyToken(token);
    if (payload.type !== 'display') return next(Unauthorized('Display token required'));
    const display = getDb()
      .prepare('SELECT api_token FROM displays WHERE id = ?')
      .get(payload.sub) as { api_token: string | null } | undefined;
    if (!display || !display.api_token || display.api_token !== token) {
      return next(Unauthorized('Invalid display token'));
    }
    req.displayId = payload.sub;
    next();
  } catch {
    next(Unauthorized('Invalid display token'));
  }
}

export function roleRequired(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(Unauthorized());
    if (!roles.includes(req.user.role)) {
      return next(Forbidden(`Role required: ${roles.join(', ')}`));
    }
    next();
  };
}

export const adminOnly = roleRequired('admin');
