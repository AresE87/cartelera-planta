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
export const ServerError = (msg = 'Internal server error') => new HttpError(500, msg, 'server_error');
