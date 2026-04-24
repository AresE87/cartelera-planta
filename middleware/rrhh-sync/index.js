/**
 * Middleware RRHH — expone tres endpoints que consumen los widgets:
 *   GET /beneficios   — array de beneficios vigentes
 *   GET /cumpleanos   — personas que cumplen años este mes
 *   GET /avisos       — avisos de gestión de personas
 *
 * En esta versión base, lee de archivos JSON en /data para arrancar.
 * Reemplazá las funciones `fetchXxx()` para conectar a tu sistema real:
 *   - SQL: usá node-mssql, mysql2, pg, etc.
 *   - SOAP/SAP: usá soap package o node-fetch
 *   - API externa: usá fetch nativo
 */

const express = require('express');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT || 4001);
const DATA_DIR = process.env.DATA_DIR || path.resolve(__dirname, 'data');
const REFRESH_MS = Number(process.env.REFRESH_MS || 5 * 60 * 1000);  // 5 min

// ---- In-memory cache ----
let cache = {
  beneficios: { items: [], lastFetched: null, error: null },
  cumpleanos: { people: [], lastFetched: null, error: null },
  avisos:     { items: [], lastFetched: null, error: null },
};

// ---- Simulated fetchers (reemplazar por conexiones reales) ----
async function fetchBeneficios() {
  // Real implementation: connect to SAP, intranet, SharePoint, etc.
  const file = path.join(DATA_DIR, 'beneficios.json');
  if (fs.existsSync(file)) {
    const raw = fs.readFileSync(file, 'utf8');
    const parsed = JSON.parse(raw);
    return parsed.items || parsed;
  }
  return [
    { id: 1, titulo: 'Descuento en gimnasios', descripcion: 'Hasta 20% en gimnasios adheridos', categoria: 'bienestar', vigencia: endOfMonth() },
    { id: 2, titulo: 'Día por cumpleaños', descripcion: 'Tomate libre el día del cumpleaños', categoria: 'tiempo libre' },
    { id: 3, titulo: 'Reintegro guardería', descripcion: 'Reintegro mensual por hijo', categoria: 'familia' },
  ];
}

async function fetchCumpleanos() {
  const file = path.join(DATA_DIR, 'cumpleanos.json');
  if (fs.existsSync(file)) {
    const raw = fs.readFileSync(file, 'utf8');
    const parsed = JSON.parse(raw);
    return parsed.people || parsed;
  }
  // Simulated: build a list for current month
  const now = new Date();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const mk = (d, nombre, apellido, area) => ({
    nombre, apellido,
    fecha: `${now.getFullYear()}-${m}-${String(d).padStart(2, '0')}`,
    area,
  });
  return [
    mk(5,  'Juan',    'Pérez',    'Producción'),
    mk(12, 'Carlos',  'López',    'Mantenimiento'),
    mk(19, 'Ana',     'Martínez', 'Calidad'),
    mk(27, 'Laura',   'Fernández','Seguridad'),
  ];
}

async function fetchAvisos() {
  const file = path.join(DATA_DIR, 'avisos.json');
  if (fs.existsSync(file)) {
    const raw = fs.readFileSync(file, 'utf8');
    const parsed = JSON.parse(raw);
    return parsed.items || parsed;
  }
  return [
    { id: 1, titulo: 'Capacitación obligatoria HSE', cuerpo: 'Viernes 10hs en auditorio', prioridad: 'alta', fecha: new Date().toISOString() },
    { id: 2, titulo: 'Encuesta de clima laboral', cuerpo: 'Disponible en intranet hasta fin de mes', prioridad: 'media', fecha: new Date().toISOString() },
  ];
}

function endOfMonth() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString();
}

// ---- Refresh loop ----
async function refresh(kind, fetcher) {
  try {
    const data = await fetcher();
    if (kind === 'cumpleanos') cache[kind].people = data;
    else cache[kind].items = data;
    cache[kind].lastFetched = new Date().toISOString();
    cache[kind].error = null;
    console.log(`[rrhh-sync] refreshed ${kind}: ${data.length} records`);
  } catch (err) {
    cache[kind].error = err.message || String(err);
    console.error(`[rrhh-sync] refresh ${kind} failed:`, err);
  }
}

async function refreshAll() {
  await Promise.all([
    refresh('beneficios', fetchBeneficios),
    refresh('cumpleanos', fetchCumpleanos),
    refresh('avisos',     fetchAvisos),
  ]);
}

// ---- HTTP server ----
const app = express();

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'rrhh-sync',
    cache: {
      beneficios: { count: cache.beneficios.items.length, lastFetched: cache.beneficios.lastFetched, error: cache.beneficios.error },
      cumpleanos: { count: cache.cumpleanos.people.length, lastFetched: cache.cumpleanos.lastFetched, error: cache.cumpleanos.error },
      avisos:     { count: cache.avisos.items.length,     lastFetched: cache.avisos.lastFetched,     error: cache.avisos.error },
    },
  });
});

app.get('/beneficios', (_req, res) => res.json({ items: cache.beneficios.items }));
app.get('/cumpleanos', (_req, res) => res.json({ people: cache.cumpleanos.people, month: new Date().getMonth() + 1 }));
app.get('/avisos',     (_req, res) => res.json({ items: cache.avisos.items }));

app.post('/refresh', async (_req, res) => {
  await refreshAll();
  res.json({ ok: true });
});

// Initial + periodic refresh
refreshAll();
setInterval(refreshAll, REFRESH_MS);

app.listen(PORT, () => {
  console.log(`[rrhh-sync] listening on :${PORT}`);
  console.log(`[rrhh-sync] data dir: ${DATA_DIR}`);
});
