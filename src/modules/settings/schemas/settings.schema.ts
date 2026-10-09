import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';

export const SETTINGS_ID = 'vistaar';

/** One document of programme settings the HO desk can change without a release. */
@Schema({ collection: 'vistaar_v2_settings', versionKey: false })
export class Settings {
  @Prop({ type: String, default: SETTINGS_ID })
  _id!: string;

  /** `agents_v2.agent_id` that owns every new signup until reassigned. */
  @Prop({ type: String, default: null })
  default_owner_agent_id!: string | null;

  /** How far the approval screen looks for existing network, in km. */
  @Prop({ type: Number, default: 5 })
  conflict_radius_km!: number;

  @Prop({ type: String }) updated_by?: string;
  @Prop({ type: Date }) updated_at?: Date;
}

export type SettingsDocument = HydratedDocument<Settings>;
export const SettingsSchema = SchemaFactory.createForClass(Settings);
