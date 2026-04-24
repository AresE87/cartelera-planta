import { getDb } from '../db';

/**
 * Resolve which layout a given display should be showing RIGHT NOW.
 * Precedence (higher wins):
 *   1. Highest priority among matching schedules
 *   2. Display-specific schedules over zone-wide
 *   3. Most recently created tie-breaker
 *   4. Fall back to display.current_layout_id
 *   5. Fall back to a default "no content" layout
 */
export function resolveCurrentLayout(displayId: number, zoneId: number | null): {
  id: number | null;
  name?: string;
  width?: number;
  height?: number;
  background_color?: string;
  definition?: unknown;
  source: 'schedule' | 'current' | 'fallback';
} {
  const db = getDb();
  const now = new Date();
  const dow = now.getDay(); // 0..6
  const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const nowIso = now.toISOString();

  // Find matching active schedules
  let sql = `
    SELECT s.*, l.name, l.width, l.height, l.background_color, l.definition
    FROM schedules s
    JOIN layouts l ON l.id = s.layout_id
    WHERE s.active = 1
      AND (s.display_id = ? OR (s.zone_id = ? AND s.display_id IS NULL))
      AND (s.starts_at IS NULL OR s.starts_at <= ?)
      AND (s.ends_at   IS NULL OR s.ends_at   >  ?)
    ORDER BY (s.display_id IS NOT NULL) DESC, s.priority DESC, s.created_at DESC
  `;
  const rows = db.prepare(sql).all(displayId, zoneId, nowIso, nowIso) as any[];

  for (const row of rows) {
    if (row.days_of_week) {
      const dows = row.days_of_week.split(',').map((x: string) => Number(x));
      if (!dows.includes(dow)) continue;
    }
    if (row.start_time && row.end_time) {
      if (!(hhmm >= row.start_time && hhmm < row.end_time)) continue;
    } else if (row.start_time && !row.end_time) {
      if (!(hhmm >= row.start_time)) continue;
    } else if (row.end_time && !row.start_time) {
      if (!(hhmm < row.end_time)) continue;
    }
    return {
      id: row.layout_id,
      name: row.name,
      width: row.width,
      height: row.height,
      background_color: row.background_color,
      definition: safeParse(row.definition),
      source: 'schedule',
    };
  }

  // Fallback to current_layout_id
  const display = db.prepare('SELECT current_layout_id FROM displays WHERE id = ?').get(displayId) as any;
  if (display?.current_layout_id) {
    const layout = db.prepare('SELECT id, name, width, height, background_color, definition FROM layouts WHERE id = ? AND published = 1').get(display.current_layout_id) as any;
    if (layout) {
      return {
        id: layout.id,
        name: layout.name,
        width: layout.width,
        height: layout.height,
        background_color: layout.background_color,
        definition: safeParse(layout.definition),
        source: 'current',
      };
    }
  }

  return { id: null, source: 'fallback' };
}

function safeParse(s: string): unknown {
  try { return JSON.parse(s); } catch { return null; }
}
