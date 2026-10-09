import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { AccessModule } from '@modules/access/access.module';

import { AdminSettingsController } from './controllers/admin-settings.controller';
import { SettingsRepository } from './repositories/settings.repository';
import { Settings, SettingsSchema } from './schemas/settings.schema';
import { SettingsService } from './services/settings.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Settings.name, schema: SettingsSchema },
    ]),
    AccessModule,
  ],
  controllers: [AdminSettingsController],
  providers: [SettingsRepository, SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
