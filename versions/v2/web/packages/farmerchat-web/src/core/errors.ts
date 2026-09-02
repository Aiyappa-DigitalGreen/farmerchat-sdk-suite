/**
 * HTTP error → user message mapping (ErrorHandler.fromHttp in the app).
 * Prefers backend-provided messages from well-known JSON keys, otherwise maps
 * status codes to localized labels via LabelManager.
 */

import type { LabelManager } from './labels';

const BACKEND_MESSAGE_KEYS = ['message', 'otp', 'error', 'detail', 'msg', 'error_message', 'description', 'non_field_errors'];

/** Extracts a human message from an error body (JSON string or object). */
export function extractBackendMessage(errorBody: string | null | undefined): string | null {
  if (!errorBody) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(errorBody);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;
  const obj = parsed as Record<string, unknown>;
  for (const key of BACKEND_MESSAGE_KEYS) {
    const v = obj[key];
    if (typeof v === 'string' && v.trim().length > 0) return v;
    if (Array.isArray(v) && typeof v[0] === 'string' && v[0].trim().length > 0) return v[0];
  }
  return null;
}

export function messageForHttpStatus(code: number, errorBody: string | null | undefined, labels: LabelManager): string {
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
      return labels.getLabel('error_not_found', "We couldn't find what you were looking for.");
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
