import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import http from 'http';
import fs from 'fs';
import { config, isProd } from './config';
import { log } from './logger';
import { getDb } from './db';
import { hashPassword } from './auth/passwords';
import { HttpError } from './util/errors';
import { securityHeaders } from './util/security-headers';
import apiRouter from './routes';
import { registerAllWidgets } from './widgets';
import { attachWsServer, getConnectedClients } from './ws/server';

function assertProductionSafety() {
  if (!isProd) return;
  const weakSecrets = new Set([
    'dev-secret-change-me-in-production-at-least-32-chars',
    'change-me-to-a-long-random-string-at-least-32-chars',
    'test-secret',
  ]);
  if (weakSecrets.has(config.auth.jwtSecret) || config.auth.jwtSecret.length < 32) {
    throw new Error('JWT_SECRET must be set to a unique value of at least 32 characters in production');
  }
  if (config.admin.password === 'admin1234') {
    log.warn('⚠ ADMIN_PASSWORD is the default — log in immediately and change it.');
  }
  if (config.corsOrigin === '*') {
    log.warn('⚠ CORS_ORIGIN is "*" in production — restrict to your admin/display origins.');
  }
}

async function bootstrap() {
  assertProductionSafety();
  registerAllWidgets();

  const app = express();
  const server = http.createServer(app);

  app.disable('x-powered-by');
  app.set('trust proxy', true);

  app.use(securityHeaders);
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use(cors({
    origin: config.corsOrigin === '*' ? true : config.corsOrigin.split(',').map(s => s.trim()),
    credentials: true,
  }));

  app.use((req, _res, next) => {
    log.debug(`${req.method} ${req.url}`);
    next();
  });

  if (!fs.existsSync(config.uploads.dir)) fs.mkdirSync(config.uploads.dir, { recursive: true });
  app.use('/media/file', express.static(config.uploads.dir, {
    maxAge: '30d',
    etag: true,
  }));

  const adminDist = path.resolve(__dirname, '..', '..', 'admin', 'dist');
  if (fs.existsSync(adminDist)) {
    app.use('/admin', express.static(adminDist));
    app.get(/^\/admin\/.*/, (_req, res) => res.sendFile(path.join(adminDist, 'index.html')));
  }

  const displayDist = path.resolve(__dirname, '..', '..', 'display');
  if (fs.existsSync(displayDist)) {
    app.use('/display', express.static(displayDist));
  }

  app.use('/api', apiRouter);

  app.get('/metrics', (_req, res) => {
    const db = getDb();
    const one = (sql: string) => db.prepare(sql).get() as { n: number };
    const stats = {
      users: one('SELECT COUNT(*) AS n FROM users').n,
      zones: one('SELECT COUNT(*) AS n FROM zones').n,
      displays: {
        total: one('SELECT COUNT(*) AS n FROM displays').n,
        online: one("SELECT COUNT(*) AS n FROM displays WHERE status = 'online'").n,
        offline: one("SELECT COUNT(*) AS n FROM displays WHERE status = 'offline'").n,
      },
      layouts: one('SELECT COUNT(*) AS n FROM layouts').n,
      widgets: one('SELECT COUNT(*) AS n FROM widgets').n,
      schedules: one('SELECT COUNT(*) AS n FROM schedules WHERE active = 1').n,
      alerts: one('SELECT COUNT(*) AS n FROM alerts WHERE active = 1').n,
      media: one('SELECT COUNT(*) AS n FROM media').n,
      ws: getConnectedClients(),
      uptime_s: Math.floor(process.uptime()),
      memory: process.memoryUsage(),
    };

    if ((_req.headers.accept || '').toString().includes('application/json')) {
      return res.json(stats);
    }

    const lines: string[] = [];
    const put = (name: string, value: number) => {
      lines.push(`# TYPE ${name} gauge`);
      lines.push(`${name} ${value}`);
    };
    put('cartelera_users_total', stats.users);
    put('cartelera_zones_total', stats.zones);
    put('cartelera_displays_total', stats.displays.total);
    put('cartelera_displays_online', stats.displays.online);
    put('cartelera_displays_offline', stats.displays.offline);
    put('cartelera_layouts_total', stats.layouts);
    put('cartelera_widgets_total', stats.widgets);
    put('cartelera_schedules_active', stats.schedules);
    put('cartelera_alerts_active', stats.alerts);
    put('cartelera_media_total', stats.media);
    put('cartelera_ws_clients_total', stats.ws.total);
    put('cartelera_ws_displays', stats.ws.displays);
    put('cartelera_ws_admins', stats.ws.admins);
    put('cartelera_uptime_seconds', stats.uptime_s);
    put('cartelera_memory_rss_bytes', stats.memory.rss);
    put('cartelera_memory_heap_used_bytes', stats.memory.heapUsed);
    res.type('text/plain; version=0.0.4').send(lines.join('\n') + '\n');
  });

  app.get('/', (_req, res) => res.redirect(config.rootRedirect));

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof HttpError) {
      return res.status(err.status).json({ error: err.message, code: err.code, details: err.details });
    }
    log.error('Unhandled error', err);
    if ((err as any)?.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'File too large' });
    }
    if ((err as any)?.type === 'entity.too.large') {
      return res.status(413).json({ error: 'Request body too large' });
    }
    res.status(500).json({ error: 'Internal server error' });
  });

  const db = getDb();
  const count = db.prepare('SELECT COUNT(*) as n FROM users').get() as { n: number };
  if (count.n === 0) {
    const hash = await hashPassword(config.admin.password);
    db.prepare(`
      INSERT INTO users (email, password_hash, name, role)
      VALUES (?, ?, ?, 'admin')
    `).run(config.admin.email, hash, 'Administrador');
    log.warn(`Default admin created: ${config.admin.email}. Change the default password ASAP.`);
    log.warn('⚠ Change the default admin password ASAP.');
  }

  attachWsServer(server);

  server.listen(config.port, () => {
    log.info(`Cartelera backend listening on :${config.port}`, {
      env: config.env,
      publicUrl: config.publicUrl,
    });
  });

  setInterval(() => {
    try {
      const db = getDb();
      db.prepare(`
        UPDATE displays SET status = 'offline'
        WHERE status = 'online'
          AND last_seen_at < datetime('now', '-2 minutes')
      `).run();
    } catch (err) {
      log.warn('offline-detection failed', err);
    }
  }, 30_000);

  setInterval(() => {
    try {
      const db = getDb();
      const info = db.prepare("DELETE FROM heartbeats WHERE created_at < datetime('now', '-7 days')").run();
      if (info.changes > 0) log.debug(`heartbeats.cleanup removed ${info.changes} rows`);
    } catch (err) {
      log.warn('heartbeats.cleanup failed', err);
    }
  }, 6 * 60 * 60_000);

  const shutdown = (signal: string) => {
    log.info(`Received ${signal}, shutting down...`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 5000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT',  () => shutdown('SIGINT'));
}

bootstrap().catch(err => {
  log.error('bootstrap failed', err);
  process.exit(1);
});
