import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { Types } from 'mongoose';

import type { DraftFormData } from '../draft-order.domain';

/**
 * `draft_orders` is **shared** with the B2B order portal (`entry_path`
 * `deal` / `customer`) and Sankalp (`sankalp`). A Vistaar row is the same
 * document — fields, names and types taken from the rows already there
 * (2026-10-09) — told apart only by `entry_path: 'vistaar'`, with the partner
 * in `agent_id`. Every query here filters on both.
 *
 * The one field B2B's rows lack is `reminder_sent`, kept by the user's
 * decision (2026-10-09) for the app's WhatsApp-reminder badge.
 *
 * No `index:` / `schema.index()` here (CLAUDE.md rule 7). The collection
 * already has `draft_order_id` (unique), `agent_id` and `status`, which is
 * every index these queries need.
 */
export const DRAFT_ENTRY_PATH = 'vistaar';

export const DRAFT_STATUSES = ['draft', 'converted'] as const;
export type DraftStatus = (typeof DRAFT_STATUSES)[number];

@Schema({
  collection: 'draft_orders',
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  // Free-form per entry path, as the other writers use it.
  minimize: false,
})
export class DraftOrder {
  /** `DFT-n`, from `app_counters._id = 'draft_orders'`. */
  @Prop({ type: String, required: true })
  draft_order_id!: string;

  /** The partner who owns the draft. */
  @Prop({ type: String, required: true })
  agent_id!: string;

  /** B2B deals only; always `null` on a Vistaar row. */
  @Prop({ type: String, default: null })
  deal_id!: string | null;

  /** `contacts_v2.contact_id` (`C0-n`) when the customer has one. */
  @Prop({ type: String, default: null })
  contact_id!: string | null;

  @Prop({ type: String, default: null })
  customer_name!: string | null;

  @Prop({ type: String, default: null })
  contact_number!: string | null;

  @Prop({ type: String, required: true, enum: DRAFT_STATUSES })
  status!: DraftStatus;

  @Prop({ type: String, default: null })
  order_id!: string | null;

  @Prop({ type: Object, required: true })
  form_data!: DraftFormData;

  @Prop({ type: String, required: true, default: DRAFT_ENTRY_PATH })
  entry_path!: string;

  @Prop({ type: Number, default: 0 })
  grand_total!: number;

  @Prop({ type: Boolean, default: false })
  reminder_sent!: boolean;

  created_at!: Date;
  updated_at!: Date;
}

export const DraftOrderSchema = SchemaFactory.createForClass(DraftOrder);

/** A draft as `.lean()` returns it. */
export type DraftOrderRecord = DraftOrder & {
  _id: Types.ObjectId;
  __v: number;
};
