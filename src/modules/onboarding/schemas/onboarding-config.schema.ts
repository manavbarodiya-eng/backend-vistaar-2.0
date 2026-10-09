import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { SchemaTypes, type HydratedDocument } from 'mongoose';

import type { StepDef } from '../form.domain';

export const CONFIG_STATUSES = ['draft', 'published', 'archived'] as const;
export type ConfigStatus = (typeof CONFIG_STATUSES)[number];

/**
 * One version of one cohort's onboarding form. A **published version never
 * changes**: an application keeps the version it was filled with, so HO can
 * edit the form without breaking what partners already submitted. HO edits a
 * `draft` (at most one per cohort) and publishes it as the next version.
 */
@Schema({
  collection: 'vistaar_v2_onboarding_configs',
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  versionKey: false,
})
export class OnboardingConfig {
  /** `<cohort>@<version>`. */
  @Prop({ type: String }) _id!: string;
  @Prop({ type: String, required: true }) cohort!: string;
  @Prop({ type: Number, required: true }) version!: number;
  @Prop({ type: String, enum: CONFIG_STATUSES, required: true })
  status!: ConfigStatus;
  @Prop({ type: [SchemaTypes.Mixed], default: [] }) steps!: StepDef[];
  @Prop({ type: String, default: null }) notes!: string | null;
  @Prop({ type: Date, default: null }) published_at!: Date | null;
  @Prop({ type: String, default: null }) published_by!: string | null;
  @Prop({ type: String }) created_by!: string;
  @Prop({ type: String }) updated_by!: string;
  created_at!: Date;
  updated_at!: Date;
}

export type OnboardingConfigDocument = HydratedDocument<OnboardingConfig>;
export const OnboardingConfigSchema =
  SchemaFactory.createForClass(OnboardingConfig);

OnboardingConfigSchema.index({ cohort: 1, version: -1 }, { unique: true });
OnboardingConfigSchema.index(
  { cohort: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: 'draft' } },
);
