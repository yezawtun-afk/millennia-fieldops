// Which monitoring zone is the phone standing in?
//
// A zone is a circle on the map: a centre and a radius (see the zones table).
// The capture form uses this to suggest the zone instead of making the worker
// scroll a list of names - but it only ever suggests. GPS is good to a handful
// of metres at best, so at a boundary between two zones a silent auto-pick
// would be confidently wrong, and every dashboard number is grouped by zone.
import type { Zone } from "./types";

export type ZoneMatch = {
  zone: Zone;
  /** Metres from the fix to the centre of the zone. */
  distance: number;
  /** True when the fix is inside the circle, false when it is merely closest. */
  inside: boolean;
};

const EARTH_RADIUS_M = 6_371_000;

type Point = { latitude: number; longitude: number };

/** Great-circle distance in metres (haversine). */
export function distanceMeters(a: Point, b: Point): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

// How far outside a circle still counts as "nearby, probably this one". Past
// this the honest answer is nothing: the worker is not in any known zone.
const NEAR_MARGIN_M = 120;

/**
 * The zone a fix belongs to, preferring a circle the fix is actually inside.
 * Returns null when the nearest zone is too far away to be worth suggesting.
 */
export function findZoneForPoint(
  zones: Zone[],
  point: Point,
  nearMarginM: number = NEAR_MARGIN_M
): ZoneMatch | null {
  let insideMatch: ZoneMatch | null = null;
  let nearestMatch: ZoneMatch | null = null;

  for (const zone of zones) {
    // The database says these are not null; a bad cached row should not throw.
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
