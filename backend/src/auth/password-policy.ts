const COMMON_WEAK = new Set([
  'password',
  'password1',
  'password123',
  '12345678',
  '123456789',
  '1234567890',
  'qwerty123',
  'letmein1',
  'admin1234',
  'admin1234!',
  'changeme',
  'cartelera',
  'cartelera123',
]);

export interface PolicyResult {
  ok: boolean;
  reason?: string;
}

export function validatePassword(pw: string): PolicyResult {
  if (!pw || typeof pw !== 'string') return { ok: false, reason: 'Password required' };
  if (pw.length < 8) return { ok: false, reason: 'Password must be at least 8 characters' };
  if (pw.length > 128) return { ok: false, reason: 'Password too long (max 128)' };
  if (!/[a-zA-Z]/.test(pw)) return { ok: false, reason: 'Password must contain a letter' };
  if (!/[0-9]/.test(pw)) return { ok: false, reason: 'Password must contain a digit' };
  if (COMMON_WEAK.has(pw.toLowerCase())) {
    return { ok: false, reason: 'Password is too common' };
  }
  return { ok: true };
}
