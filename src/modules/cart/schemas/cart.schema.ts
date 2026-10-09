import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { Types } from 'mongoose';

/**
 * `carts` is **shared** with the B2B Sales service (its rows carry
 * `source: 'b2b' | 'retailer'`). Every Vistaar row says `source: 'vistaar'`
 * and every query here filters on it, so neither side ever reads or writes the
 * other's carts. Line field names follow B2B's (`price`, `quantity`, `total`,
 * `gst`, `packaging_size`) so the collection reads as one shape.
 *
 * No `index:` / `schema.index()` here on purpose (CLAUDE.md rule 7): this
 * collection is not ours to reindex. The indexes it needs are listed in
 * `docs/PROD-CHECKLIST.md` for the collection's owner to build.
 */
export const CART_SOURCE = 'vistaar';

export const CART_STATUSES = ['active', 'saved'] as const;
export type CartStatus = (typeof CART_STATUSES)[number];

@Schema({ _id: false })
export class CartLine {
  @Prop({ type: String, required: true })
  sku!: string;

  /** The product's `bulk_sku`. */
  @Prop({ type: String, required: true })
  product_id!: string;

  @Prop({ type: String, required: true })
  product_name!: string;

  @Prop({ type: String, default: null })
  product_image!: string | null;

  @Prop({ type: String, required: true })
  packaging_size!: string;

  /** Dealer price when the line was last written; reads reprice it live. */
  @Prop({ type: Number, required: true })
  price!: number;

  @Prop({ type: Number, required: true })
  mrp!: number;

  @Prop({ type: Number, default: 0 })
  gst!: number;

  @Prop({ type: Number, required: true })
  quantity!: number;

  /** price × quantity. */
  @Prop({ type: Number, required: true })
  total!: number;
}

export const CartLineSchema = SchemaFactory.createForClass(CartLine);

@Schema({
  collection: 'carts',
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  versionKey: false,
})
export class Cart {
  @Prop({ type: String, required: true, default: CART_SOURCE })
  source!: string;

  @Prop({ type: String, required: true })
  partner_id!: string;

  @Prop({ type: String, required: true, enum: CART_STATUSES })
  status!: CartStatus;

  /** Who the cart is for; `null` = the partner's own shop stock. */
  @Prop({ type: String, default: null })
  customer_id!: string | null;

  @Prop({ type: String, default: null })
  customer_name!: string | null;

  /**
   * `customer_id`, or `self`. A partner keeps one saved cart per customer —
   * saving again for the same customer replaces it, as the app does.
   */
  @Prop({ type: String, default: null })
  customer_key!: string | null;

  @Prop({ type: [CartLineSchema], default: [] })
  items!: CartLine[];

  /** Σ quantity. */
  @Prop({ type: Number, default: 0 })
  item_count!: number;

  @Prop({ type: Number, default: 0 })
  subtotal!: number;

  /** Kept at 0 alongside B2B's rows; tax and discounts are settled at checkout. */
  @Prop({ type: Number, default: 0 })
  tax!: number;

  @Prop({ type: Number, default: 0 })
  discount!: number;

  @Prop({ type: Number, default: 0 })
  total!: number;

  @Prop({ type: Boolean, default: false })
  reminder_sent!: boolean;

  /** Compare-and-set counter: a write lands only on the version it read. */
  @Prop({ type: Number, default: 0 })
  version!: number;

  created_at!: Date;
  updated_at!: Date;
}

export const CartSchema = SchemaFactory.createForClass(Cart);

/** A cart as `.lean()` returns it. */
export type CartRecord = Cart & { _id: Types.ObjectId };
