import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { Session, type SessionDocument } from '../schemas/session.schema';

@Injectable()
export class SessionRepository {
  constructor(
    @InjectModel(Session.name) private readonly model: Model<SessionDocument>,
  ) {}

  async create(row: Session): Promise<void> {
    await this.model.create(row);
  }

  /**
   * Spends a refresh token: read and delete in one step, so the same token
   * can never be used twice even by two requests racing.
   */
  consume(hash: string): Promise<Session | null> {
    return this.model
      .findOneAndDelete({ _id: hash, expires_at: { $gt: new Date() } })
      .lean<Session | null>()
      .exec();
  }

  async remove(hash: string, agentRef: string): Promise<void> {
    await this.model.deleteOne({ _id: hash, agent_ref: agentRef }).exec();
  }
}
