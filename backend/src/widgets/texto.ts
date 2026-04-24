import type { WidgetContext, WidgetPayload } from './engine';

export function buildTexto(ctx: WidgetContext): WidgetPayload {
  const cfg = ctx.config as {
    texto?: string;
    estilo?: Record<string, string>;
    alineacion?: 'left' | 'center' | 'right';
    animacion?: 'none' | 'marquee' | 'fade';
  };
  return {
    type: 'texto',
    generatedAt: new Date().toISOString(),
    ttlSeconds: ctx.widget.refresh_seconds,
    data: {
      texto: cfg.texto ?? '',
      estilo: cfg.estilo ?? {},
      alineacion: cfg.alineacion ?? 'center',
      animacion: cfg.animacion ?? 'none',
    },
  };
}
