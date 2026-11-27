// Which monitoring zone is this point standing in?
//
// A zone is a circle on the map: a centre and a radius (see the zones table).
// Mirrors mobile/src/lib/zones.ts; the two apps are deployed separately, so the
// arithmetic is duplicated rather than shared.

export interface ZoneCircle {
  id: string;
  name: string;
  center_lat: number;
  center_lng: number;
  radius_m: number;
}

export interface Point {
  latitude: number;
  longitude: number;
}

export type ZoneMatch<T extends ZoneCircle = ZoneCircle> = {
  zone: T;
  /** Metres from the point to the centre of the zone. */
  distance: number;
  /** True when the point is inside the circle, false when it is merely closest. */
  inside: boolean;
};

const EARTH_RADIUS_M = 6_371_000;

/** Great-circle distance in metres (haversine). */
export function distanceMeters(a: Point, b: Point): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);

  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

// How far outside a circle still counts as "nearby, probably this one".
const NEAR_MARGIN_M = 120;

/**
 * The zone a point belongs to, preferring a circle the point is actually inside.
 * Returns null when the nearest zone is too far away to be worth mentioning.
 */
export function findZoneForPoint<T extends ZoneCircle>(
  zones: T[],
  point: Point,
  nearMarginM: number = NEAR_MARGIN_M
): ZoneMatch<T> | null {
  let insideMatch: ZoneMatch<T> | null = null;
  let nearestMatch: ZoneMatch<T> | null = null;

  for (const zone of zones) {
    // The database says these are not null; a bad row should not throw.
    if (!Number.isFinite(zone.center_lat) || !Number.isFinite(zone.center_lng)) continue;

    const distance = distanceMeters(point, {
      latitude: zone.center_lat,
      longitude: zone.center_lng,
    });

    if (distance <= zone.radius_m && (!insideMatch || distance < insideMatch.distance)) {
      insideMatch = { zone, distance, inside: true };
    }

    if (
      distance <= zone.radius_m + nearMarginM &&
      (!nearestMatch || distance < nearestMatch.distance)
    ) {
      nearestMatch = { zone, distance, inside: distance <= zone.radius_m };
    }
  }

  // Standing where two circles overlap: the closer centre wins.
  return insideMatch ?? nearestMatch;
}
