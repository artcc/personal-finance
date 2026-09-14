import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';
import { createApplication } from '../../bootstrap.js';
import { readEnvironment } from '../../shared/environment.js';
import { IdentityService } from './application/identity.service.js';
import { emailSchema, passwordSchema } from './http/auth.validation.js';

async function readPassword(): Promise<string> {
  if (!process.stdin.isTTY) {
    let input = '';
    for await (const chunk of process.stdin) {
      input += String(chunk);
      if (input.length > 1_024) throw new Error('Password input is too long');
    }
    return input.replace(/\r?\n$/, '');
  }
  let hidden = false;
  const output = new Writable({
    write(chunk, _encoding, callback) {
      if (!hidden) process.stdout.write(chunk);
      callback();
    },
  });
  const terminal = createInterface({ input: process.stdin, output, terminal: true });
  try {
    process.stdout.write('New password: ');
    hidden = true;
    const password = await terminal.question('');
    hidden = false;
    process.stdout.write('\nConfirm password: ');
    hidden = true;
    const confirmation = await terminal.question('');
    hidden = false;
    process.stdout.write('\n');
    if (password !== confirmation) throw new Error('Passwords do not match');
    return password;
  } finally {
    terminal.close();
  }
}

async function main(): Promise<void> {
  const [command, email, ...extra] = process.argv.slice(2);
  if (
    extra.length ||
    !['reset-password', 'prune-sessions'].includes(command ?? '') ||
    (command === 'prune-sessions' && email !== undefined)
  ) {
    throw new Error('Usage: identity/cli.js reset-password <email> | prune-sessions');
  }
  const normalizedEmail = command === 'reset-password' ? emailSchema.parse(email) : undefined;
  const password =
    command === 'reset-password' ? passwordSchema.parse(await readPassword()) : undefined;
  const { app } = await createApplication(readEnvironment(process.env));
  try {
    const identity = app.get(IdentityService);
    if (normalizedEmail !== undefined && password !== undefined) {
      if (!(await identity.resetPassword(normalizedEmail, password)))
        throw new Error('Account not found');
      console.info('Password updated. All sessions for this account have been revoked.');
    } else {
      console.info(`Removed ${await identity.pruneSessions()} expired or revoked sessions.`);
    }
  } finally {
    await app.close();
  }
}

main().catch(() => {
  console.error('Identity operation failed. Check the command, input, and server configuration.');
  process.exitCode = 1;
});
