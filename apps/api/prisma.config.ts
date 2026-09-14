import { config } from 'dotenv';
import { defineConfig } from 'prisma/config';

config({ path: '../../.env', quiet: true });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  // Generation does not need a database; migration commands must receive DATABASE_URL.
  datasource: {
    url:
      process.env['DATABASE_URL'] ??
      'postgresql://unconfigured:unconfigured@localhost:5432/unconfigured',
  },
});
