import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentAdmin } from '@common/decorators/current-principal.decorator';
import type { AdminPrincipal } from '@common/interfaces/principal.interface';
import { Can } from '@modules/access/guards/capability.guard';

import { CreateCohortDto, UpdateCohortDto } from '../dto/cohort.dto';
import type { Cohort } from '../schemas/cohort.schema';
import { CohortsService } from '../services/cohorts.service';

@ApiTags('admin · cohorts')
@Controller('admin/cohorts')
export class AdminCohortsController {
  constructor(private readonly cohorts: CohortsService) {}

  @Get()
  @Can('config.read')
  @ApiOperation({ summary: 'Every partner type, active or not' })
  list(): Promise<Cohort[]> {
    return this.cohorts.list(false);
  }

  @Post()
  @Can('config.write')
  @ApiOperation({
    summary: 'Add a partner type (its form is created as a draft separately)',
  })
  create(
    @Body() dto: CreateCohortDto,
    @CurrentAdmin() admin: AdminPrincipal,
  ): Promise<Cohort> {
    return this.cohorts.create(dto, admin.email);
  }

  @Patch(':key')
  @Can('config.write')
  @ApiOperation({ summary: 'Rename, reorder, (de)activate a partner type' })
  update(
    @Param('key') key: string,
    @Body() dto: UpdateCohortDto,
    @CurrentAdmin() admin: AdminPrincipal,
  ): Promise<Cohort> {
    return this.cohorts.update(key, dto, admin.email);
  }

  @Delete(':key')
  @Can('config.write')
  @ApiOperation({
    summary:
      'Delete an unused partner type (409 COHORT_IN_USE otherwise — deactivate it)',
  })
  remove(@Param('key') key: string): Promise<{ deleted: true }> {
    return this.cohorts.remove(key);
  }
}
