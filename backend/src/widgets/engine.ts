import { getDb } from '../db';
import { log } from '../logger';
import type { Widget, WidgetType } from '../types';

export interface WidgetContext {
  widget: Widget;
  config: Record<string, any>;
}

export interface WidgetPayload {
  type: WidgetType;
  generatedAt: string;
  ttlSeconds: number;
  data: unknown;
}

type WidgetBuilder = (ctx: WidgetContext) => Promise<WidgetPayload> | WidgetPayload;

const builders: Partial<Record<WidgetType, WidgetBuilder>> = {};

export function registerWidget(type: WidgetType, builder: WidgetBuilder) {
  builders[type] = builder;
}

export function hasBuilder(type: WidgetType): boolean {
  return Boolean(builders[type]);
}

export async function buildWidgetPayload(widget: Widget): Promise<WidgetPayload> {
  const builder = builders[widget.type];
  if (!builder) {
    return {
      type: widget.type,
      generatedAt: new Date().toISOString(),
      ttlSeconds: widget.refresh_seconds,
      data: { error: `No builder registered for widget type: ${widget.type}` },
    };
  }
  let config: Record<string, any> = {};
  try {
    config = widget.config ? JSON.parse(widget.config) : {};
  } catch {
    config = {};
  }
  try {
    return await builder({ widget, config });
  } catch (err) {
    log.error(`Widget builder failed for type ${widget.type}`, err);
    return {
      type: widget.type,
      generatedAt: new Date().toISOString(),
      ttlSeconds: 60,
      data: { error: err instanceof Error ? err.message : String(err) },
    };
  }
}

export async function getWidgetData(widgetId: number, forceRefresh = false): Promise<WidgetPayload> {
  const db = getDb();
  const widget = db.prepare('SELECT * FROM widgets WHERE id = ?').get(widgetId) as Widget | undefined;
  if (!widget) throw new Error('Widget not found');

  if (!forceRefresh && widget.cached_payload && widget.cached_at) {
    const cachedAt = new Date(widget.cached_at).getTime();
    const ageMs = Date.now() - cachedAt;
    if (ageMs < widget.refresh_seconds * 1000) {
      try {
        return JSON.parse(widget.cached_payload);
      } catch { /* fall through to rebuild */ }
    }
  }

  const payload = await buildWidgetPayload(widget);
  db.prepare(`
    UPDATE widgets SET cached_payload = ?, cached_at = datetime('now') WHERE id = ?
  `).run(JSON.stringify(payload), widgetId);

  return payload;
}
