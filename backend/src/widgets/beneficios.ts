import type { WidgetContext, WidgetPayload } from './engine';
import { safeFetch } from '../util/safe-fetch';

interface Beneficio {
  id: string | number;
  titulo: string;
  descripcion?: string;
  vigencia?: string;
  imagen?: string;
  categoria?: string;
  destacado?: boolean;
}

/**
 * Widget "Beneficios" — rotates vigente benefits with corporate design.
 *
 * Config:
 *   source: 'static' | 'url'
 *   items:  Beneficio[] (when source === 'static')
 *   url:    string      (when source === 'url')
 *   filtros:
 *     onlyActive?: boolean
 *     categoria?: string
 */
export async function buildBeneficios(ctx: WidgetContext): Promise<WidgetPayload> {
  const cfg = ctx.config as {
    source?: 'static' | 'url';
    items?: Beneficio[];
    url?: string;
    filtros?: { onlyActive?: boolean; categoria?: string };
  };

  let items: Beneficio[] = [];

  if (cfg.source === 'url' && (cfg.url || ctx.widget.data_source_url)) {
    const url = cfg.url || ctx.widget.data_source_url!;
    const res = await safeFetch(url, { timeoutMs: 10_000 });
    if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
    const json = res.json<unknown>();
    items = Array.isArray(json) ? json as Beneficio[] : ((json as any)?.items ?? []);
  } else {
    items = cfg.items ?? [];
  }

  if (cfg.filtros?.onlyActive) {
    const now = Date.now();
    items = items.filter(b => {
      if (!b.vigencia) return true;
      const d = Date.parse(b.vigencia);
      return Number.isNaN(d) || d >= now;
    });
  }
  if (cfg.filtros?.categoria) {
    items = items.filter(b => b.categoria === cfg.filtros!.categoria);
  }

  return {
    type: 'beneficios',
    generatedAt: new Date().toISOString(),
    ttlSeconds: ctx.widget.refresh_seconds,
    data: { items },
  };
}
