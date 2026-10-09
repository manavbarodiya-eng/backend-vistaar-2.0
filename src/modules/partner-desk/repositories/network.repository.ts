import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import type { Connection } from 'mongoose';

import { haversineKm, kmToRadians } from '@common/utils/geo.util';

export interface NetworkHit {
  source: 'franchise' | 'prasar_retailer' | 'old_vistaar_agent';
  id: string;
  name: string;
  distance_km: number;
}

/** Degrees of latitude per km — the bounding box before the exact distance check. */
const DEG_PER_KM = 1 / 111;

/**
 * Other apps' points on the map, **read-only**: franchises, shops prasar
 * agents onboarded, and the old Vistaar (KSS) agents. Used only to warn HO,
 * at approval, that a new partner would sit on top of existing network.
 * Never writes, and declares no schema or index on these collections.
 */
@Injectable()
export class NetworkRepository {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  async near(
    lat: number,
    lng: number,
    radiusKm: number,
    limit: number,
  ): Promise<NetworkHit[]> {
    const [franchises, retailers, oldAgents] = await Promise.all([
      this.franchises(lat, lng, radiusKm, limit),
      this.prasarRetailers(lat, lng, radiusKm, limit),
      this.oldVistaarAgents(lat, lng, radiusKm, limit),
    ]);
    return [...franchises, ...retailers, ...oldAgents].sort(
      (a, b) => a.distance_km - b.distance_km,
    );
  }

  /** `franchises.location` is proper GeoJSON `[lng, lat]`. */
  private async franchises(
    lat: number,
    lng: number,
    radiusKm: number,
    limit: number,
  ): Promise<NetworkHit[]> {
    const rows = await this.connection
      .collection<{
        franchiseId?: string;
        city?: string;
        location?: { coordinates?: number[] };
      }>('franchises')
      .find(
        {
          location: {
            $geoWithin: { $centerSphere: [[lng, lat], kmToRadians(radiusKm)] },
          },
        },
        { projection: { franchiseId: 1, city: 1, location: 1 }, limit },
      )
      .toArray();
    return rows.flatMap((r) => {
      const [x, y] = r.location?.coordinates ?? [];
      if (typeof x !== 'number' || typeof y !== 'number') return [];
      return [
        {
          source: 'franchise' as const,
          id: r.franchiseId ?? String(r._id),
          name: `Franchise ${r.franchiseId ?? ''} ${r.city ?? ''}`.trim(),
          distance_km: round(haversineKm(lat, lng, y, x)),
        },
      ];
    });
  }

  /** `prasar_v2_retailers` keeps plain `latitude` / `longitude` (indexed together). */
  private async prasarRetailers(
    lat: number,
    lng: number,
    radiusKm: number,
    limit: number,
  ): Promise<NetworkHit[]> {
    const box = bbox(lat, lng, radiusKm);
    const rows = await this.connection
      .collection<{
        retailer_id?: string;
        shop_name?: string;
        latitude?: number;
        longitude?: number;
      }>('prasar_v2_retailers')
      .find(
        {
          latitude: { $gte: box.minLat, $lte: box.maxLat },
          longitude: { $gte: box.minLng, $lte: box.maxLng },
        },
        {
          projection: {
            retailer_id: 1,
            shop_name: 1,
            latitude: 1,
            longitude: 1,
          },
          limit: limit * 4,
        },
      )
      .toArray();
    return rows
      .map((r) => ({
        source: 'prasar_retailer' as const,
        id: r.retailer_id ?? String(r._id),
        name: r.shop_name ?? 'Shop',
        distance_km: round(
          haversineKm(lat, lng, r.latitude ?? 0, r.longitude ?? 0),
        ),
      }))
      .filter((h) => h.distance_km <= radiusKm)
      .slice(0, limit);
  }

  /**
   * Old Vistaar agents. ⚠️ `latestCoordinates.coordinates` is stored
   * **[lat, lng]** — the wrong way round for GeoJSON — so a geo query on it is
   * meaningless. Both orders are matched with a box and then measured.
   */
  private async oldVistaarAgents(
    lat: number,
    lng: number,
    radiusKm: number,
    limit: number,
  ): Promise<NetworkHit[]> {
    const box = bbox(lat, lng, radiusKm);
    const rows = await this.connection
      .collection<{
        vagentId?: string;
        firstName?: string;
        lastName?: string;
        latestCoordinates?: { coordinates?: number[] };
      }>('vistaaragents')
      .find(
        {
          $or: [
            {
              'latestCoordinates.coordinates.0': {
                $gte: box.minLat,
                $lte: box.maxLat,
              },
              'latestCoordinates.coordinates.1': {
                $gte: box.minLng,
                $lte: box.maxLng,
              },
            },
            {
              'latestCoordinates.coordinates.0': {
                $gte: box.minLng,
                $lte: box.maxLng,
              },
              'latestCoordinates.coordinates.1': {
                $gte: box.minLat,
                $lte: box.maxLat,
              },
            },
          ],
        },
        {
          projection: {
            vagentId: 1,
            firstName: 1,
            lastName: 1,
            latestCoordinates: 1,
          },
          limit: limit * 4,
        },
      )
      .toArray();
    return rows
      .flatMap((r) => {
        const [a, b] = r.latestCoordinates?.coordinates ?? [];
        if (typeof a !== 'number' || typeof b !== 'number') return [];
        const [pLat, pLng] =
          a >= box.minLat && a <= box.maxLat ? [a, b] : [b, a];
        return [
          {
            source: 'old_vistaar_agent' as const,
            id: r.vagentId ?? String(r._id),
            name:
              [r.firstName, r.lastName].filter(Boolean).join(' ') ||
              'Old Vistaar agent',
            distance_km: round(haversineKm(lat, lng, pLat, pLng)),
          },
        ];
      })
      .filter((h) => h.distance_km <= radiusKm)
      .slice(0, limit);
  }
}

function bbox(lat: number, lng: number, km: number) {
  const dLat = km * DEG_PER_KM;
  const dLng = dLat / Math.max(Math.cos((lat * Math.PI) / 180), 0.01);
  return {
    minLat: lat - dLat,
    maxLat: lat + dLat,
    minLng: lng - dLng,
    maxLng: lng + dLng,
  };
}

const round = (km: number): number => Math.round(km * 100) / 100;
