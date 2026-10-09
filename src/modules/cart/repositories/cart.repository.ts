import { createHash } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { mongo, Types, type Model } from 'mongoose';

import type { CartLineData } from '../cart.domain';
import { Cart, CART_SOURCE, type CartRecord } from '../schemas/cart.schema';

/** What a cart write sets; ownership fields are the repository's job. */
export interface CartWrite {
  items: CartLineData[];
  item_count: number;
  subtotal: number;
  total: number;
  customer_id: string | null;
  customer_name: string | null;
}

/**
 * A partner's active cart lives at an `_id` derived from their id.
 *
 * "One active cart per partner" then rests on the `_id` index, which every
 * collection has, instead of a unique index on a shared collection we may not
 * build: two first-adds racing from two phones produce one document and a
 * duplicate-key the loser retries, never two carts. It also makes the hot
 * read a primary-key lookup.
 */
export function activeCartId(partnerId: string): Types.ObjectId {
  const hex = createHash('sha256')
    .update(`${CART_SOURCE}:active-cart:${partnerId}`)
    .digest('hex');
  return new Types.ObjectId(hex.slice(0, 24));
}

@Injectable()
export class CartRepository {
  constructor(@InjectModel(Cart.name) private readonly model: Model<Cart>) {}

  // ── Active cart ───────────────────────────────────────────────────────

  findActive(partnerId: string): Promise<CartRecord | null> {
    return this.model
      .findOne(this.activeFilter(partnerId))
      .lean<CartRecord>()
      .exec();
  }

  /** `false` when another request created it first — re-read and retry. */
  async insertActive(partnerId: string, data: CartWrite): Promise<boolean> {
    try {
      await this.model.create({
        _id: activeCartId(partnerId),
        source: CART_SOURCE,
        partner_id: partnerId,
        status: 'active',
        ...data,
        version: 1,
      });
      return true;
    } catch (error) {
      if (error instanceof mongo.MongoServerError && error.code === 11000) {
        return false;
      }
      throw error;
    }
  }

  /** `false` when the cart moved past `version` since it was read. */
  async updateActive(
    partnerId: string,
    version: number,
    data: CartWrite,
  ): Promise<boolean> {
    const result = await this.model
      .updateOne(
        { ...this.activeFilter(partnerId), version },
        { $set: data, $inc: { version: 1 } },
      )
      .exec();
    return result.matchedCount === 1;
  }

  // ── Saved carts ───────────────────────────────────────────────────────

  /** One saved cart per customer: saving again replaces it. */
  upsertSaved(
    partnerId: string,
    customerKey: string,
    data: CartWrite,
  ): Promise<CartRecord> {
    return this.model
      .findOneAndUpdate(
        this.savedFilter(partnerId, { customer_key: customerKey }),
        { $set: { ...data, reminder_sent: false } },
        { upsert: true, returnDocument: 'after' },
      )
      .lean<CartRecord>()
      .orFail()
      .exec();
  }

  async listSaved(
    partnerId: string,
    skip: number,
    limit: number,
  ): Promise<[CartRecord[], number]> {
    const filter = this.savedFilter(partnerId);

    return Promise.all([
      this.model
        .find(filter)
        .sort({ updated_at: -1, _id: -1 })
        .skip(skip)
        .limit(limit)
        .lean<CartRecord[]>()
        .exec(),
      this.model.countDocuments(filter).exec(),
    ]);
  }

  findSaved(partnerId: string, id: string): Promise<CartRecord | null> {
    return this.model
      .findOne(this.savedFilter(partnerId, { _id: id }))
      .lean<CartRecord>()
      .exec();
  }

  markReminderSent(partnerId: string, id: string): Promise<CartRecord | null> {
    return this.model
      .findOneAndUpdate(
        this.savedFilter(partnerId, { _id: id }),
        { $set: { reminder_sent: true } },
        { returnDocument: 'after' },
      )
      .lean<CartRecord>()
      .exec();
  }

  async deleteSaved(partnerId: string, id: string): Promise<boolean> {
    const result = await this.model
      .deleteOne(this.savedFilter(partnerId, { _id: id }))
      .exec();
    return result.deletedCount === 1;
  }

  // `partner_id` is in every filter, never only `_id`: it keeps a partner to
  // their own rows, and it is the key the collection would be sharded on.

  private activeFilter(partnerId: string) {
    return {
      _id: activeCartId(partnerId),
      source: CART_SOURCE,
      partner_id: partnerId,
      status: 'active' as const,
    };
  }

  private savedFilter(partnerId: string, extra: Record<string, unknown> = {}) {
    return {
      source: CART_SOURCE,
      partner_id: partnerId,
      status: 'saved' as const,
      ...extra,
    };
  }
}
