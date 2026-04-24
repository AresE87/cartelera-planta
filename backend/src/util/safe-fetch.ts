import { lookup } from 'dns/promises';
import { isIP } from 'net';

const ALWAYS_BLOCKED_HOSTNAMES = new Set([
  'metadata.google.internal',
  'metadata.goog',
  'instance-data',
]);

const ALWAYS_BLOCKED_IPS = new Set([
  '0.0.0.0',
  '255.255.255.255',
  '::',
]);

export interface SafeFetchOptions {
  timeoutMs?: number;
  maxBytes?: number;
  allowPrivate?: boolean;
  maxRedirects?: number;
  init?: RequestInit;
}

export interface SafeFetchResult {
  status: number;
  ok: boolean;
  headers: Headers;
  text: string;
  json<T = unknown>(): T;
}

export class SafeFetchError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'SafeFetchError';
  }
}

export function validateUrl(rawUrl: string): URL {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new SafeFetchError('Invalid URL', 'invalid_url');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new SafeFetchError(`Disallowed scheme: ${url.protocol}`, 'bad_scheme');
  }
  if (url.username || url.password) {
    throw new SafeFetchError('URL must not contain credentials', 'has_credentials');
  }
  if (!url.hostname) {
    throw new SafeFetchError('Missing hostname', 'no_host');
  }
  return url;
}

export function isCloudMetadataIp(ip: string): boolean {
  // AWS / GCP / Azure / Alibaba / DigitalOcean / Oracle metadata endpoints
  // All sit on the link-local 169.254/16 range. Block the entire range.
  if (ip.startsWith('169.254.')) return true;
  return false;
}

export function isAlwaysBlockedIp(ip: string): boolean {
  if (ALWAYS_BLOCKED_IPS.has(ip)) return true;
  if (ip.startsWith('0.')) return true;
  if (isCloudMetadataIp(ip)) return true;
  // Multicast 224.0.0.0/4
  const parts = ip.split('.');
  if (parts.length === 4) {
    const first = Number(parts[0]);
    if (first >= 224 && first <= 239) return true;
    if (first >= 240) return true;
  }
  // IPv6 unspecified / multicast / reserved
  const lower = ip.toLowerCase();
  if (lower === '::') return true;
  if (lower.startsWith('ff')) return true;
  return false;
}

export function isPrivateIp(ip: string): boolean {
  if (ip === '127.0.0.1' || ip === '::1') return true;
  if (ip.startsWith('127.')) return true;
  if (ip.startsWith('10.')) return true;
  if (ip.startsWith('192.168.')) return true;
  const m = ip.match(/^172\.(\d+)\./);
  if (m) {
    const second = Number(m[1]);
    if (second >= 16 && second <= 31) return true;
  }
  if (ip.startsWith('169.254.')) return true;
  const lower = ip.toLowerCase();
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true;
  if (lower.startsWith('fe80:')) return true;
  return false;
}

function isPrivateHostname(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  return (
    lower === 'localhost' ||
    lower === 'localhost.localdomain' ||
    lower.endsWith('.localhost') ||
    lower.endsWith('.local') ||
    lower.endsWith('.internal') ||
    lower.endsWith('.lan') ||
    lower.endsWith('.home.arpa')
  );
}

async function resolveAndCheck(hostname: string, allowPrivate: boolean): Promise<void> {
  const lower = hostname.toLowerCase();
  if (ALWAYS_BLOCKED_HOSTNAMES.has(lower)) {
    throw new SafeFetchError(`Blocked hostname: ${hostname}`, 'blocked_host');
  }

  if (isIP(hostname)) {
    if (isAlwaysBlockedIp(hostname)) {
      throw new SafeFetchError(`Blocked IP: ${hostname}`, 'blocked_ip');
    }
    if (!allowPrivate && isPrivateIp(hostname)) {
      throw new SafeFetchError(`Private IP not allowed: ${hostname}`, 'private_ip');
    }
    return;
  }

  if (!allowPrivate && isPrivateHostname(hostname)) {
    throw new SafeFetchError(`Private hostname not allowed: ${hostname}`, 'private_host');
  }

  let resolved;
  try {
    resolved = await lookup(hostname, { all: true });
  } catch {
    throw new SafeFetchError(`DNS lookup failed for ${hostname}`, 'dns_fail');
  }
  if (resolved.length === 0) {
    throw new SafeFetchError(`No addresses for ${hostname}`, 'dns_empty');
  }
  for (const r of resolved) {
    if (isAlwaysBlockedIp(r.address)) {
      throw new SafeFetchError(`Blocked IP: ${r.address}`, 'blocked_ip');
    }
    if (!allowPrivate && isPrivateIp(r.address)) {
      throw new SafeFetchError(`Private IP not allowed: ${r.address}`, 'private_ip');
    }
  }
}

async function readBodyCapped(res: Response, maxBytes: number): Promise<string> {
  if (!res.body) return '';
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    if (value) {
      total += value.byteLength;
      if (total > maxBytes) {
        try { await reader.cancel(); } catch { /* ignore */ }
        throw new SafeFetchError(`Response body exceeds ${maxBytes} bytes`, 'too_large');
      }
      chunks.push(value);
    }
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    merged.set(c, offset);
    offset += c.byteLength;
  }
  return new TextDecoder('utf-8').decode(merged);
}

/**
 * Safe HTTP fetch:
 *  - validates scheme (http/https only)
 *  - resolves DNS and rejects cloud metadata + always-blocked IPs
 *  - optionally rejects RFC1918 / loopback (allowPrivate=false)
 *  - manual redirect handling with re-validation
 *  - bounded response size
 *  - configurable timeout
 *
 * Default allowPrivate=true so widgets can consume the bundled
 * middleware (rrhh-sync, produccion-adapter, etc.) over the docker network.
 */
export async function safeFetch(rawUrl: string, opts: SafeFetchOptions = {}): Promise<SafeFetchResult> {
  const {
    timeoutMs = 10_000,
    maxBytes = 5 * 1024 * 1024,
    allowPrivate = true,
    maxRedirects = 3,
    init = {},
  } = opts;

  let target = validateUrl(rawUrl);
  await resolveAndCheck(target.hostname, allowPrivate);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    let res = await fetch(target, { ...init, signal: controller.signal, redirect: 'manual' });
    let hops = 0;
    while (res.status >= 300 && res.status < 400) {
      if (hops >= maxRedirects) {
        throw new SafeFetchError('Too many redirects', 'too_many_redirects');
      }
      const loc = res.headers.get('location');
      if (!loc) break;
      const next = validateUrl(new URL(loc, target).toString());
      await resolveAndCheck(next.hostname, allowPrivate);
      target = next;
      hops += 1;
      res = await fetch(target, { ...init, signal: controller.signal, redirect: 'manual' });
    }

    const text = await readBodyCapped(res, maxBytes);
    let parsed: unknown | undefined;
    return {
      status: res.status,
      ok: res.ok,
      headers: res.headers,
      text,
      json<T>() {
        if (parsed === undefined) parsed = JSON.parse(text);
        return parsed as T;
      },
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Lightweight write-time check used by the widget routes. Catches obviously
 * bad URLs (file:, javascript:, embedded credentials) without doing DNS —
 * full SSRF protection happens at fetch time.
 */
export function assertHttpUrl(rawUrl: string): void {
  validateUrl(rawUrl);
}
