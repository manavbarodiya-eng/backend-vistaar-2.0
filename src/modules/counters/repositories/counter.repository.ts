import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { Counter, type CounterDocument } from '../schemas/counter.schema';

@Injectable()
export class CounterRepository {
  constructor(
    @InjectModel(Counter.name) private readonly model: Model<CounterDocument>,
  ) {}

  /** Atomic `$inc` — two callers can never receive the same number. */
  async next(key: string): Promise<number> {
    const doc = await this.model
      .findOneAndUpdate(
        { _id: key },
        { $inc: { seq: 1 }, $set: { updated_at: new Date() } },
        { upsert: true, returnDocument: 'after' },
      )
      .lean<{ seq: number }>()
      .exec();
    return doc.seq;
  }
}
