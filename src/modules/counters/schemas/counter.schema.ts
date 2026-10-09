import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';

export const COUNTERS_COLLECTION = 'vistaar_v2_counters';

/**
 * Our own id counters. Not `app_counters` (ko-sales') and not the legacy
 * `sequences` (whose `vagent` key belongs to the old Vistaar): a series this
 * service mints must not move anyone else's.
 */
@Schema({ collection: COUNTERS_COLLECTION, versionKey: false })
export class Counter {
  @Prop({ type: String })
  _id!: string;

  @Prop({ type: Number, required: true, default: 0 })
  seq!: number;

  @Prop({ type: Date })
  updated_at?: Date;
}

export type CounterDocument = HydratedDocument<Counter>;
export const CounterSchema = SchemaFactory.createForClass(Counter);
