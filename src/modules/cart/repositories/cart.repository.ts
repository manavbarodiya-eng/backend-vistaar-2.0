import { createHash } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { mongo, Types, type Model } from 'mongoose';

import type { CartLineData } from '../cart.domain';
import { Cart, CART_SOURCE, type CartRecord } from '../schemas/cart.schema';

/** What a cart write sets; ownership fields are the repository's job. */
export interface CartWrite {
  items: CartLineData[];
  subtotal: number;
  total: number;
  /** `null` = own stock: the field is left off, as on B2B's rows. */
  pii_id: string | null;
}

/**
 * A partner's cart lives at an `_id` derived from their id.
 *
 * "One cart per partner" then rests on the `_id` index, which every
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

  findActive(partnerId: string): Promise<CartRecord | null> {
    return this.model
      .findOne(this.activeFilter(partnerId))
      .lean<CartRecord>()
      .exec();
  }

  /** `false` when another request created it first — re-read and retry. */
  async insertActive(partnerId: string, data: CartWrite): Promise<boolean> {
    const { pii_id, ...rest } = data;

    try {
      await this.model.create({
        _id: activeCartId(partnerId),
        source: CART_SOURCE,
        user_id: partnerId,
        ...(pii_id ? { pii_id } : {}),
        ...rest,
      });
      return true;
    } catch (error) {
      if (error instanceof mongo.MongoServerError && error.code === 11000) {
        return false;
      }
      throw error;
    }
  }

  /** `false` when the cart moved past `version` (`__v`) since it was read. */
  async updateActive(
    partnerId: string,
    version: number,
    data: CartWrite,
  ): Promise<boolean> {
    const { pii_id, ...rest } = data;

    const result = await this.model
      .updateOne(
        { ...this.activeFilter(partnerId), __v: version },
        {
          $set: { ...rest, ...(pii_id ? { pii_id } : {}) },
          ...(pii_id ? {} : { $unset: { pii_id: 1 } }),
          $inc: { __v: 1 },
        },
      )
      .exec();
    return result.matchedCount === 1;
  }

  // `user_id` is in every filter, never only `_id`: it keeps a partner to
  // their own row, and it is the key the collection would be sharded on.
  private activeFilter(partnerId: string) {
    return {
      _id: activeCartId(partnerId),
      source: CART_SOURCE,
      user_id: partnerId,
    };
  }
}
