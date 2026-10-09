import { Injectable } from '@nestjs/common';

import {
  PincodeRepository,
  type PincodeInfo,
} from '../repositories/pincode.repository';

export type { PincodeInfo } from '../repositories/pincode.repository';

const TTL_MS = 6 * 60 * 60 * 1000;
const MAX_ENTRIES = 5_000;

/**
 * Pincode → state/district from ko-sales' India Post book. Pincodes do not
 * move, so answers (including "unknown") are kept in memory for hours; the
 * map is bounded so a scan of random numbers cannot grow it forever.
 */
@Injectable()
export class PincodeService {
  private readonly cache = new Map<
    string,
    { at: number; info: PincodeInfo | null }
  >();

  constructor(private readonly pincodes: PincodeRepository) {}

  async lookup(pincode: string): Promise<PincodeInfo | null> {
    if (!/^\d{6}$/.test(pincode)) return null;

    const hit = this.cache.get(pincode);
    if (hit && Date.now() - hit.at < TTL_MS) return hit.info;

    const info = await this.pincodes.find(pincode);
    if (this.cache.size >= MAX_ENTRIES) this.cache.clear();
    this.cache.set(pincode, { at: Date.now(), info });
    return info;
  }
}
