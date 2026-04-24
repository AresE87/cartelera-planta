import type { WidgetContext, WidgetPayload } from './engine';

export function buildReloj(ctx: WidgetContext): WidgetPayload {
  const cfg = ctx.config as {
    formato?: '24h' | '12h';
    mostrarFecha?: boolean;
    tz?: string;
    estilo?: 'digital' | 'analogico';
  };

  return {
    type: 'reloj',
    generatedAt: new Date().toISOString(),
    ttlSeconds: 3600,
    data: {
      formato: cfg.formato ?? '24h',
      mostrarFecha: cfg.mostrarFecha ?? true,
      tz: cfg.tz ?? 'America/Argentina/Buenos_Aires',
      estilo: cfg.estilo ?? 'digital',
    },
  };
}
