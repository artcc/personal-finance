import type { FastifyReply } from 'fastify';
import type { Environment } from '../../../shared/environment.js';

export function sessionCookieName(environment: Environment): string {
  return environment.NODE_ENV === 'production' ? '__Host-pf_session' : 'pf_session';
}

export function writeSessionCookie(
  reply: FastifyReply,
  environment: Environment,
  token: string,
  expires: Date,
): void {
  reply.setCookie(sessionCookieName(environment), token, {
    path: '/',
    httpOnly: true,
    secure: environment.NODE_ENV === 'production',
    sameSite: 'strict',
    expires,
  });
}

export function clearSessionCookie(reply: FastifyReply, environment: Environment): void {
  reply.clearCookie(sessionCookieName(environment), {
    path: '/',
    httpOnly: true,
    secure: environment.NODE_ENV === 'production',
    sameSite: 'strict',
  });
}
