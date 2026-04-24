import type { Request, Response, NextFunction } from 'express';
import { TooManyRequests } from './errors';

interface Bucket {
  tokens: number;
  lastRefill: number;
}

interface BucketStore {
  buckets: Map<string, Bucket>;
  capacity: number;
  refillPerSec: number;
}

const stores = new Set<BucketStore>();

export interface RateLimitOptions {
  /** Max burst */
  capacity: number;
  /** Sustained rate */
  refillPerSec: number;
  /** Custom key extractor (default: req.ip) */
  keyFn?: (req: Request) => string;
  /** Whether to set Retry-After header */
  setHeader?: boolean;
}

export function rateLimit(opts: RateLimitOptions) {
  const store: BucketStore = {
    buckets: new Map(),
    capacity: opts.capacity,
    refillPerSec: opts.refillPerSec,
  };
  stores.add(store);

  const setHeader = opts.setHeader !== false;

  return (req: Request, res: Response, next: NextFunction) => {
    const key = opts.keyFn ? opts.keyFn(req) : (req.ip ?? 'unknown');
    const now = Date.now();
    let b = store.buckets.get(key);
    if (!b) {
      b = { tokens: store.capacity, lastRefill: now };
      store.buckets.set(key, b);
    } else {
      const elapsed = (now - b.lastRefill) / 1000;
      b.tokens = Math.min(store.capacity, b.tokens + elapsed * store.refillPerSec);
      b.lastRefill = now;
    }
    if (b.tokens < 1) {
      const retryAfter = Math.max(1, Math.ceil((1 - b.tokens) / store.refillPerSec));
      if (setHeader) res.setHeader('Retry-After', String(retryAfter));
      return next(TooManyRequests('Too many requests', retryAfter));
    }
    b.tokens -= 1;
    next();
  };
}

/** Periodically prune buckets that are full and idle to bound memory. */
const cleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const store of stores) {
    for (const [key, bucket] of store.buckets) {
      const idleMs = now - bucket.lastRefill;
      if (idleMs > 30 * 60 * 1000 && bucket.tokens >= store.capacity) {
        store.buckets.delete(key);
      }
    }
  }
}, 5 * 60 * 1000);
cleanupInterval.unref();

/** Test-only: reset all buckets across all stores. */
export function _resetRateLimitForTests(): void {
  for (const store of stores) store.buckets.clear();
}
