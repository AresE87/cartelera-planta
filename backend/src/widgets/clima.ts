import type { WidgetContext, WidgetPayload } from './engine';
import { safeFetch } from '../util/safe-fetch';

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
    const res = await safeFetch(cfg.customUrl, { timeoutMs: 10_000 });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return {
      type: 'clima',
      generatedAt: new Date().toISOString(),
      ttlSeconds: ctx.widget.refresh_seconds,
      data: res.json(),
    };
  }

  const lat = cfg.lat ?? -34.6;
  const lon = cfg.lon ?? -58.38;
  const nombre = cfg.nombre ?? 'Buenos Aires';

  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,relative_humidity_2m&timezone=auto`;

  try {
    const res = await safeFetch(url, { timeoutMs: 10_000, allowPrivate: false });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = res.json<{ current: unknown }>();
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
