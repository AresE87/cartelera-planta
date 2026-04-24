import type { WidgetContext, WidgetPayload } from './engine';
import { safeFetch } from '../util/safe-fetch';

interface Persona {
  nombre: string;
  apellido?: string;
  fecha: string;
  area?: string;
  foto?: string;
}

/**
 * Widget "Cumpleaños del mes"
 *
 * Config:
 *   source: 'static' | 'url'
 *   people: Persona[] (static)
 *   url:    string    (url)
 *   month?: number    (1..12, defaults to current)
 *   dayOnly?: boolean (show only today)
 */
export async function buildCumpleanos(ctx: WidgetContext): Promise<WidgetPayload> {
  const cfg = ctx.config as {
    source?: 'static' | 'url';
    people?: Persona[];
    url?: string;
    month?: number;
    dayOnly?: boolean;
  };

  let people: Persona[] = [];
  if (cfg.source === 'url' && (cfg.url || ctx.widget.data_source_url)) {
    const url = cfg.url || ctx.widget.data_source_url!;
    const res = await safeFetch(url, { timeoutMs: 10_000 });
    if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
    const json = res.json<unknown>();
    people = Array.isArray(json) ? json as Persona[] : ((json as any)?.people ?? []);
  } else {
    people = cfg.people ?? [];
  }

  const now = new Date();
  const targetMonth = cfg.month ?? (now.getMonth() + 1);

  let filtered = people.filter(p => {
    const d = new Date(p.fecha);
    if (Number.isNaN(d.getTime())) return false;
    if (cfg.dayOnly) {
      return d.getMonth() + 1 === now.getMonth() + 1 && d.getDate() === now.getDate();
    }
    return d.getMonth() + 1 === targetMonth;
  });

  filtered.sort((a, b) => {
    const da = new Date(a.fecha).getDate();
    const dbx = new Date(b.fecha).getDate();
    return da - dbx;
  });

  return {
    type: 'cumpleanos',
    generatedAt: new Date().toISOString(),
    ttlSeconds: ctx.widget.refresh_seconds,
    data: { month: targetMonth, people: filtered, total: filtered.length },
  };
}
