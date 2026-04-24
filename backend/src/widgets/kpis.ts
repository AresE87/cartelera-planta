import type { WidgetContext, WidgetPayload } from './engine';
import { safeFetch } from '../util/safe-fetch';

interface Kpi {
  id: string;
  label: string;
  value: number | string;
  unit?: string;
  target?: number;
  trend?: 'up' | 'down' | 'flat';
  color?: string;
  icon?: string;
  updatedAt?: string;
}

export async function buildKpis(ctx: WidgetContext): Promise<WidgetPayload> {
  const cfg = ctx.config as {
    source?: 'static' | 'url';
    kpis?: Kpi[];
    url?: string;
    layout?: 'grid' | 'list';
  };

  let kpis: Kpi[] = [];
  if (cfg.source === 'url' && (cfg.url || ctx.widget.data_source_url)) {
    const url = cfg.url || ctx.widget.data_source_url!;
    const res = await safeFetch(url, { timeoutMs: 10_000 });
    if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
    const json = res.json<unknown>();
    kpis = Array.isArray(json) ? json as Kpi[] : ((json as any)?.kpis ?? []);
  } else {
    kpis = cfg.kpis ?? [];
  }

  return {
    type: 'kpis',
    generatedAt: new Date().toISOString(),
    ttlSeconds: ctx.widget.refresh_seconds,
    data: { layout: cfg.layout ?? 'grid', kpis },
  };
}
