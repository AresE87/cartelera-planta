export class HttpError extends Error {
  constructor(public status: number, message: string, public code?: string, public details?: unknown) {
    super(message);
    this.name = 'HttpError';
  }
}

export const BadRequest = (msg: string, details?: unknown) => new HttpError(400, msg, 'bad_request', details);
export const Unauthorized = (msg = 'Unauthorized') => new HttpError(401, msg, 'unauthorized');
export const Forbidden = (msg = 'Forbidden') => new HttpError(403, msg, 'forbidden');
export const NotFound = (msg = 'Not found') => new HttpError(404, msg, 'not_found');
export const Conflict = (msg: string, details?: unknown) => new HttpError(409, msg, 'conflict', details);
export const PayloadTooLarge = (msg = 'Payload too large') => new HttpError(413, msg, 'payload_too_large');
export const TooManyRequests = (msg = 'Too many requests', retryAfterSeconds?: number) =>
  new HttpError(429, msg, 'rate_limited', retryAfterSeconds !== undefined ? { retryAfterSeconds } : undefined);
export const ServerError = (msg = 'Internal server error') => new HttpError(500, msg, 'server_error');
