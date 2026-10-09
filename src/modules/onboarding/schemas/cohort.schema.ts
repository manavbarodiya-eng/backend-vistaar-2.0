import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { SchemaTypes, type HydratedDocument } from 'mongoose';

import type { Localized } from '../form.domain';

export interface SubType {
  key: string;
  label: Localized;
}

/**
 * Who a partner is — Vistaar agent, ex-employee, working professional,
 * consultant, other — managed by HO. Each cohort has its own onboarding form.
 */
@Schema({
  collection: 'vistaar_v2_cohorts',
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  versionKey: false,
})
export class Cohort {
  /** The key, e.g. `vistaar_agent`. Never renamed once partners use it. */
  @Prop({ type: String }) _id!: string;
  @Prop({ type: SchemaTypes.Mixed, required: true }) label!: Localized;
  @Prop({ type: SchemaTypes.Mixed, default: null })
  description!: Localized | null;
  @Prop({ type: String, default: null }) icon!: string | null;
  @Prop({ type: [SchemaTypes.Mixed], default: [] }) sub_types!: SubType[];
  @Prop({ type: Number, default: 0 }) order!: number;
  @Prop({ type: Boolean, default: true }) is_active!: boolean;
  @Prop({ type: String }) created_by!: string;
  @Prop({ type: String }) updated_by!: string;
  created_at!: Date;
  updated_at!: Date;
}

export type CohortDocument = HydratedDocument<Cohort>;
export const CohortSchema = SchemaFactory.createForClass(Cohort);
