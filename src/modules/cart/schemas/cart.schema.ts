import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { Types } from 'mongoose';

/**
 * `carts` is **shared** with the B2B Sales service, and a Vistaar row is a B2B
 * cart row: the same fields, names and types (taken from the rows already in
 * the collection, 2026-10-09) — nothing Vistaar-only. Only the values say
 * whose it is: `source: 'vistaar'`, and the person in `pii_id` — the farmer,
 * or the partner's own `pii_id` for shop stock. There is no `user_id`, as on
 * B2B's rows (user's decision, 2026-10-09): the partner is in the `_id`,
 * derived from their id. Every query filters on `_id` + `source`, so no
 * service reads or writes another's carts.
 *
 * No `index:` / `schema.index()` here on purpose (CLAUDE.md rule 7): this
 * collection is not ours to reindex.
 */
export const CART_SOURCE = 'vistaar';

/** A B2B cart line, field for field. */
@Schema()
export class CartLine {
  /** The product's `bulk_sku`. */
  @Prop({ type: String, required: true })
  product_id!: string;

  /** The pack — what the line is keyed by. */
  @Prop({ type: String, required: true })
  sku!: string;

  @Prop({ type: String, required: true })
  product_name!: string;

  /** Absent when the catalogue has no image, as on B2B's rows. */
  @Prop({ type: String })
  product_image?: string;

  /** Dealer price when the line was last written; reads reprice it live. */
  @Prop({ type: Number, required: true })
  price!: number;

  @Prop({ type: Number, required: true })
  quantity!: number;

  /** price × quantity. */
  @Prop({ type: Number, required: true })
  total!: number;

  @Prop({ type: Number, default: 0 })
  gst!: number;

  @Prop({ type: Number, default: 1 })
  moq!: number;

  /** Pack weight in `uom` as a string: `'0.92'` + `'kg'`. */
  @Prop({ type: String, required: true })
  packaging_size!: string;

  @Prop({ type: String, default: '' })
  packaging_type!: string;

  @Prop({ type: String, required: true })
  uom!: string;

  @Prop({ type: Number, default: 0 })
  requested_weight!: number;

  @Prop({ type: String, default: 'bulk' })
  item_type!: string;

  @Prop({ type: String, default: null })
  packaging_sku!: string | null;

  @Prop({ type: Boolean, default: false })
  is_custom_packaging!: boolean;
}

export const CartLineSchema = SchemaFactory.createForClass(CartLine);

@Schema({
  collection: 'carts',
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
})
export class Cart {
  @Prop({ type: String, required: true, default: CART_SOURCE })
  source!: string;

  /** Who the cart is for (`PII-n`): the farmer, or the partner for shop stock. */
  @Prop({ type: String, required: true })
  pii_id!: string;

  @Prop({ type: [CartLineSchema], default: [] })
  items!: CartLine[];

  @Prop({ type: Number, default: 0 })
  subtotal!: number;

  /** Kept at 0, as on B2B's rows; tax and discounts are settled at checkout. */
  @Prop({ type: Number, default: 0 })
  tax!: number;

  @Prop({ type: Number, default: 0 })
  discount!: number;

  @Prop({ type: Number, default: 0 })
  total!: number;

  created_at!: Date;
  updated_at!: Date;
}

export const CartSchema = SchemaFactory.createForClass(Cart);

/**
 * A cart as `.lean()` returns it. `__v` is the version key B2B's rows carry
 * too; writes here also use it as the compare-and-set counter.
 */
export type CartRecord = Cart & { _id: Types.ObjectId; __v: number };
