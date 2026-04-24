import type { Request } from 'express';
import { getDb } from '../db';
import { log } from '../logger';

export function logAudit(req: Request, action: string, entityType?: string, entityId?: number, payload?: unknown) {
  try {
    const db = getDb();
    db.prepare(`
      INSERT INTO audit_log (user_id, action, entity_type, entity_id, payload, ip_address, user_agent)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      req.user?.sub ?? null,
      action,
      entityType ?? null,
      entityId ?? null,
      payload ? JSON.stringify(payload) : null,
      req.ip ?? null,
      req.headers['user-agent'] ?? null,
    );
  } catch (err) {
    log.error('audit.insert failed', err);
  }
}
