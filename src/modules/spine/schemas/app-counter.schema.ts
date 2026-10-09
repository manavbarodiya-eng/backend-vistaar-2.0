import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';

/**
 * `app_counters` — ko-sales' shared id counters. Vistaar touches only the
 * `piis` key, with the same `$inc` ko-sales issues, so a PII number taken here
 * is never handed to another portal.
 */
@Schema({ collection: 'app_counters', autoIndex: false, versionKey: false })
export class AppCounter {
  @Prop({ type: String })
  _id!: string;

  @Prop({ type: Number })
  count!: number;

  @Prop({ type: Date })
  updated_at?: Date;
}

export type AppCounterDocument = HydratedDocument<AppCounter>;
export const AppCounterSchema = SchemaFactory.createForClass(AppCounter);
