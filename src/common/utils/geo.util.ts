/** A GeoJSON point, longitude first, as every 2dsphere index expects. */
export interface GeoPoint {
  type: 'Point';
  coordinates: [number, number];
}

/**
 * India's bounding box, generous on every side. A fix outside it is a
 * mock-location app, a swapped lat/lng, or `0,0` from a phone without a fix.
 */
const INDIA = { minLat: 6, maxLat: 37.5, minLng: 68, maxLng: 97.5 };

export function isIndiaFix(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= INDIA.minLat &&
    lat <= INDIA.maxLat &&
    lng >= INDIA.minLng &&
    lng <= INDIA.maxLng
  );
}

export function toPoint(lat: number, lng: number): GeoPoint {
  return { type: 'Point', coordinates: [lng, lat] };
}

const EARTH_RADIUS_KM = 6371;

/** Great-circle distance in km. */
export function haversineKm(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(bLat - aLat);
  const dLng = rad(bLng - aLng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

/** Radius in km → radians, for `$centerSphere`. */
export const kmToRadians = (km: number): number => km / EARTH_RADIUS_KM;
