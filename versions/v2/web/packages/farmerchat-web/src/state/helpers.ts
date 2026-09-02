/** Shared state-layer helpers. */

import type { ApiResult } from '../core/http';
import { UiState, failure, success } from './uiState';

export function toUiState<T>(res: ApiResult<T>): UiState<T> {
  if (res.ok) return success(res.data);
  return failure(res.message, res.code, res.isNetworkError || res.isTimeout);
}

/** Blob/File → raw base64 (no data: prefix). */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result ?? '');
      const idx = url.indexOf(',');
      resolve(idx >= 0 ? url.slice(idx + 1) : url);
    };
    reader.onerror = () => reject(reader.error ?? new Error('read failed'));
    reader.readAsDataURL(blob);
  });
}

/** `user_device_time` format sent to the daily feed endpoint. */
export function userDeviceTime(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

/** Letters + single spaces, like the app's normalizeNameInput. */
export function normalizeNameInput(raw: string): string {
  return raw
    .replace(/[^\p{L} ]+/gu, '')
    .replace(/ {2,}/g, ' ')
    .replace(/^ +/, '');
}

/** Sanitizes placeholder names the backend sometimes returns. */
export function sanitizeName(name: string | null | undefined): string {
  if (!name) return '';
  const trimmed = name.trim();
  if (/^(no name|null|undefined)$/i.test(trimmed)) return '';
  return trimmed;
}

export function formatSeconds(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

let idCounter = 0;
export function nextLocalId(prefix: string): string {
  idCounter += 1;
  return `${prefix}_${Date.now()}_${idCounter}`;
}
