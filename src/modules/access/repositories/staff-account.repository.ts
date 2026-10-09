import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import {
  StaffAccount,
  type StaffAccountDocument,
} from '../schemas/staff-account.schema';

export interface StaffRecord {
  email: string;
  agent_id: string | null;
  name: string;
  user_role: string | null;
  is_active: boolean;
}

const FIELDS = 'email agent_id first_name last_name user_role is_active';

type Raw = Partial<StaffAccount>;

const toRecord = (doc: Raw): StaffRecord => ({
  email: doc.email ?? '',
  agent_id: doc.agent_id ?? null,
  name: [doc.first_name, doc.last_name].filter(Boolean).join(' ').trim(),
  user_role: doc.user_role ?? null,
  is_active: doc.is_active === true,
});

@Injectable()
export class StaffAccountRepository {
  constructor(
    @InjectModel(StaffAccount.name)
    private readonly model: Model<StaffAccountDocument>,
  ) {}

  async findByEmail(email: string): Promise<StaffRecord | null> {
    const doc = await this.model
      .findOne({ email })
      .select(FIELDS)
      .lean<Raw | null>()
      .exec();
    return doc ? toRecord(doc) : null;
  }

  async findByAgentIds(agentIds: string[]): Promise<StaffRecord[]> {
    if (agentIds.length === 0) return [];
    const docs = await this.model
      .find({ agent_id: { $in: agentIds } })
      .select(FIELDS)
      .lean<Raw[]>()
      .exec();
    return docs.map(toRecord);
  }
}
