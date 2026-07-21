/**
 * ApiResult / UiState — result envelopes matching the app's
 * `ApiResult.Success/Error` and `UiState.Idle/Loading/Success/Error`.
 */

export interface ApiSuccess<T> {
  readonly ok: true;
  readonly data: T;
}

export interface ApiError {
  readonly ok: false;
  readonly code: number | null;
  readonly message: string | null;
  readonly apiName: string;
  readonly errorBody: string | null;
  readonly isTimeout: boolean;
  /** True when the failure was a transport-level (network) exception. */
  readonly isNetworkError: boolean;
}

export type ApiResult<T> = ApiSuccess<T> | ApiError;

export function apiSuccess<T>(data: T): ApiSuccess<T> {
  return { ok: true, data };
}

export function apiError(params: {
  code?: number | null;
  message?: string | null;
  apiName: string;
  errorBody?: string | null;
  isTimeout?: boolean;
  isNetworkError?: boolean;
}): ApiError {
  return {
    ok: false,
    code: params.code ?? null,
    message: params.message ?? null,
    apiName: params.apiName,
    errorBody: params.errorBody ?? null,
    isTimeout: params.isTimeout ?? false,
    isNetworkError: params.isNetworkError ?? false,
  };
}

// ---------------------------------------------------------------------------
// UiState — sealed-class equivalent used by every state hook.
// ---------------------------------------------------------------------------

export type UiState<T> =
  | { readonly kind: 'idle' }
  | { readonly kind: 'loading' }
  | { readonly kind: 'success'; readonly data: T }
  | {
      readonly kind: 'error';
      readonly message: string;
      readonly code: number | null;
      readonly isNetworkError: boolean;
    };

export const UiStates = {
  idle<T>(): UiState<T> {
    return { kind: 'idle' };
  },
  loading<T>(): UiState<T> {
    return { kind: 'loading' };
  },
  success<T>(data: T): UiState<T> {
    return { kind: 'success', data };
  },
  error<T>(
    message: string,
    code: number | null = null,
    isNetworkError = false,
  ): UiState<T> {
    return { kind: 'error', message, code, isNetworkError };
  },
  fromResult<T>(result: ApiResult<T>, fallbackMessage: string): UiState<T> {
    if (result.ok) return UiStates.success(result.data);
    return UiStates.error(
      result.message ?? fallbackMessage,
      result.code,
      result.isNetworkError || result.isTimeout,
    );
  },
};

export function isSuccess<T>(
  state: UiState<T>,
): state is { kind: 'success'; data: T } {
  return state.kind === 'success';
}
