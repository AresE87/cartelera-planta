import jwt, { SignOptions } from 'jsonwebtoken';
import { config } from '../config';
import type { JwtPayload } from '../types';

export function signUserToken(payload: Omit<JwtPayload, 'type'>): string {
  const opts: SignOptions = { expiresIn: config.auth.jwtExpiresIn as any };
  return jwt.sign({ ...payload, type: 'user' }, config.auth.jwtSecret, opts);
}

export function signDisplayToken(displayId: number): string {
  // Display tokens do not expire — the display can be revoked by regenerating.
  return jwt.sign({ sub: displayId, type: 'display' }, config.auth.jwtSecret);
}

export function verifyToken(token: string): JwtPayload {
  const decoded = jwt.verify(token, config.auth.jwtSecret) as JwtPayload;
  return decoded;
}
