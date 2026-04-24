import 'dotenv/config';
import path from 'path';

function env(name: string, fallback?: string): string {
  const v = process.env[name];
  if (v === undefined || v === '') {
    if (fallback !== undefined) return fallback;
    throw new Error(`Missing required env var: ${name}`);
  }
  return v;
}

function envNum(name: string, fallback: number): number {
  const v = process.env[name];
  if (v === undefined || v === '') return fallback;
  const n = Number(v);
  if (Number.isNaN(n)) throw new Error(`Env var ${name} must be a number, got: ${v}`);
  return n;
}

export const config = {
  env: env('NODE_ENV', 'development'),
  port: envNum('PORT', 3000),
  tz: env('TZ', 'UTC'),

  db: {
    path: env('DB_PATH', path.resolve(process.cwd(), 'data', 'cartelera.db')),
  },

  uploads: {
    dir: env('UPLOADS_DIR', path.resolve(process.cwd(), 'data', 'uploads')),
    maxBytes: envNum('MAX_UPLOAD_MB', 50) * 1024 * 1024,
  },

  auth: {
    jwtSecret: env('JWT_SECRET', 'dev-secret-change-me-in-production-at-least-32-chars'),
    jwtExpiresIn: env('JWT_EXPIRES_IN', '7d'),
    bcryptRounds: envNum('BCRYPT_ROUNDS', 10),
  },

  admin: {
    email: env('ADMIN_EMAIL', 'admin@cartelera.local'),
    password: env('ADMIN_PASSWORD', 'admin1234'),
  },

  publicUrl: env('PUBLIC_URL', 'http://localhost:3000'),
  corsOrigin: env('CORS_ORIGIN', '*'),
  logLevel: env('LOG_LEVEL', 'info'),
};

export const isDev = config.env !== 'production';
export const isProd = config.env === 'production';
