/**
 * Middleware Producción — expone KPIs de líneas.
 *
 * Esta es la versión simulada. Para producción real:
 *   - Conectar a MES / SCADA vía OPC-UA, MQTT, Modbus, etc.
 *   - O leer del SQL que usa el MES para sus dashboards.
 *   - O consumir un endpoint REST si el MES lo expone.
 */

const express = require('express');

const PORT = Number(process.env.PORT || 4002);
const REFRESH_MS = Number(process.env.REFRESH_MS || 30_000);  // KPIs changan rápido

let cache = { kpis: [], lastFetched: null, error: null };

async function fetchKpis() {
  // Simulated: jitter around target values
  const j = (v, variance) => v + (Math.random() - 0.5) * variance;
  return [
    { id: 'oee',       label: 'OEE Línea 1',        value: Math.round(j(87, 4) * 10) / 10,   unit: '%', target: 85, trend: j(0, 1) > 0 ? 'up' : 'down', color: '#10b981', icon: '📊' },
    { id: 'oee2',      label: 'OEE Línea 2',        value: Math.round(j(82, 6) * 10) / 10,   unit: '%', target: 85, trend: j(0, 1) > 0 ? 'up' : 'down', color: '#f59e0b', icon: '📊' },
    { id: 'prod',      label: 'Unidades hoy',        value: Math.round(j(12400, 800)),        unit: 'u', target: 12000, trend: 'up', color: '#3b82f6', icon: '📦' },
    { id: 'calidad',   label: 'Rechazos',           value: Math.round(j(0.9, 0.4) * 10) / 10, unit: '%', target: 1.5, trend: 'down', color: '#10b981', icon: '✓' },
    { id: 'seguridad', label: 'Días sin accidentes', value: Math.floor(j(127, 0)),             unit: 'd', color: '#f59e0b', icon: '🛡' },
    { id: 'paradas',   label: 'Paradas no planeadas hoy', value: Math.floor(j(2, 2)),           unit: '', color: '#ef4444', icon: '⏸' },
  ];
}

async function refresh() {
  try {
    cache.kpis = await fetchKpis();
    cache.lastFetched = new Date().toISOString();
    cache.error = null;
    console.log(`[produccion] refreshed ${cache.kpis.length} KPIs`);
  } catch (err) {
    cache.error = err.message || String(err);
    console.error('[produccion] refresh failed:', err);
  }
}

const app = express();

app.get('/health', (_req, res) => res.json({ ok: true, service: 'produccion-adapter', cache }));
app.get('/kpis',   (_req, res) => res.json({ kpis: cache.kpis, lastFetched: cache.lastFetched }));
app.post('/refresh', async (_req, res) => { await refresh(); res.json({ ok: true }); });

refresh();
setInterval(refresh, REFRESH_MS);
app.listen(PORT, () => console.log(`[produccion-adapter] listening on :${PORT}`));
