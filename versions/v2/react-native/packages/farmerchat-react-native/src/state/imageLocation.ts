/**
 * Location for a photo upload — app ImageUtils.kt:92-139 `fetchCurrentLocation`: only when a
 * location permission is ALREADY granted (no prompt), balanced accuracy, 5 s timeout, else null.
 */
import * as Location from 'expo-location';
import type { GpsPoint } from '../core/imageExif';

export async function currentLocationIfPermitted(timeoutMs = 5000): Promise<GpsPoint | null> {
  try {
    const permission = await Location.getForegroundPermissionsAsync();
    if (permission.status !== 'granted') return null;
    const position = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
    ]);
    if (!position) return null;
    return { latitude: position.coords.latitude, longitude: position.coords.longitude };
  } catch {
    return null;
  }
}
