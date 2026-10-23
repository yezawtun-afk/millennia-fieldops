// GPS helpers built on expo-location.
import * as Location from "expo-location";

export interface Coordinates {
  latitude: number;
  longitude: number;
  accuracy: number | null;
}

export async function getCurrentCoordinates(): Promise<Coordinates | null> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== "granted") return null;

  const position = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.High,
  });

  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracy: position.coords.accuracy ?? null,
  };
}

export function openInOpenStreetMap(latitude: number, longitude: number): string {
  return `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=17/${latitude}/${longitude}`;
}

// trueHeading is -1 when the device cannot calculate it. Magnetic north is a
// useful fallback for phones without a GPS-derived heading.
export function bestHeading(trueHeading: number, magHeading: number): number | null {
  const value = trueHeading >= 0 ? trueHeading : magHeading;
  return Number.isFinite(value) && value >= 0 ? value : null;
}

// Compass readings jitter, especially indoors. Ease towards the new bearing,
// taking care of the 359 -> 0 wrap instead of spinning the long way round.
export function smoothHeading(previous: number | null, next: number): number {
  if (previous == null) return next;
  const delta = ((next - previous + 540) % 360) - 180;
  return (previous + delta * 0.3 + 360) % 360;
}
