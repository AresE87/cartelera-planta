import { z } from 'zod';

export const queryBool = z.union([
  z.enum(['true', 'false', '1', '0', 'yes', 'no']).transform(v => v === 'true' || v === '1' || v === 'yes'),
  z.boolean(),
]);
