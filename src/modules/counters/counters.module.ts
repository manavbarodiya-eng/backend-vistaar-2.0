import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { CounterRepository } from './repositories/counter.repository';
import { Counter, CounterSchema } from './schemas/counter.schema';
import { CountersService } from './services/counters.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Counter.name, schema: CounterSchema }]),
  ],
  providers: [CounterRepository, CountersService],
  exports: [CountersService],
})
export class CountersModule {}
