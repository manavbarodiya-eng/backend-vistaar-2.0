import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { PiiRepository } from './repositories/pii.repository';
import { PincodeRepository } from './repositories/pincode.repository';
import { AppCounter, AppCounterSchema } from './schemas/app-counter.schema';
import { Pii, PiiSchema } from './schemas/pii.schema';
import { Pincode, PincodeSchema } from './schemas/pincode.schema';
import { PiiService } from './services/pii.service';
import { PincodeService } from './services/pincode.service';

/**
 * The org's shared records Vistaar touches: `piis` (find, or insert a new
 * person), `app_counters.piis`, and `pincode_map_v2` (read). Nothing else in
 * this service may hold a model for them.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Pii.name, schema: PiiSchema },
      { name: AppCounter.name, schema: AppCounterSchema },
      { name: Pincode.name, schema: PincodeSchema },
    ]),
  ],
  providers: [PiiRepository, PincodeRepository, PiiService, PincodeService],
  exports: [PiiService, PincodeService],
})
export class SpineModule {}
