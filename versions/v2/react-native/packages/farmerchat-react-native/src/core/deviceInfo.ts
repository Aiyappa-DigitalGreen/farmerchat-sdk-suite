/**
 * Device-Info header builder — URL-encoded JSON device config, sent on every
 * request alongside `Build-Version: v2` (docs/02 §AuthHeaderInterceptor).
 * Uses expo-device / expo-constants; degrades gracefully when unavailable.
 */
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { SDK_VERSION } from './config';

export interface DeviceInfoPayload {
  platform: string;
  os_version: string;
  device_model: string;
  device_brand: string;
  device_manufacturer: string;
  app_version: string;
  sdk_version: string;
  sdk: 'react-native';
  is_emulator: boolean;
}

let cachedHeader: string | null = null;

export function buildDeviceInfoPayload(): DeviceInfoPayload {
  const appVersion =
    Constants.expoConfig?.version ??
    (Constants.manifest2?.extra?.expoClient?.version as string | undefined) ??
    'unknown';
  return {
    platform: Platform.OS,
    os_version: String(Platform.Version ?? Device.osVersion ?? 'unknown'),
    device_model: Device.modelName ?? 'unknown',
    device_brand: Device.brand ?? 'unknown',
    device_manufacturer: Device.manufacturer ?? 'unknown',
    app_version: appVersion,
    sdk_version: SDK_VERSION,
    sdk: 'react-native',
    is_emulator: Device.isDevice === false,
  };
}

/** URL-encoded JSON, cached after first build. */
export function getDeviceInfoHeader(): string {
  if (cachedHeader === null) {
    try {
      cachedHeader = encodeURIComponent(JSON.stringify(buildDeviceInfoPayload()));
    } catch {
      cachedHeader = encodeURIComponent(
        JSON.stringify({ platform: 'react-native', sdk_version: SDK_VERSION }),
      );
    }
  }
  return cachedHeader;
}
