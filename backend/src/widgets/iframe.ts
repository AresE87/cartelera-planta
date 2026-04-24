import type { WidgetContext, WidgetPayload } from './engine';

export function buildIframe(ctx: WidgetContext): WidgetPayload {
  const cfg = ctx.config as { url?: string; sandbox?: string };
  return {
    type: 'iframe',
    generatedAt: new Date().toISOString(),
    ttlSeconds: ctx.widget.refresh_seconds,
    data: { url: cfg.url ?? '', sandbox: cfg.sandbox ?? 'allow-scripts allow-same-origin' },
  };
}
