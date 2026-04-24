import type { WidgetContext, WidgetPayload } from './engine';
import { safeFetch } from '../util/safe-fetch';

interface Aviso {
  id: string | number;
  titulo: string;
  cuerpo?: string;
  autor?: string;
  fecha?: string;
  prioridad?: 'baja' | 'media' | 'alta';
  etiquetas?: string[];
}

export async function buildAvisos(ctx: WidgetContext): Promise<WidgetPayload> {
  const cfg = ctx.config as {
    source?: 'static' | 'url';
    items?: Aviso[];
    url?: string;
    limit?: number;
  };

  let items: Aviso[] = [];
  if (cfg.source === 'url' && (cfg.url || ctx.widget.data_source_url)) {
    const url = cfg.url || ctx.widget.data_source_url!;
    const res = await safeFetch(url, { timeoutMs: 10_000 });
    if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
    const json = res.json<unknown>();
    items = Array.isArray(json) ? json as Aviso[] : ((json as any)?.items ?? []);
  } else {
    items = cfg.items ?? [];
  }

  items.sort((a, b) => {
    const pa = prioOrder(a.prioridad);
    const pb = prioOrder(b.prioridad);
    if (pa !== pb) return pa - pb;
    const da = a.fecha ? Date.parse(a.fecha) : 0;
    const db = b.fecha ? Date.parse(b.fecha) : 0;
    return db - da;
  });

  if (cfg.limit) items = items.slice(0, cfg.limit);

  return {
    type: 'avisos',
    generatedAt: new Date().toISOString(),
    ttlSeconds: ctx.widget.refresh_seconds,
    data: { items },
  };
}

function prioOrder(p?: string): number {
  return p === 'alta' ? 0 : p === 'media' ? 1 : 2;
}
