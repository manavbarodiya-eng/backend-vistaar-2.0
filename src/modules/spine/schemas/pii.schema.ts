import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { SchemaTypes, type HydratedDocument } from 'mongoose';

/**
 * `piis` — one person, shared by every portal; ko-sales owns it. Declares
 * only what Vistaar reads or writes.
 *
 * ⚠️ No index is declared and `autoIndex` is off: `pii_id` is unique and
 * `phone_number` is indexed by ko-sales already, and a declaration here would
 * be a build on a 1.6M-row live collection.
 *
 * `referral_id` is deliberately absent: it carries a unique sparse index, and
 * writing it as `null` would collide with every other null.
 */
@Schema({
  collection: 'piis',
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  autoIndex: false,
})
export class Pii {
  @Prop({ type: String, required: true })
  pii_id!: string;

  /** Bare 10-digit numbers; an array because a person can have several. */
  @Prop({ type: [String], default: undefined })
  phone_number!: string[];

  @Prop({ type: String })
  country_code?: string;

  @Prop({ type: [SchemaTypes.Mixed], default: undefined })
  addresses?: unknown[];

  @Prop({ type: [SchemaTypes.Mixed], default: undefined })
  gst_numbers?: unknown[];

  /** Without it, strict mode would drop `documents.<type>` from updates. */
  @Prop({ type: SchemaTypes.Mixed, default: undefined })
  documents?: Record<string, unknown>;
}

export type PiiDocument = HydratedDocument<Pii>;
export const PiiSchema = SchemaFactory.createForClass(Pii);
