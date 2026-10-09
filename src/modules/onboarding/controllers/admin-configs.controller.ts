import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  Put,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentAdmin } from '@common/decorators/current-principal.decorator';
import type { AdminPrincipal } from '@common/interfaces/principal.interface';
import { Can } from '@modules/access/guards/capability.guard';

import { SaveDraftDto } from '../dto/config.dto';
import { FIELD_TYPES, MAPS_TO } from '../form.domain';
import type { OnboardingConfig } from '../schemas/onboarding-config.schema';
import { ConfigsService, type DraftResult } from '../services/configs.service';

@ApiTags('admin · onboarding forms')
@Controller('admin/onboarding-configs')
export class AdminConfigsController {
  constructor(private readonly configs: ConfigsService) {}

  @Get('meta')
  @Can('config.read')
  @ApiOperation({
    summary: 'Field types and `maps_to` targets the editor may offer',
  })
  meta(): {
    field_types: readonly string[];
    maps_to: readonly string[];
    details_prefix: string;
  } {
    return {
      field_types: FIELD_TYPES,
      maps_to: MAPS_TO,
      details_prefix: 'details.',
    };
  }

  @Get(':cohort/versions')
  @Can('config.read')
  @ApiOperation({ summary: 'All versions of a form (without steps)' })
  versions(
    @Param('cohort') cohort: string,
  ): Promise<Omit<OnboardingConfig, 'steps'>[]> {
    return this.configs.versions(cohort);
  }

  @Get(':cohort/versions/:version')
  @Can('config.read')
  @ApiOperation({ summary: 'One version in full' })
  version(
    @Param('cohort') cohort: string,
    @Param('version', ParseIntPipe) version: number,
  ): Promise<OnboardingConfig> {
    return this.configs.version(cohort, version);
  }

  @Get(':cohort/draft')
  @Can('config.read')
  @ApiOperation({
    summary:
      'The draft being edited, with what still blocks publishing (null if none)',
  })
  draft(@Param('cohort') cohort: string): Promise<DraftResult | null> {
    return this.configs.draft(cohort);
  }

  @Put(':cohort/draft')
  @Can('config.write')
  @ApiOperation({
    summary:
      'Save the whole draft (steps, fields, order, labels). Returns publish blockers.',
  })
  saveDraft(
    @Param('cohort') cohort: string,
    @Body() dto: SaveDraftDto,
    @CurrentAdmin() admin: AdminPrincipal,
  ): Promise<DraftResult> {
    return this.configs.saveDraft(
      cohort,
      dto.steps,
      dto.notes ?? null,
      admin.email,
    );
  }

  @Post(':cohort/draft/clone-from/:source')
  @HttpCode(200)
  @Can('config.write')
  @ApiOperation({
    summary: "Start this cohort's draft from another cohort's form",
  })
  clone(
    @Param('cohort') cohort: string,
    @Param('source') source: string,
    @CurrentAdmin() admin: AdminPrincipal,
  ): Promise<DraftResult> {
    return this.configs.cloneFrom(cohort, source, admin.email);
  }

  @Post(':cohort/publish')
  @HttpCode(200)
  @Can('config.publish')
  @ApiOperation({
    summary:
      'Publish the draft — the app shows it at once; partners mid-form move to it',
  })
  publish(
    @Param('cohort') cohort: string,
    @CurrentAdmin() admin: AdminPrincipal,
  ): Promise<OnboardingConfig> {
    return this.configs.publish(cohort, admin.email);
  }

  @Delete(':cohort/draft')
  @Can('config.write')
  @ApiOperation({ summary: 'Throw the draft away' })
  discard(@Param('cohort') cohort: string): Promise<{ deleted: true }> {
    return this.configs.discardDraft(cohort);
  }
}
