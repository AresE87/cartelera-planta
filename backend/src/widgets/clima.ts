import type { WidgetContext, WidgetPayload } from './engine';

/**
 * Widget "Clima" — usa Open-Meteo (gratis, sin key) o un endpoint custom.
 * Config:
 *   lat, lon: coordenadas
 *   nombre: string (para mostrar)
 */
export async function buildClima(ctx: WidgetContext): Promise<WidgetPayload> {
  const cfg = ctx.config as {
    lat?: number;
    lon?: number;
    nombre?: string;
    provider?: 'open-meteo' | 'custom';
    customUrl?: string;
  };

  if (cfg.provider === 'custom' && cfg.customUrl) {
    const res = await fetch(cfg.customUrl, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return {
      type: 'clima',
      generatedAt: new Date().toISOString(),
      ttlSeconds: ctx.widget.refresh_seconds,
      data,
    };
  }

  const lat = cfg.lat ?? -34.6;
  const lon = cfg.lon ?? -58.38;
  const nombre = cfg.nombre ?? 'Buenos Aires';

  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,relative_humidity_2m&timezone=auto`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json() as any;
    return {
      type: 'clima',
      generatedAt: new Date().toISOString(),
      ttlSeconds: ctx.widget.refresh_seconds,
      data: {
        nombre,
        lat, lon,
        current: json.current,
      },
    };
  } catch (err) {
    return {
      type: 'clima',
      generatedAt: new Date().toISOString(),
      ttlSeconds: 60,
      data: { nombre, error: err instanceof Error ? err.message : 'fetch failed' },
    };
  }
}
