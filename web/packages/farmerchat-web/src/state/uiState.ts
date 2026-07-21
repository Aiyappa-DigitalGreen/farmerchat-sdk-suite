/**
 * UiState — the app's sealed class ported to a discriminated union
 * (docs/02 "executeApiCall retry semantics").
 */

export type UiState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; message: string; code?: number; isNetworkError: boolean };

export const idle = <T>(): UiState<T> => ({ status: 'idle' });
export const loading = <T>(): UiState<T> => ({ status: 'loading' });
export const success = <T>(data: T): UiState<T> => ({ status: 'success', data });
export const failure = <T>(message: string, code?: number, isNetworkError = false): UiState<T> => ({
  status: 'error',
  message,
  code,
  isNetworkError,
});

export function isSuccess<T>(s: UiState<T>): s is { status: 'success'; data: T } {
  return s.status === 'success';
}

export function isLoading<T>(s: UiState<T>): boolean {
  return s.status === 'loading';
}
