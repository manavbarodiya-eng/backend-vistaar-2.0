import { Body, Controller, Get, Put } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentAdmin } from '@common/decorators/current-principal.decorator';
import type { AdminPrincipal } from '@common/interfaces/principal.interface';
import { Can } from '@modules/access/guards/capability.guard';

import { UpdateSettingsDto } from '../dto/settings.dto';
import type { SettingsRecord } from '../repositories/settings.repository';
import { SettingsService } from '../services/settings.service';

@ApiTags('admin · settings')
@Controller('admin/settings')
export class AdminSettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  @Can('agents.read')
  @ApiOperation({ summary: 'Default owner for new signups, conflict radius' })
  get(): Promise<SettingsRecord> {
    return this.settings.get();
  }

  @Put()
  @Can('settings.write')
  @ApiOperation({ summary: 'Change the default owner or the conflict radius' })
  update(
    @Body() dto: UpdateSettingsDto,
    @CurrentAdmin() admin: AdminPrincipal,
  ): Promise<SettingsRecord> {
    return this.settings.update(dto, admin.email);
  }
}
