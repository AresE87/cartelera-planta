import { log } from '../logger';

interface State {
  fails: number;
  lockedUntil: number;
}

const DEFAULT_THRESHOLD = 5;
const DEFAULT_LOCK_MS = 15 * 60 * 1000;

const state = new Map<string, State>();

export function recordFailed(email: string): { locked: boolean; retryAfterSec?: number } {
  const key = email.toLowerCase();
  const current = state.get(key);
  const now = Date.now();
  const s = current && current.lockedUntil > now ? current : { fails: current?.fails ?? 0, lockedUntil: 0 };

  s.fails += 1;
  if (s.fails >= DEFAULT_THRESHOLD) {
    s.lockedUntil = now + DEFAULT_LOCK_MS;
    state.set(key, s);
    log.warn('auth.locked', { email: key, fails: s.fails });
    return { locked: true, retryAfterSec: Math.ceil(DEFAULT_LOCK_MS / 1000) };
  }

  state.set(key, s);
  return { locked: false };
}

export function isLocked(email: string): { locked: boolean; retryAfterSec?: number } {
  const key = email.toLowerCase();
  const s = state.get(key);
  if (!s) return { locked: false };

  const now = Date.now();
  if (s.lockedUntil > now) {
    return { locked: true, retryAfterSec: Math.ceil((s.lockedUntil - now) / 1000) };
  }

  if (s.lockedUntil > 0) state.delete(key);
  return { locked: false };
}

export function clearFailures(email: string): void {
  state.delete(email.toLowerCase());
}

export function _resetLockoutsForTests(): void {
  state.clear();
}

const cleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [key, s] of state) {
    if (s.lockedUntil > 0 && s.lockedUntil < now) state.delete(key);
  }
}, 10 * 60 * 1000);
cleanupInterval.unref?.();
