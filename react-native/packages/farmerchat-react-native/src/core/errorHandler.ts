/**
 * ErrorHandler.fromHttp — maps HTTP codes to localized labels, preferring the
 * backend message extracted from the error body JSON keys:
 * message, otp, error, detail, msg, error_message, description, non_field_errors.
 * (docs/02 §executeApiCall retry semantics)
 */
import type { LabelManager } from './labelManager';

const BACKEND_MESSAGE_KEYS = [
  'message',
  'otp',
  'error',
  'detail',
  'msg',
  'error_message',
  'description',
  'non_field_errors',
] as const;

export function extractBackendMessage(errorBody: string | null): string | null {
  if (!errorBody) return null;
  try {
    const parsed: unknown = JSON.parse(errorBody);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const record = parsed as Record<string, unknown>;
    for (const key of BACKEND_MESSAGE_KEYS) {
      const value = record[key];
      if (typeof value === 'string' && value.trim().length > 0) return value;
      if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'string') {
        return value[0];
      }
    }
  } catch {
    // not JSON — ignore
  }
  return null;
}

export function messageForHttpCode(
  code: number,
  errorBody: string | null,
  labels: LabelManager,
): string {
  const backend = extractBackendMessage(errorBody);
  if (backend) return backend;

  switch (code) {
    case 400:
      return labels.getLabel('error_bad_request', 'Something went wrong with the request. Please try again.');
    case 401:
      return labels.getLabel('error_unauthorized', 'Your session has expired. Please try again.');
    case 403:
      return labels.getLabel('error_forbidden', "You don't have permission to do that.");
    case 404:
      return labels.getLabel('error_not_found', 'We could not find what you were looking for.');
    case 408:
      return labels.getLabel('error_timeout', 'The request timed out. Please try again.');
    case 429:
      return labels.getLabel('error_too_many_requests', 'Too many requests. Please wait a moment and try again.');
    default:
      if (code >= 500) {
        return labels.getLabel('error_server', 'Our servers are having trouble. Please try again in a moment.');
      }
      return labels.getLabel('error_generic', 'Something went wrong. Please try again.');
  }
}

export function networkErrorMessage(labels: LabelManager, isTimeout: boolean): string {
  return isTimeout
    ? labels.getLabel('error_timeout', 'The request timed out. Please try again.')
    : labels.getLabel('error_no_internet', 'No internet connection. Please check your network and try again.');
}
