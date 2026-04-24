import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import http from 'http';
import fs from 'fs';
import { config } from './config';
import { log } from './logger';
import { getDb } from './db';
import { hashPassword } from './auth/passwords';
import { HttpError } from './util/errors';
import apiRouter from './routes';
import { registerAllWidgets } from './widgets';
import { attachWsServer } from './ws/server';

async function bootstrap() {
  registerAllWidgets();

  const app = express();
  const server = http.createServer(app);

  // Core middleware
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(cors({
    origin: config.corsOrigin === '*' ? true : config.corsOrigin.split(','),
    credentials: true,
  }));
  app.set('trust proxy', true);

  // Request log (minimal)
  app.use((req, _res, next) => {
    log.debug(`${req.method} ${req.url}`);
    next();
  });

  // Static uploads
  if (!fs.existsSync(config.uploads.dir)) fs.mkdirSync(config.uploads.dir, { recursive: true });
  app.use('/media/file', express.static(config.uploads.dir, {
    maxAge: '30d',
    etag: true,
  }));

  // Static serving of admin + display if bundles exist (production)
  const adminDist = path.resolve(__dirname, '..', '..', 'admin', 'dist');
  if (fs.existsSync(adminDist)) {
    app.use('/admin', express.static(adminDist));
    app.get(/^\/admin\/.*/, (_req, res) => res.sendFile(path.join(adminDist, 'index.html')));
  }

  const displayDist = path.resolve(__dirname, '..', '..', 'display');
  if (fs.existsSync(displayDist)) {
    app.use('/display', express.static(displayDist));
  }

  // API
  app.use('/api', apiRouter);

  // Root redirect to admin
  app.get('/', (_req, res) => res.redirect('/admin'));

  // Error handler
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof HttpError) {
      return res.status(err.status).json({ error: err.message, code: err.code, details: err.details });
    }
    log.error('Unhandled error', err);
    if ((err as any)?.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'File too large' });
    }
    res.status(500).json({ error: 'Internal server error' });
  });

  // DB + default admin
  const db = getDb();
  const count = db.prepare('SELECT COUNT(*) as n FROM users').get() as { n: number };
  if (count.n === 0) {
    const hash = await hashPassword(config.admin.password);
    db.prepare(`
      INSERT INTO users (email, password_hash, name, role)
      VALUES (?, ?, ?, 'admin')
    `).run(config.admin.email, hash, 'Administrador');
    log.warn(`Default admin created: ${config.admin.email} / ${config.admin.password}`);
    log.warn('⚠ Change the default admin password ASAP.');
  }

  // WebSocket
  attachWsServer(server);

  // Start
  server.listen(config.port, () => {
    log.info(`Cartelera backend listening on :${config.port}`, {
      env: config.env,
      publicUrl: config.publicUrl,
    });
  });

  // Periodic offline-detection
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

  // Graceful shutdown
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
