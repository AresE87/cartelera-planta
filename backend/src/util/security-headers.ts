import type { Request, Response, NextFunction } from 'express';

/**
 * Lightweight security-header middleware (helmet-style) without an extra
 * dependency. Safe defaults for an API + admin SPA + display kiosk served
 * behind Caddy.
 */
export function securityHeaders(req: Request, res: Response, next: NextFunction) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-DNS-Prefetch-Control', 'off');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=(), payment=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-site');

  const proto = (req.headers['x-forwarded-proto'] as string | undefined) ?? (req.secure ? 'https' : 'http');
  if (proto === 'https') {
    res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
  }

  next();
}
