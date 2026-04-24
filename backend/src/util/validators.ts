import { z } from 'zod';
import { BadRequest } from './errors';

export function parseBody<T extends z.ZodTypeAny>(schema: T, body: unknown): z.infer<T> {
  const res = schema.safeParse(body);
  if (!res.success) {
    throw BadRequest('Validation failed', res.error.flatten());
  }
  return res.data;
}

export const emailSchema = z.string().email().max(255);
export const passwordSchema = z.string().min(8).max(128);
export const nameSchema = z.string().min(1).max(128).trim();

export const roleSchema = z.enum(['admin', 'rrhh', 'produccion', 'seguridad', 'comunicaciones', 'operator']);

export const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});
