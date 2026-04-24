import type { WidgetContext, WidgetPayload } from './engine';
import { getDb } from '../db';

/**
 * Widget "Alertas" — renderiza alertas activas (sacadas de la tabla alerts).
 * No requiere config externa. Muestra alertas dirigidas a una zona/display
 * específicos si el config incluye filtros.
 */
export async function buildAlertas(ctx: WidgetContext): Promise<WidgetPayload> {
  const cfg = ctx.config as {
    targetType?: 'all' | 'zone' | 'display';
    targetId?: number;
    severity?: Array<'info' | 'warn' | 'critical' | 'emergency'>;
  };

  const db = getDb();
  let sql = `
    SELECT * FROM alerts
    WHERE active = 1
      AND (ends_at IS NULL OR ends_at > datetime('now'))
      AND starts_at <= datetime('now')
  `;
  const args: unknown[] = [];

  if (cfg.targetType && cfg.targetId) {
    sql += ` AND (target_type = 'all' OR (target_type = ? AND target_id = ?))`;
    args.push(cfg.targetType, cfg.targetId);
  }

  if (cfg.severity && cfg.severity.length > 0) {
    sql += ` AND severity IN (${cfg.severity.map(() => '?').join(',')})`;
    args.push(...cfg.severity);
  }

  sql += ' ORDER BY CASE severity WHEN \'emergency\' THEN 0 WHEN \'critical\' THEN 1 WHEN \'warn\' THEN 2 ELSE 3 END, created_at DESC';

  const alerts = db.prepare(sql).all(...args);

  return {
    type: 'alertas',
    generatedAt: new Date().toISOString(),
    ttlSeconds: Math.min(ctx.widget.refresh_seconds, 30),
    data: { alerts },
  };
}
