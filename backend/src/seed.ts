import 'dotenv/config';
import { getDb } from './db';
import { hashPassword } from './auth/passwords';
import { log } from './logger';

async function seed() {
  const db = getDb();

  // ---- Users ----
  const userSpecs: Array<{ email: string; password: string; name: string; role: string }> = [
    { email: 'admin@cartelera.local',     password: 'admin1234',     name: 'Administrador',         role: 'admin' },
    { email: 'rrhh@cartelera.local',      password: 'rrhh1234',      name: 'Gestión de Personas',   role: 'rrhh' },
    { email: 'produccion@cartelera.local',password: 'prod1234',      name: 'Producción',            role: 'produccion' },
    { email: 'seguridad@cartelera.local', password: 'seg1234',       name: 'Seguridad / HSE',       role: 'seguridad' },
    { email: 'comms@cartelera.local',     password: 'comms1234',     name: 'Comunicaciones',        role: 'comunicaciones' },
    { email: 'operador@cartelera.local',  password: 'operador1234',  name: 'Operador',              role: 'operator' },
  ];

  for (const u of userSpecs) {
    const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(u.email);
    if (!exists) {
      const hash = await hashPassword(u.password);
      db.prepare('INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, ?)')
        .run(u.email, hash, u.name, u.role);
      log.info(`Created user: ${u.email} (${u.role})`);
    }
  }

  // ---- Zones ----
  const zoneSpecs: Array<{ name: string; description: string; color: string }> = [
    { name: 'Comedor',               description: 'TV del comedor principal', color: '#10b981' },
    { name: 'Producción',            description: 'Líneas de producción',      color: '#f59e0b' },
    { name: 'Oficinas',              description: 'Áreas administrativas',     color: '#3b82f6' },
    { name: 'Ingresos',              description: 'Recepción y bienvenida',    color: '#8b5cf6' },
    { name: 'Seguridad',             description: 'Alertas HSE',               color: '#ef4444' },
    { name: 'Sala de descanso',      description: 'Vestuarios / pausa',        color: '#14b8a6' },
  ];
  for (const z of zoneSpecs) {
    const exists = db.prepare('SELECT id FROM zones WHERE name = ?').get(z.name);
    if (!exists) {
      db.prepare('INSERT INTO zones (name, description, color) VALUES (?, ?, ?)').run(z.name, z.description, z.color);
      log.info(`Created zone: ${z.name}`);
    }
  }

  const comedor = db.prepare('SELECT id FROM zones WHERE name = \'Comedor\'').get() as { id: number };

  // ---- Widgets ----
  const widgetSpecs: Array<{ type: string; name: string; config: unknown; refresh_seconds: number }> = [
    {
      type: 'beneficios',
      name: 'Beneficios del mes',
      refresh_seconds: 300,
      config: {
        source: 'static',
        items: [
          { id: 1, titulo: 'Descuento 20% en gimnasios', descripcion: 'Válido en gimnasios adheridos hasta fin de mes', categoria: 'bienestar', destacado: true },
          { id: 2, titulo: 'Día libre por cumpleaños', descripcion: 'Podés tomarte el día del cumpleaños o el viernes siguiente', categoria: 'tiempo libre' },
          { id: 3, titulo: 'Curso gratuito de inglés', descripcion: '3 niveles disponibles. Inscripciones por intranet', categoria: 'capacitación' },
          { id: 4, titulo: 'Subsidio por guardería', descripcion: 'Reintegro hasta $50.000/mes por hijo menor de 4 años', categoria: 'familia' },
          { id: 5, titulo: 'Convenio con obra social', descripcion: 'Cobertura ampliada sin cargo adicional', categoria: 'salud' },
        ],
      },
    },
    {
      type: 'cumpleanos',
      name: 'Cumpleaños del mes',
      refresh_seconds: 3600,
      config: {
        source: 'static',
        people: [
          { nombre: 'Juan',     apellido: 'Pérez',   fecha: thisMonthDay(5),  area: 'Producción' },
          { nombre: 'María',    apellido: 'García',  fecha: thisMonthDay(8),  area: 'RRHH' },
          { nombre: 'Carlos',   apellido: 'López',   fecha: thisMonthDay(12), area: 'Mantenimiento' },
          { nombre: 'Ana',      apellido: 'Martínez',fecha: thisMonthDay(18), area: 'Administración' },
          { nombre: 'Roberto',  apellido: 'Silva',   fecha: thisMonthDay(22), area: 'Calidad' },
          { nombre: 'Laura',    apellido: 'Fernández',fecha: thisMonthDay(27),area: 'Seguridad' },
        ],
      },
    },
    {
      type: 'reloj',
      name: 'Reloj comedor',
      refresh_seconds: 3600,
      config: { formato: '24h', mostrarFecha: true, estilo: 'digital' },
    },
    {
      type: 'clima',
      name: 'Clima Buenos Aires',
      refresh_seconds: 900,
      config: { lat: -34.6, lon: -58.38, nombre: 'Buenos Aires' },
    },
    {
      type: 'avisos',
      name: 'Avisos generales',
      refresh_seconds: 300,
      config: {
        source: 'static',
        items: [
          { id: 1, titulo: 'Simulacro de evacuación', cuerpo: 'Viernes 12hs. Por favor seguir las indicaciones del personal de HSE.', prioridad: 'alta', fecha: new Date().toISOString() },
          { id: 2, titulo: 'Reunión mensual de seguridad', cuerpo: 'Lunes 9hs en auditorio', prioridad: 'media', fecha: new Date().toISOString() },
          { id: 3, titulo: 'Actualización beneficios', cuerpo: 'Nuevos descuentos disponibles. Consultá la intranet.', prioridad: 'baja', fecha: new Date().toISOString() },
        ],
      },
    },
    {
      type: 'kpis',
      name: 'KPIs producción demo',
      refresh_seconds: 60,
      config: {
        source: 'static',
        layout: 'grid',
        kpis: [
          { id: 'oee',       label: 'OEE Línea 1',       value: 87.3, unit: '%',  target: 85, trend: 'up',   color: '#10b981', icon: '📊' },
          { id: 'prod',      label: 'Unidades hoy',       value: 12450, unit: 'u', target: 12000, trend: 'up', color: '#3b82f6', icon: '📦' },
          { id: 'calidad',   label: 'Rechazos',          value: 0.8, unit: '%',  target: 1.5, trend: 'down', color: '#10b981', icon: '✓' },
          { id: 'seguridad', label: 'Días sin accidente', value: 127, unit: 'd',                          color: '#f59e0b', icon: '⚠' },
        ],
      },
    },
  ];

  for (const w of widgetSpecs) {
    const exists = db.prepare('SELECT id FROM widgets WHERE name = ?').get(w.name);
    if (!exists) {
      db.prepare(`
        INSERT INTO widgets (type, name, config, refresh_seconds)
        VALUES (?, ?, ?, ?)
      `).run(w.type, w.name, JSON.stringify(w.config), w.refresh_seconds);
      log.info(`Created widget: ${w.name}`);
    }
  }

  // ---- Default layout for comedor ----
  const beneficios = db.prepare('SELECT id FROM widgets WHERE name = ?').get('Beneficios del mes') as { id: number };
  const cumples = db.prepare('SELECT id FROM widgets WHERE name = ?').get('Cumpleaños del mes') as { id: number };
  const reloj = db.prepare('SELECT id FROM widgets WHERE name = ?').get('Reloj comedor') as { id: number };
  const clima = db.prepare('SELECT id FROM widgets WHERE name = ?').get('Clima Buenos Aires') as { id: number };
  const avisos = db.prepare('SELECT id FROM widgets WHERE name = ?').get('Avisos generales') as { id: number };
  const kpis = db.prepare('SELECT id FROM widgets WHERE name = ?').get('KPIs producción demo') as { id: number };

  const layoutExists = db.prepare('SELECT id FROM layouts WHERE name = ?').get('Comedor — layout base');
  if (!layoutExists) {
    const definition = {
      regions: [
        {
          id: 'header',
          name: 'Header',
          x: 0, y: 0, w: 1920, h: 120,
          items: [
            { type: 'widget', widgetId: reloj.id, durationMs: 999999 },
          ],
        },
        {
          id: 'principal',
          name: 'Contenido principal',
          x: 0, y: 120, w: 1280, h: 840,
          items: [
            { type: 'widget', widgetId: beneficios.id, durationMs: 12000 },
            { type: 'widget', widgetId: cumples.id,    durationMs: 12000 },
            { type: 'widget', widgetId: avisos.id,     durationMs: 10000 },
          ],
          loop: true,
          transition: 'fade',
        },
        {
          id: 'sidebar',
          name: 'Lateral',
          x: 1280, y: 120, w: 640, h: 840,
          items: [
            { type: 'widget', widgetId: clima.id, durationMs: 15000 },
            { type: 'widget', widgetId: kpis.id,  durationMs: 15000 },
          ],
          loop: true,
          transition: 'fade',
        },
        {
          id: 'ticker',
          name: 'Ticker',
          x: 0, y: 960, w: 1920, h: 120,
          items: [
            { type: 'text', text: 'Bienvenidos al comedor — Cartelera digital operativa desde 2026', durationMs: 999999 },
          ],
        },
      ],
    };
    db.prepare(`
      INSERT INTO layouts (name, description, width, height, background_color, definition, published)
      VALUES (?, ?, ?, ?, ?, ?, 1)
    `).run(
      'Comedor — layout base',
      'Layout por defecto para el comedor: beneficios + cumpleaños + avisos con clima y KPIs laterales',
      1920, 1080, '#0f172a',
      JSON.stringify(definition),
    );
    log.info('Created layout: Comedor — layout base');
  }

  // ---- Demo display ----
  const display = db.prepare('SELECT id FROM displays WHERE name = ?').get('TV Comedor — Demo');
  if (!display) {
    const layout = db.prepare('SELECT id FROM layouts WHERE name = ?').get('Comedor — layout base') as { id: number };
    db.prepare(`
      INSERT INTO displays (name, description, zone_id, resolution, orientation, current_layout_id, pairing_code, pairing_expires_at)
      VALUES (?, ?, ?, '1920x1080', 'landscape', ?, 'DEMO01', datetime('now', '+30 days'))
    `).run('TV Comedor — Demo', 'Pantalla demo del comedor. Código de pairing: DEMO01', comedor.id, layout.id);
    log.info('Created display: TV Comedor — Demo (pairing DEMO01)');
  }

  log.info('✅ Seed completed.');
}

function thisMonthDay(day: number): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${d}`;
}

seed().then(() => process.exit(0)).catch(err => {
  log.error('seed failed', err);
  process.exit(1);
});
