import { config } from './config';

type Level = 'debug' | 'info' | 'warn' | 'error';

const LEVELS: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const threshold = LEVELS[(config.logLevel as Level) ?? 'info'] ?? LEVELS.info;

function write(level: Level, msg: string, meta?: unknown) {
  if (LEVELS[level] < threshold) return;
  const ts = new Date().toISOString();
  const payload = meta ? ` ${safeStringify(meta)}` : '';
  const line = `${ts} [${level.toUpperCase()}] ${msg}${payload}`;
  if (level === 'error' || level === 'warn') {
    console.error(line);
  } else {
    console.log(line);
  }
}

function safeStringify(x: unknown): string {
  try {
    if (x instanceof Error) {
      return JSON.stringify({ error: x.message, stack: x.stack });
    }
    return JSON.stringify(x);
  } catch {
    return String(x);
  }
}

export const log = {
  debug: (msg: string, meta?: unknown) => write('debug', msg, meta),
  info: (msg: string, meta?: unknown) => write('info', msg, meta),
  warn: (msg: string, meta?: unknown) => write('warn', msg, meta),
  error: (msg: string, meta?: unknown) => write('error', msg, meta),
};
