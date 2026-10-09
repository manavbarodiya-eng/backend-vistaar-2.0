import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';

/**
 * One signed-in device. The refresh token itself is never stored — `_id` is
 * its SHA-256 — so a leaked collection cannot be replayed. Mongo deletes the
 * row at `expires_at` (TTL index). Multiple devices per partner are allowed.
 */
@Schema({ collection: 'vistaar_v2_sessions', versionKey: false })
export class Session {
  @Prop({ type: String }) _id!: string;
  /** `vistaar_v2_agents._id`. */
  @Prop({ type: String, required: true }) agent_ref!: string;
  @Prop({ type: Date, required: true }) created_at!: Date;
  @Prop({ type: Date, required: true }) expires_at!: Date;
  @Prop({ type: String, default: null }) user_agent!: string | null;
}

export type SessionDocument = HydratedDocument<Session>;
export const SessionSchema = SchemaFactory.createForClass(Session);

SessionSchema.index({ agent_ref: 1 });
SessionSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });
