export class ApiError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

export function errorCode(value: unknown): string {
  if (typeof value === 'object' && value !== null && 'error' in value) {
    const error = value.error;
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      typeof error.code === 'string'
    )
      return error.code;
  }
  return 'UNEXPECTED_ERROR';
}

export function requireSuccess(result: { response: Response; error?: unknown }): void {
  if (!result.response.ok) throw new ApiError(errorCode(result.error));
}

export function requireData<T>(result: { response: Response; error?: unknown; data?: T }): T {
  requireSuccess(result);
  if (result.data === undefined) throw new ApiError('UNEXPECTED_ERROR');
  return result.data;
}
