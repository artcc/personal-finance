import { createApplication } from './bootstrap.js';
import { readEnvironment } from './shared/environment.js';

async function main(): Promise<void> {
  const environment = readEnvironment(process.env);
  const { app } = await createApplication(environment);
  await app.listen(environment.PORT, environment.HOST);
}

main().catch(() => {
  console.error('API startup failed. Check environment configuration and service logs.');
  process.exitCode = 1;
});
