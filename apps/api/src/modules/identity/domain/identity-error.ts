export type IdentityErrorCode =
  | 'INVALID_CREDENTIALS'
  | 'REGISTRATION_FAILED'
  | 'AUTH_REQUIRED'
  | 'CSRF_REJECTED'
  | 'AUTH_BUSY'
  | 'SESSION_NOT_FOUND';

export class IdentityError extends Error {
  constructor(readonly code: IdentityErrorCode) {
    super(code);
    this.name = 'IdentityError';
  }
}
