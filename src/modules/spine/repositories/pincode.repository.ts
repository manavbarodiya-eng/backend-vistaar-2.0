import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { Pincode, type PincodeDocument } from '../schemas/pincode.schema';

export interface PincodeInfo {
  pincode: string;
  state: string | null;
  district: string | null;
  taluk: string | null;
}

@Injectable()
export class PincodeRepository {
  constructor(
    @InjectModel(Pincode.name) private readonly model: Model<PincodeDocument>,
  ) {}

  async find(pincode: string): Promise<PincodeInfo | null> {
    const doc = await this.model
      .findOne({ pincode })
      .select('pincode state district taluk')
      .lean<Partial<PincodeInfo> | null>()
      .exec();
    if (!doc) return null;
    return {
      pincode,
      state: doc.state ?? null,
      district: doc.district ?? null,
      taluk: doc.taluk ?? null,
    };
  }
}
