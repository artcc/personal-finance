import { UnprocessableEntityException } from '@nestjs/common';
import { z } from 'zod';

export const emailSchema = z.string().trim().toLowerCase().max(254).pipe(z.email());
export const passwordSchema = z.string().min(12).max(128);
export const loginSchema = z.object({ email: emailSchema, password: passwordSchema }).strict();
export const registerSchema = loginSchema.extend({ displayName: z.string().trim().min(1).max(80) });

export function parseAuthInput<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new UnprocessableEntityException({ code: 'INVALID_AUTH_INPUT' });
  return result.data;
}
