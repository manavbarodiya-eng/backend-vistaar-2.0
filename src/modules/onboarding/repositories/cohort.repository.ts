import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { Cohort, type CohortDocument } from '../schemas/cohort.schema';

@Injectable()
export class CohortRepository {
  constructor(
    @InjectModel(Cohort.name) private readonly model: Model<CohortDocument>,
  ) {}

  list(activeOnly: boolean): Promise<Cohort[]> {
    return this.model
      .find(activeOnly ? { is_active: true } : {})
      .sort({ order: 1, _id: 1 })
      .lean<Cohort[]>()
      .exec();
  }

  find(key: string): Promise<Cohort | null> {
    return this.model.findById(key).lean<Cohort | null>().exec();
  }

  async create(
    row: Omit<Cohort, 'created_at' | 'updated_at'>,
  ): Promise<Cohort> {
    const doc = await this.model.create(row);
    return doc.toObject<Cohort>();
  }

  update(key: string, set: Partial<Cohort>): Promise<Cohort | null> {
    return this.model
      .findOneAndUpdate(
        { _id: key },
        { $set: set },
        { returnDocument: 'after' },
      )
      .lean<Cohort | null>()
      .exec();
  }

  async remove(key: string): Promise<boolean> {
    return (await this.model.deleteOne({ _id: key }).exec()).deletedCount === 1;
  }
}
