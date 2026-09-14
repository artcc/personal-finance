import { z } from 'zod';
import { isIP } from 'node:net';

export const ENVIRONMENT = Symbol('ENVIRONMENT');

const schema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    HOST: z.string().min(1).default('127.0.0.1'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    APP_ORIGIN: z.string().default('http://127.0.0.1:5173'),
    TRUST_PROXY: z
      .string()
      .default('')
      .transform((value): false | string[] =>
        value === '' || value === 'false' ? false : value.split(',').map((part) => part.trim()),
      )
      .refine(
        (value) =>
          value === false ||
          value.every((entry) => {
            const [address = '', prefix, extra] = entry.split('/');
            const version = isIP(address);
            return (
              extra === undefined &&
              version !== 0 &&
              (prefix === undefined ||
                (/^\d+$/.test(prefix) && Number(prefix) <= (version === 4 ? 32 : 128)))
            );
          }),
      ),
    DATABASE_URL: z.url().refine((value) => {
      try {
        const protocol = new URL(value).protocol;
        return protocol === 'postgresql:' || protocol === 'postgres:';
      } catch {
        return false;
      }
    }),
  })
  .superRefine((environment, context) => {
    try {
      const origin = new URL(environment.APP_ORIGIN);
      const canonical = origin.origin === environment.APP_ORIGIN;
      const https = origin.protocol === 'https:';
      const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname);
      if (
        !canonical ||
        origin.username ||
        origin.password ||
        (!https &&
          (environment.NODE_ENV === 'production' || origin.protocol !== 'http:' || !loopback))
      ) {
        context.addIssue({
          code: 'custom',
          path: ['APP_ORIGIN'],
          message: 'Invalid application origin',
        });
      }
    } catch {
      context.addIssue({
        code: 'custom',
        path: ['APP_ORIGIN'],
        message: 'Invalid application origin',
      });
    }
  });

export type Environment = z.infer<typeof schema>;

export function readEnvironment(input: NodeJS.ProcessEnv): Environment {
  const result = schema.safeParse(input);
  if (!result.success) {
    const fields = [...new Set(result.error.issues.map((issue) => issue.path.join('.')))];
    throw new Error(`Invalid environment configuration: ${fields.join(', ')}`);
  }
  return result.data;
}
