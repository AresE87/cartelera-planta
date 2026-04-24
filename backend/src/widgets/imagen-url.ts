import type { WidgetContext, WidgetPayload } from './engine';

export function buildImagenUrl(ctx: WidgetContext): WidgetPayload {
  const cfg = ctx.config as { url?: string; fit?: 'cover' | 'contain' | 'fill' };
  return {
    type: 'imagen_url',
    generatedAt: new Date().toISOString(),
    ttlSeconds: ctx.widget.refresh_seconds,
    data: { url: cfg.url ?? '', fit: cfg.fit ?? 'cover' },
  };
}
